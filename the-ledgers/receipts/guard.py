"""The guard: runs before a payment tool and decides whether the call may go ahead.

Claude Code calls it as a PreToolUse hook (hooks/run.py guard) with the tool call as JSON. For
a tool that receipts.json lists under payment_tools it:

1. runs the payment checks (C4-C8) against the business's records, read-only, and the owner's
   payee list;
2. writes its decision and every check result to the hash-chain log, masked, so the verifier
   can later compare what was allowed with what happened;
3. answers Claude Code. In "enforce" mode:
   - deny, with the reasons, when any check blocks, when the checks can't run, or when the
     decision can't be written to the log (fail closed);
   - ask, when the amount is over approval_threshold_cents: Claude Code's own permission
     prompt shows the owner the payment and the owner approves or declines it there. In
     bypassPermissions mode a hook's "ask" isn't documented to prompt, so it denies instead;
   - nothing otherwise, which leaves the call to Claude Code's normal permission rules.
   In "watch" mode it checks and logs the same way but never blocks; the verdicts say what
   would have been stopped.

Steps 1 and 2 run under a lock, and a payment approved in the last 2 minutes whose tool call
hasn't been logged counts as in flight (check C7, receipts.pending), so parallel calls can't
both pay a bill.

It also protects what Receipts relies on, in both modes:
- Claude may not edit receipts.json, the logs/ folder, a SQLite records file, Receipts' own code
  (the plugin folder, and Claude Code's installed plugins), or the files that decide which hooks
  and tool names exist: .mcp.json and .claude/settings.json and settings.local.json (the
  project's and the user's). Edit, Write, MultiEdit, NotebookEdit.
- Claude may not read or search Receipts' secrets folder (the payee list and stored sign-ins),
  including a search of a folder that contains it. Read, Grep.
- Best effort: Claude may not run Bash commands that name any of these, that delete, move or
  rewrite the logs folder, or that run Receipts' own commands. The owner's own shell commands aren't tool calls and aren't affected.

Other tools are left alone. A receipts.json or payee list that exists but is broken denies
every call that reaches the guard.
"""

from __future__ import annotations

import os
import re
import time
from dataclasses import asdict
from pathlib import Path

from receipts import chain, config, paths, payees, pending, pii
from receipts.checks import CheckResult, allowed, evaluate
from receipts.filelock import locked

GUARD_TOOL = "receipts:guard"
DECISION_SECONDS = 20  # the hook's own timeout is 30s
LOCK_WAIT_SECONDS = 8
EDIT_TOOLS = ("Edit", "Write", "MultiEdit", "NotebookEdit")
READ_TOOLS = ("Read", "Grep")
HOOK_FILES = (".mcp.json", ".claude/settings.json", ".claude/settings.local.json")
# Receipts' own code: the folder this module runs from, and Claude Code's installed plugins.
PLUGIN_ROOT = Path(__file__).resolve().parent.parent
# Shell commands that can delete, move or rewrite files.
DESTRUCTIVE = re.compile(
    r"(^|[\s;&|(])(rm|rmdir|mv|cp|ln|truncate|shred|unlink|dd|tee|sed|perl|chmod|chown|find)\b|>"
)
LOGS_WORD = re.compile(r"(^|[\s\"'=/])logs(/|$|[\s\"'*;&|])")


def money(cents: object) -> str:
    return f"${cents / 100:,.2f}" if type(cents) is int else "an unknown amount"


# ---------- protecting Receipts' own files ----------


def _protected(cfg: config.Config) -> list[Path]:
    """What Claude may not edit: Receipts' settings, log and records, and the hook settings."""
    found = [cfg.path, cfg.root / "logs", paths.secrets_dir(), PLUGIN_ROOT]
    found.append(Path.home() / ".claude" / "plugins")
    found += [cfg.root / f for f in HOOK_FILES]
    found += [
        Path.home() / ".claude" / "settings.json",
        Path.home() / ".claude" / "settings.local.json",
    ]
    if cfg.source.get("type") == "sqlite":
        found.append(cfg.root / str(cfg.source.get("path", "")))
    return [p.resolve() for p in found]


def _target(cfg: config.Config, raw: object) -> Path:
    path = Path(os.path.expanduser(str(raw or "")))
    return (path if path.is_absolute() else cfg.root / path).resolve()


def _within(target: Path, folder: Path) -> bool:
    return target == folder or folder in target.parents


def protects(event: dict, cfg: config.Config) -> str | None:
    """The deny reason when a file, search or shell tool would touch what Receipts relies on."""
    tool, given = str(event.get("tool_name", "")), event.get("tool_input")
    given = given if isinstance(given, dict) else {}
    secrets = paths.secrets_dir()
    if tool in EDIT_TOOLS:
        target = _target(cfg, given.get("file_path") or given.get("notebook_path"))
        if any(_within(target, p) for p in _protected(cfg)):
            return f"Receipts protects {target.name}: only the owner may change it."
    elif tool in READ_TOOLS:
        raw = given.get("file_path") or given.get("path")
        target = _target(cfg, raw) if raw else cfg.root
        # A search of a folder that contains the secrets folder would search it too.
        if _within(target, secrets) or (tool == "Grep" and _within(secrets, target)):
            return "Receipts protects its payee list and sign-ins: Claude may not read them."
    elif tool == "Bash":
        command = str(given.get("command", ""))
        names = [cfg.path.name, "chain.jsonl", "chain.head", ".mcp.json", ".claude/settings"]
        names += [str(secrets), "config/receipts", "receipts-quickbooks", "-m receipts"]
        if cfg.source.get("type") == "sqlite":
            names.append(Path(str(cfg.source.get("path", ""))).name)
        names.append(str(PLUGIN_ROOT))
        hit = next((n for n in names if n and n in command), None)
        if hit:
            return f"Receipts protects {hit}: commands that name it need the owner, not Claude."
        if LOGS_WORD.search(command) and DESTRUCTIVE.search(command):
            return "Receipts protects its logs: commands that change them need the owner."
    return None


