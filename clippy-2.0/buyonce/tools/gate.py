#!/usr/bin/env python3
"""The approval gate: decide whether the agent may proceed, and show the owner a card.

Exit codes: 0 = auto-approved by policy, 10 = needs the owner's approval, 20 = blocked.

    python3 tools/gate.py --result data/result.json --policy policy/policy.toml
    python3 tools/gate.py --result data/result.json --policy policy/policy.toml --approve
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from core import card_limit, fmt, load_json, load_policy, project_root, with_defaults

EXIT = {"auto": 0, "needs_approval": 10, "blocked": 20}


def _D(value) -> Decimal:
    return Decimal(str(value))


def order_id(rec: dict) -> str:
    raw = f"{rec['vendor']}|{rec.get('item')}|{rec['qty']}|{rec['total']}|{rec['delivery_date']}"
    return "bo_" + hashlib.sha1(raw.encode()).hexdigest()[:10]


def decide(result: dict, policy: dict) -> dict:
    policy = with_defaults(policy)
    rec = result.get("recommendation")
    if not rec:
        return {"decision": "blocked", "reasons": ["no quote meets your rules"], "order_id": None}

    total = _D(rec["total"])
    spend = policy["spending"]
    if total > _D(spend["hard_cap"]):
        return {"decision": "blocked", "order_id": order_id(rec),
                "reasons": [f"{fmt(total)} is over the {fmt(spend['hard_cap'])} per-order cap"]}

    reasons = list(rec.get("flags", []))
    if not spend["allow_auto_approve"]:
        reasons.insert(0, "your policy asks for approval on every order")
    elif total >= _D(spend["auto_approve_under"]):
        reasons.insert(0, f"{fmt(total)} is at or above your {fmt(spend['auto_approve_under'])} auto-approve limit")

    return {
        "decision": "needs_approval" if reasons else "auto",
        "reasons": reasons,
        "order_id": order_id(rec),
        "card_limit": str(card_limit(total, spend["card_buffer_pct"])),
    }


def approval_card(result: dict, decision: dict) -> str:
    rec = result["recommendation"]
    width = 62
    rows = [
        f"Buy:      {rec['qty']} x {rec.get('item')}",
        f"From:     {rec['vendor']}",
        f"Total:    {fmt(rec['total'])}  (items {fmt(rec['subtotal'])}, shipping {fmt(rec['shipping'])}, tax {fmt(rec['tax'])})",
        f"Arrives:  {rec['delivery_date']}",
        f"Card cap: {fmt(decision['card_limit'])} single-use (test mode)" if decision.get("card_limit") else "",
        "",
        "Why this one:",
        *[f"  - {line}" for line in result.get("explanation", [])],
    ]
    if decision["reasons"]:
        rows += ["", "Why I'm asking:", *[f"  - {r}" for r in decision["reasons"]]]
    rows += ["", 'Reply "approve" to place it, or tell me what to change.']
    title = " APPROVAL NEEDED " if decision["decision"] == "needs_approval" else " ORDER READY "
    return "\n".join(["+" + title.center(width, "-") + "+", *[r for r in rows if r is not None], "+" + "-" * width + "+"])


def audit(path, event: str, decision: dict, rec: dict | None, note: str = "") -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    line = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": event, "order_id": decision.get("order_id"),
        "vendor": rec["vendor"] if rec else None,
        "total": str(rec["total"]) if rec else None,
        "decision": decision["decision"], "note": note,
    }
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(line) + "\n")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--result", required=True, help="result JSON from compare.py --out")
    ap.add_argument("--policy", required=True)
    ap.add_argument("--audit", default=str(project_root() / "data" / "audit.jsonl"))
    grp = ap.add_mutually_exclusive_group()
    grp.add_argument("--approve", action="store_true", help="record the owner's approval")
    grp.add_argument("--decline", action="store_true", help="record that the owner declined")
    ap.add_argument("--note", default="", help="free text saved to the audit log")
    args = ap.parse_args(argv)

    result = load_json(args.result)
    decision = decide(result, load_policy(args.policy))
    rec = result.get("recommendation")

    if decision["decision"] == "blocked":
        print("BLOCKED: " + "; ".join(decision["reasons"]))
        audit(args.audit, "blocked", decision, rec, args.note)
        return EXIT["blocked"]

    if args.approve:
        audit(args.audit, "approved", decision, rec, args.note)
        print(f"Approval recorded for {decision['order_id']} ({fmt(rec['total'])} from {rec['vendor']}).")
        return 0
    if args.decline:
        audit(args.audit, "declined", decision, rec, args.note)
        print(f"Decline recorded for {decision['order_id']}. Nothing was bought.")
        return 0

    print(approval_card(result, decision))
    audit(args.audit, "presented", decision, rec, args.note)
    return EXIT[decision["decision"]]


if __name__ == "__main__":
    sys.exit(main())
