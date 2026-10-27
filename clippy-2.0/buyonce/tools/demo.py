#!/usr/bin/env python3
"""End-to-end demo with sample data. No installs, no accounts, no network.

    python3 tools/demo.py            # asks you to approve at the gate
    python3 tools/demo.py --yes      # approves automatically (CI / screenshots)
    python3 tools/demo.py --decline  # shows the 'no' path
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

import compare
import gate
import issue_card
from core import card_limit, fmt, load_json, load_policy, parse_date, project_root


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--yes", action="store_true", help="approve without prompting")
    ap.add_argument("--decline", action="store_true", help="decline without prompting")
    ap.add_argument("--keep-audit", action="store_true", help="write audit log to data/ instead of a temp file")
    args = ap.parse_args(argv)

    root = project_root()
    policy = load_policy(root / "policy" / "policy.example.toml")
    quotes = load_json(root / "examples" / "quotes.flour.json")
    context = load_json(root / "examples" / "context.example.json")
    request = {"item": "bread flour 50lb", "qty": quotes[0]["qty"], "category": "supplies", "need_by": "2026-10-30"}

    print("STEP 1  The owner said: \"We're almost out of bread flour. Reorder 10 bags by Friday.\"\n")
    print("STEP 2  BuyOnce pulls context from the owner's systems (mock data here):")
    print(f"        budget (accounting): {fmt(context['budget']['supplies']['monthly'] - context['budget']['supplies']['spent'])} left in supplies")
    print(f"        inventory (shop system): {context['inventory']['bread flour 50lb']['on_hand']} bags on hand\n")

    result = compare.evaluate(quotes, policy, request, context, parse_date("2026-10-25"))
    print("STEP 3  Compare quotes against the owner's policy\n")
    print(compare.render(result), "\n")

    audit_path = (root / "data" / "audit.jsonl") if args.keep_audit else Path(tempfile.mkdtemp()) / "audit.jsonl"
    decision = gate.decide(result, policy)
    print("STEP 4  Approval gate\n")
    print(gate.approval_card(result, decision), "\n")
    gate.audit(audit_path, "presented", decision, result["recommendation"])

    if decision["decision"] == "blocked":
        return 20
    if args.yes:
        answer = "y"
    elif args.decline:
        answer = "n"
    elif sys.stdin.isatty():
        answer = input('Approve this order? [y/N] ').strip().lower()
    else:
        print("(not a terminal: pass --yes or --decline) Nothing was bought.")
        return 10

    if answer not in ("y", "yes", "approve"):
        gate.audit(audit_path, "declined", decision, result["recommendation"])
        print("\nDeclined. Nothing was bought.")
        return 0

    gate.audit(audit_path, "approved", decision, result["recommendation"])
    print("\nSTEP 5  Approved. Single-use card (dry run, Stripe test mode):")
    params = issue_card.build_params(decision["card_limit"], decision["order_id"], "ich_EXAMPLE")
    print(json.dumps(params, indent=2))
    print("\nSTEP 6  The vendor skill now drives the browser to checkout and stops at the payment page.")
    print("        The owner (or their password manager) enters card details. The agent never sees them.")
    print(f"\nAudit trail ({audit_path}):")
    print(Path(audit_path).read_text(), end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
