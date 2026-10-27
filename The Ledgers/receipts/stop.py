"""The end-of-turn summary: after a turn that tried to pay bills, one line per bill for the owner.

Claude Code calls it as a Stop hook (hooks/run.py stop) when Claude finishes a turn. It finds
the guard decisions this session made since its last summary, runs the verifier, writes the
receipts, and returns the message to show. It says nothing when the session tried no payment
since the last summary, or when Claude Code is already continuing because of a Stop hook.

It also reads Claude's final message (the Stop event's last_assistant_message) for payment
claims (receipts.claims) and logs them, so the verifier can flag a summary the records contradict.

Which log line was last summarised for each session is kept in logs/summarised.json, inside the
project's protected logs folder, so every verdict is shown once.
"""

from __future__ import annotations

import json
import os
import re
import time
import unicodedata
from dataclasses import asdict
from pathlib import Path

from receipts import chain, claims, config, pending, pii, verify
from receipts.filelock import locked
from receipts.guard import GUARD_TOOL

LONG_NUMBER = re.compile(r"[0-9]{5,}")


def one_line(value: object, limit: int = 120) -> str:
    """Text that's safe to put in front of the owner: control and formatting characters (line
    breaks, escape codes, right-to-left overrides) turn into spaces, numbers of 5 digits or more
    keep only their last 4, and the result is cut to `limit` characters."""
    printable = "".join(
        " " if unicodedata.category(ch).startswith("C") else ch for ch in str(value)
    )
    masked = LONG_NUMBER.sub(lambda m: "••" + m.group(0)[-4:], printable)
    return masked if len(masked) <= limit else masked[: limit - 1] + "…"


# ---------- what was already summarised ----------


def _marks_file(cfg: config.Config) -> Path:
    return cfg.root / "logs" / "summarised.json"


def _marks(cfg: config.Config) -> dict[str, int]:
    try:
        found = json.loads(_marks_file(cfg).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return (
        {str(k): v for k, v in found.items() if type(v) is int} if isinstance(found, dict) else {}
    )


def _remember(cfg: config.Config, session: str, line: int) -> None:
    with locked(pending.lock_path(cfg.root)):
        marks = _marks(cfg)
        marks[session] = max(line, marks.get(session, 0))
        target = _marks_file(cfg)
        scratch = target.with_suffix(f".tmp{os.getpid()}")
        scratch.write_text(json.dumps(marks), encoding="utf-8")
        os.replace(scratch, target)


def unsummarised(cfg: config.Config, session: str) -> list[dict]:
    """This session's guard decisions after the last log line already summarised for it."""
    after = _marks(cfg).get(session, 0)
    return [
        entry
        for entry in verify.read_log(cfg.log_path)
        if entry["n"] > after
        and entry.get("tool") == GUARD_TOOL
        and entry.get("session") == session
    ]


# ---------- the message ----------


def bill_line(bill_id: str, result: verify.Result) -> str:
    receipt = result.receipts.get(bill_id)
    if receipt is None:
        return f"{one_line(bill_id)}: no receipt (the bill isn't in the records)"
    line = f"{one_line(bill_id)}: {one_line(receipt['verdict'])}"
    concerns = [c for c in receipt["checks"] if c["status"] != "verified"]
    # A summary the records contradict is the bigger news: show it first.
    concern = next(
        (c for c in concerns if c["status"] == "false_claim"), concerns[0] if concerns else None
    )
    if concern:
        line += f" ({one_line(concern['id'])} {one_line(concern['status'])}: {one_line(concern['title'])})"
    return line


def report(event: object, cfg: config.Config) -> str | None:
    """The summary to show the owner, or None to say nothing."""
    if not isinstance(event, dict) or event.get("stop_hook_active"):
        return None
    session = str(event.get("session_id") or "")
    decisions = unsummarised(cfg, session) if session else []
    if not decisions:
        return None
    named = [(entry.get("input") or {}).get("bill_id") for entry in decisions]
    bills = list(dict.fromkeys(str(b) for b in named if b is not None))
    unnamed = named.count(None)
    said = claims.extract(event.get("last_assistant_message"), bills)
    try:
        if said:
            # What Claude says it did goes into the tamper-evident log first, so the receipts
            # compare it with the records, and the claim itself can't be changed afterwards.
            chain.append(
                {
                    "ts": round(time.time(), 3),
                    "session": session,
                    "tool": verify.SUMMARY_TOOL,
                    "input": pii.mask({"claims": [asdict(c) for c in said]}),
                    "response": {},
                },
                cfg.log_path,
            )
        result = verify.build(cfg)
        verify.write(cfg.receipts_dir, result)
        parts = [bill_line(b, result) for b in bills]
        if unnamed:
            parts.append(f"{unnamed} payment(s) named no bill and were refused")
        folder = cfg.receipts_dir.relative_to(cfg.root)
        message = f"Receipts: {'; '.join(parts)}. Full receipts in {one_line(folder, 200)}"
        if result.demo:
            message += f". ({config.DEMO_NOTE}.)"
    except Exception as exc:  # noqa: BLE001 - say so once; a Stop hook must never break the turn
        message = (
            f"Receipts: couldn't build the receipts ({type(exc).__name__}). "
            "Run `python3 -m receipts verify` to retry."
        )
    try:
        _remember(cfg, session, max(entry["n"] for entry in decisions))
    except OSError:
        pass  # the worst case is the same summary again next turn
    return message