# ---------- checking a payment ----------


def run_checks(
    cfg: config.Config,
    args: dict,
    owner_list: payees.Payees | None,
    in_flight: bool = False,
    deadline: float | None = None,
) -> list[CheckResult]:
    source = None
    try:
        source = cfg.open_source()
        set_deadline = getattr(source, "set_deadline", None)
        if deadline is not None and callable(set_deadline):
            set_deadline(deadline)
        return evaluate("pay_bill", args, source, owner_list, cfg.require_purchase_order, in_flight)
    except Exception as exc:  # noqa: BLE001 - a source that can't open blocks
        return [CheckResult("C0", "block", f"Records couldn't be read: {type(exc).__name__}")]
    finally:
        close = getattr(source, "close", None)
        if callable(close):
            close()


def _logged_args(args: dict, tool: str) -> dict:
    logged = pii.mask({"tool": tool, **args})
    bill_id = args.get("bill_id")
    if isinstance(bill_id, str) and config.SAFE_REF.fullmatch(bill_id):
        logged["bill_id"] = bill_id
    return logged


def describe(args: dict) -> str:
    account = pii.mask_text(str(args.get("to_account", "?")))
    bill = pii.mask_text(str(args.get("bill_id")))
    return f"{money(args.get('amount_cents'))} for bill {bill} to account {account}"


def _decide_payment(event: dict, cfg: config.Config, args: dict) -> tuple[str, list[CheckResult]]:
    """Check the payment and log the decision, under the guard's lock. Returns the decision
    (deny, ask or pass) and the check results. Raises OSError if it can't be logged."""
    now = time.time()
    # One budget for the whole decision, waiting for the lock included, so the hook answers
    # well inside Claude Code's 30-second limit.
    deadline = time.monotonic() + DECISION_SECONDS
    with locked(pending.lock_path(cfg.root), timeout=LOCK_WAIT_SECONDS):
        try:
            owner_list = cfg.load_payees()
        except payees.PayeesError as exc:
            results = [CheckResult("C0", "block", f"The payee list can't be used: {exc}")]
        else:
            in_flight = pending.in_flight(cfg.root, str(args.get("bill_id")), now)
            results = run_checks(cfg, args, owner_list, in_flight, deadline)
        over = type(args.get("amount_cents")) is int and (
            args["amount_cents"] > cfg.approval_threshold_cents
        )
        decision = "deny" if not allowed(results) else "ask" if over else "pass"
        chain.append(
            {
                "ts": round(now, 3),
                "session": str(event.get("session_id", "")),
                "tool": GUARD_TOOL,
                "input": _logged_args(args, str(event.get("tool_name", ""))),
                "response": pii.mask(
                    {
                        "decision": decision,
                        "mode": cfg.mode,
                        "checks": [asdict(r) for r in results],
                    }
                ),
            },
            cfg.log_path,
        )
        if decision != "deny" and isinstance(args.get("bill_id"), str):
            pending.start(cfg.root, args["bill_id"], now)
    return decision, results


def decide(event: object, cfg: config.Config) -> tuple[str, str] | None:
    """("deny" | "ask", reason) for the tool call, or None to leave it alone."""
    if not isinstance(event, dict):
        return None
    reason = protects(event, cfg)
    if reason:
        return "deny", reason
    args = cfg.payment_args(str(event.get("tool_name", "")), event.get("tool_input"))
    if args is None:
        return None
    try:
        decision, results = _decide_payment(event, cfg, args)
    except Exception as exc:  # noqa: BLE001 - enforce refuses; watch never blocks
        if cfg.mode == "watch":
            return None
        if isinstance(exc, TimeoutError):
            what = "couldn't be checked in time (another payment was being checked)"
        elif isinstance(exc, OSError):
            what = "wasn't logged"
        else:
            what = "couldn't be checked"
        return "deny", f"Receipts: the payment {what} ({type(exc).__name__}), so it's refused."
    if cfg.mode == "watch":
        return None
    if decision == "deny":
        reasons = "; ".join(f"{r.id}: {r.title}" for r in results if r.status == "block")
        return "deny", f"Receipts refused this payment ({describe(args)}). {reasons}."
    if decision == "ask":
        limit = money(cfg.approval_threshold_cents)
        if event.get("permission_mode") == "bypassPermissions":
            return "deny", (
                f"Receipts: paying {describe(args)} is over the owner's {limit} limit and needs "
                "their approval, which can't be asked in bypass-permissions mode. Tell the owner."
            )
        return "ask", f"Receipts: approve paying {describe(args)}? It's over your {limit} limit."
    return None
