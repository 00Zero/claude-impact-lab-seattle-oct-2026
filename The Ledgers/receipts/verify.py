"""Verifier: compare the log with the business's records and write one receipt per bill.

For every bill the log mentions, it puts three things side by side:

- what the guard decided before the payment tool ran (its "receipts:guard" log entries);
- whether the payment tool ran (the tool call's log entry);
- what the records say was paid (the configured Source, read-only).

Verdicts:
  VERIFIED      the checks passed, the tool ran and the records hold a matching payment
  ISSUES_FOUND  a check blocked the payment, or the records disagree with the log
  NOT_PAID      no payment was made: the owner declined, it was never sent, or the bill was
                already paid and the attempt to pay it again was stopped
  UNTRUSTED     the log was changed after the fact, so nothing in it can be relied on

In watch mode (a pilot) the guard blocks nothing, so a payment it would have refused can go
through; its verdict is ISSUES_FOUND and the reason says Receipts would have stopped it.

Claude's own summary is an input only as evidence to check: the payment claims the Stop hook
read from its final message (receipts.claims, logged as "receipts:summary") are compared with
the records, and a claim the records contradict makes the verdict ISSUES_FOUND (check C11).
Nothing here asks Claude whether it did the right thing.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from receipts import chain, config, pii
from receipts.guard import GUARD_TOOL, money
from receipts.source import Source

SUMMARY_TOOL = "receipts:summary"  # Claude's payment claims, logged by the Stop hook
RECEIPT_VERSION = 1
CHECK_STATUS = {"pass": "verified", "block": "blocked", "ask": "needs_approval"}
NEXT_STEP = {
    "C4": "Call {vendor} on the number you already have to confirm their bank account.",
    "C5": "Check the bill against the order before paying.",
    "C6": "Don't pay a bill that isn't for one of your open orders.",
    "C7": "This bill was already paid. Don't pay it twice.",
    "C8": "This bill came from a look-alike address. Don't pay it; contact {vendor} directly.",
}


@dataclass
class Result:
    chain: chain.ChainStatus
    receipts: dict[str, dict] = field(default_factory=dict)  # by bill id
    unknown_bills: list[str] = field(default_factory=list)  # in the log, not in the records
    no_bill: int = 0  # guard decisions on payments that named no bill (always refused)
    demo: bool = False  # the records came from the demo SQLite source


def read_log(path: Path) -> list[dict]:
    """The log's entries with their line numbers. A line that isn't a JSON object is skipped:
    chain.verify reports it."""
    if not path.exists():
        return []
    entries = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        if isinstance(entry, dict):
            entries.append({**entry, "n": n})
    return entries


def _last4(account: object) -> str:
    digits = "".join(ch for ch in str(account or "") if ch.isdigit())
    return digits[-4:]


@dataclass
class _Bill:
    guards: list[dict] = field(default_factory=list)
    calls: list[dict] = field(default_factory=list)
    claims: list[dict] = field(default_factory=list)  # what Claude's summaries said about it


_NO_BILL = "\0no-bill"  # can't collide with a real bill id: SAFE_REF has no NUL


def _by_bill(log: list[dict], cfg: config.Config) -> dict[str, _Bill]:
    bills: dict[str, _Bill] = {}
    for e in log:
        tool = str(e.get("tool", ""))
        inp = e.get("input") if isinstance(e.get("input"), dict) else {}
        if tool == GUARD_TOOL:
            bill_id = inp.get("bill_id")
            bills.setdefault(_NO_BILL if bill_id is None else str(bill_id), _Bill()).guards.append(
                e
            )
        elif tool in cfg.payment_tools:
            bill_id = (cfg.payment_args(tool, inp) or {}).get("bill_id")
            bills.setdefault(_NO_BILL if bill_id is None else str(bill_id), _Bill()).calls.append(e)
        elif tool == SUMMARY_TOOL:
            for claim in inp.get("claims") or []:
                if isinstance(claim, dict) and isinstance(claim.get("bill_id"), str):
                    bills.setdefault(claim["bill_id"], _Bill()).claims.append(
                        {**claim, "n": e["n"]}
                    )
    return bills


def _summary_check(seen: _Bill, live: list[dict], match: dict | None) -> dict:
    """Compare what Claude's summaries said about the bill with the records. A summary that
    called it paid needs a payment in the records; one that only called it not paid must not sit
    next to a payment this flow made. Mixed statements (paid, then a refused retry) count as paid.
    """
    if not seen.claims:
        return {"status": "not_checked"}
    said_paid = any(c.get("says") == "paid" for c in seen.claims)
    quotes = [
        {"says": c.get("says"), "quote": c.get("quote"), "log_line": c["n"]} for c in seen.claims
    ]
    if said_paid and not live:
        detail = "Claude's summary says it was paid, but the records hold no payment"
        return {"status": "false_claim", "detail": detail, "claims": quotes}
    if not said_paid and match is not None:
        detail = "Claude's summary says it wasn't paid, but the records show the payment"
        return {"status": "false_claim", "detail": detail, "claims": quotes}
    return {"status": "matches", "claims": quotes}


def _blocking(guard: dict) -> list[dict]:
    checks = guard.get("response", {}).get("checks", [])
    return [c for c in checks if c.get("status") == "block"]


def _duplicate_stop(guard: dict) -> bool:
    """A refusal only because the bill was already paid (C7): the guard doing its job against a
    second payment, not a refusal of the payment that went through."""
    blocking = _blocking(guard)
    return bool(blocking) and all(c.get("id") == "C7" for c in blocking)


def _matches(payment: dict, asked: dict) -> bool:
    # Some records (QuickBooks bill payments) hold no destination account.
    return payment.get("amount_cents") == asked.get("amount_cents") and (
        not payment.get("to_account")
        or _last4(payment.get("to_account")) == _last4(asked.get("to_account"))
    )


def _verdict(
    guards: list[dict], ran: bool, live: list[dict], match: dict | None, extra: int = 0
) -> tuple[str, str]:
    """(verdict, reason) for an intact log, from every guard decision on the bill."""
    if not guards:
        if live:
            return "ISSUES_FOUND", "A payment was made without the guard's checks"
        return "ISSUES_FOUND", "The payment tool ran without the guard's checks"
    if match and extra:
        return "ISSUES_FOUND", (
            f"Paid as approved, but the records also hold {extra} other payment(s) for this bill "
            "that the guard never approved"
        )
    if match:
        reason = "Paid to the supplier's account on file, and the records match"
        if any(_duplicate_stop(g) for g in guards):
            reason += "; a later attempt to pay it again was stopped"
        return "VERIFIED", reason
    refusals = [g for g in guards if g["response"].get("decision") == "deny"]
    real = [g for g in refusals if not _duplicate_stop(g)]
    if live:
        if real:
            last = real[-1]
            why = "; ".join(c.get("title", "") for c in _blocking(last)) or "the checks failed"
            if last["response"].get("mode") == "watch":
                return (
                    "ISSUES_FOUND",
                    f"Paid; in enforce mode Receipts would have stopped it: {why}",
                )
            return "ISSUES_FOUND", f"Paid even though the guard refused it: {why}"
        if refusals and len(refusals) == len(guards):
            return "NOT_PAID", "Already paid before; the attempt to pay it again was stopped"
        return "ISSUES_FOUND", "The records hold a payment that doesn't match what was approved"
    last = guards[-1]
    if last["response"].get("decision") == "deny":
        why = "; ".join(c.get("title", "") for c in _blocking(last)) or "the checks couldn't run"
        if last["response"].get("mode") == "watch":
            return (
                "ISSUES_FOUND",
                f"Not paid; in enforce mode Receipts would have stopped it: {why}",
            )
        return "ISSUES_FOUND", f"Stopped before any money moved: {why}"
    if ran:
        return "ISSUES_FOUND", "The payment tool ran, but the records hold no payment"
    return "NOT_PAID", "The checks passed, but no payment was made"


def _receipt(
    bill_id: str, seen: _Bill, source: Source, cfg: config.Config, status: chain.ChainStatus
) -> dict | None:
    bill = source.bill(bill_id)
    if bill is None:
        return None
    vendor = source.vendor(bill["vendor_id"]) or {}
    order = source.order(bill["order_id"]) if bill.get("order_id") else None
    items = source.order_items(order["id"]) if order else []
    live = [p for p in source.payments_for_bill(bill_id) if p.get("status") != "failed"]
    approved = [g for g in seen.guards if g["response"].get("decision") in ("pass", "ask")]
    match, guard = None, None
    for g in approved:
        match = next((p for p in live if _matches(p, g.get("input", {}))), None)
        if match:
            guard = g
            break
    # Each approval accounts for at most one payment; any payment left over was never approved.
    unclaimed = list(live)
    for g in approved:
        hit = next((p for p in unclaimed if _matches(p, g.get("input", {}))), None)
        if hit is not None:
            unclaimed.remove(hit)
    extra = len(unclaimed) if match else 0
    if guard is None:  # show the latest decision
        guard = seen.guards[-1] if seen.guards else None
    asked = (guard or {}).get("input", {})
    checks = [
        {
            "id": c.get("id"),
            "status": CHECK_STATUS.get(c.get("status"), c.get("status")),
            "title": c.get("title"),
            "evidence": [*c.get("evidence", []), f"log:{guard['n']}"],
        }
        for c in (guard or {}).get("response", {}).get("checks", [])
    ]
    ran = bool(seen.calls)
    if guard and guard["response"].get("decision") != "deny" and (ran or live):
        found = f"Payment {match['id']} is in the records" if match else "No matching payment"
        checks.append(
            {
                "id": "C10",
                "status": "verified" if match else "phantom",
                "title": found + (" with the approved amount and account" if match else ""),
                "evidence": [f"payments:{match['id']}"] if match else [],
            }
        )
    summary = _summary_check(seen, live, match)
    if summary["status"] != "not_checked":
        evidence = [f"log:{c['log_line']}" for c in summary["claims"]]
        if summary["status"] == "false_claim":
            checks.append(
                {
                    "id": "C11",
                    "status": "false_claim",
                    "title": summary["detail"],
                    "evidence": evidence,
                }
            )
        else:
            title = "Claude's summary matches the records"
            checks.append({"id": "C11", "status": "verified", "title": title, "evidence": evidence})
    if status.ok:
        verdict, reason = _verdict(seen.guards, ran, live, match, extra)
        if summary["status"] == "false_claim":
            verdict, reason = "ISSUES_FOUND", f"{summary['detail']}. {reason}"
    else:
        verdict, reason = "UNTRUSTED", "The log was changed after the fact, so it can't be trusted"
    first_block = next((c["id"] for c in checks if c["status"] == "blocked"), None)
    action = None
    if verdict in ("ISSUES_FOUND", "UNTRUSTED"):
        action = NEXT_STEP.get(first_block, "Review this bill before relying on it.")
        action = action.format(vendor=vendor.get("name", "the supplier"))
    paid = match or (live[-1] if live else None)
    return {
        "receipt_version": RECEIPT_VERSION,
        "receipt_id": f"RCPT-{bill_id}",
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "business": cfg.business,
        "verdict": verdict,
        "reason": reason,
        "owner_action": action,
        "bill": {
            "id": bill_id,
            "supplier": vendor.get("name"),
            "from": bill.get("from_addr"),
            "amount_cents": bill.get("amount_cents"),
            "due_date": bill.get("due_date"),
            "order_id": bill.get("order_id"),
        },
        "order": {
            "id": order["id"],
            "date": order.get("order_date"),
            "status": order.get("status"),
            "total_cents": order.get("total_cents"),
            "items": [
                {
                    "name": i.get("name"),
                    "quantity": i.get("quantity"),
                    "unit_price_cents": i.get("unit_price_cents"),
                }
                for i in items
            ],
        }
        if order
        else None,
        "guard": {
            "decision": guard["response"].get("decision") if guard else None,
            "mode": guard["response"].get("mode", "enforce") if guard else None,
            "log_line": guard["n"] if guard else None,
        },
        "payment": {
            "status": "sent" if live else "blocked" if first_block else "not_made",
            "payment_id": paid["id"] if paid else None,
            "amount_cents": asked.get("amount_cents"),
            "to_account": pii.mask_text(str(asked.get("to_account", ""))) or None,
            "account_on_file": pii.mask_text(str(vendor.get("bank_account", ""))) or None,
        },
        "summary_check": summary,
        "checks": checks,
        "log": {
            "ok": status.ok,
            "entries": status.entries,
            "head": status.head,
            "sessions": list(dict.fromkeys(str(e.get("session", "")) for e in seen.guards)),
        },
    }


def build(cfg: config.Config) -> Result:
    """A receipt for every bill the log mentions, plus bill ids the records don't have."""
    result = Result(chain.verify(cfg.log_path), demo=cfg.demo_source)
    source = cfg.open_source()
    try:
        for bill_id, seen in _by_bill(read_log(cfg.log_path), cfg).items():
            if bill_id == _NO_BILL:
                result.no_bill = len(seen.guards) or len(seen.calls)
                continue
            receipt = _receipt(bill_id, seen, source, cfg, result.chain)
            if receipt is None:
                result.unknown_bills.append(bill_id)
            else:
                result.receipts[bill_id] = receipt
    finally:
        close = getattr(source, "close", None)
        if callable(close):
            close()
    return result


def write(out: Path, result: Result) -> list[Path]:
    """Write one receipt per bill, removing receipts from earlier runs so none goes stale."""
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("receipt_*.json"):
        old.unlink()
    written = []
    for bill_id, rc in result.receipts.items():
        safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in bill_id)
        p = out / f"receipt_{safe}.json"
        p.write_text(json.dumps(rc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written.append(p)
    return written


def summary(result: Result) -> list[str]:
    """One line for the log, then one per bill, then one per unknown bill."""
    c = result.chain
    lines = [
        f"Log: intact, {c.entries} entries"
        if c.ok
        else f"Log: BROKEN at line {c.line or c.entries + 1} ({c.error})"
    ]
    for bill_id, rc in result.receipts.items():
        amount = money(rc["bill"]["amount_cents"])
        lines.append(f"{bill_id} ({amount} to {rc['bill']['supplier']}): {rc['verdict']}")
        lines[-1] += f" - {rc['reason']}"
    lines += [
        f"{b}: UNKNOWN - the log names a bill the records don't have" for b in result.unknown_bills
    ]
    if result.no_bill:
        lines.append(f"{result.no_bill} payment(s) named no bill and were refused")
    if result.demo:
        lines.insert(1, f"Note: {config.DEMO_NOTE}.")
    if not result.receipts and not result.unknown_bills and not result.no_bill:
        lines.append("No payments in the log yet.")
    return lines
