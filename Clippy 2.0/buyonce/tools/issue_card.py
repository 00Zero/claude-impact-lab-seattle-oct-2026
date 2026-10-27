#!/usr/bin/env python3
"""Create a single-use, spend-capped Stripe Issuing virtual card (TEST MODE ONLY).

Why: even if the agent gets it wrong, the card cannot pay more than the approved total.

Safety design:
  * Dry-run by default. Nothing is sent unless you pass --execute.
  * Refuses any key that is not a Stripe *test* key (sk_test_ / rk_test_).
  * Never prints the card number or CVC. It prints id, last4, status and the cap only.
    Card details are handed to the checkout by the owner (or a password manager), not by the agent.

Requires a Stripe account with Issuing enabled and an existing cardholder (ich_...).
Not yet verified against a live Stripe account; see docs/SAFETY.md.

    python3 tools/issue_card.py --amount 394.00 --order-id bo_1234 --cardholder ich_123
    STRIPE_SECRET_KEY=sk_test_... python3 tools/issue_card.py --amount 394.00 \
        --order-id bo_1234 --cardholder ich_123 --execute
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal

API = "https://api.stripe.com/v1"


def assert_test_key(key: str | None) -> str:
    if not key:
        raise SystemExit("Set STRIPE_SECRET_KEY to a Stripe test key (sk_test_... or rk_test_...).")
    if not key.startswith(("sk_test_", "rk_test_")):
        raise SystemExit("Refusing: only Stripe TEST keys are allowed in this version.")
    return key


def build_params(amount, order_id: str, cardholder: str, currency: str = "usd") -> dict:
    cents = int((Decimal(str(amount)) * 100).to_integral_value())
    if cents <= 0:
        raise ValueError("amount must be positive")
    return {
        "cardholder": cardholder,
        "currency": currency,
        "type": "virtual",
        "status": "active",
        "spending_controls[spending_limits][0][amount]": str(cents),
        "spending_controls[spending_limits][0][interval]": "all_time",
        "metadata[buyonce_order]": order_id,
    }


def _post(path: str, params: dict, key: str, idempotency_key: str | None = None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}", data=urllib.parse.urlencode(params).encode(), method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/x-www-form-urlencoded"},
    )
    if idempotency_key:
        req.add_header("Idempotency-Key", idempotency_key)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as err:
        detail = json.load(err).get("error", {}).get("message", err.reason)
        raise SystemExit(f"Stripe error {err.code}: {detail}")


def create_card(params: dict, key: str, order_id: str) -> dict:
    card = _post("/issuing/cards", params, assert_test_key(key), idempotency_key=f"buyonce-{order_id}")
    return {k: card.get(k) for k in ("id", "last4", "status", "currency")} | {
        "cap_cents": params["spending_controls[spending_limits][0][amount]"]}


def cancel_card(card_id: str, key: str) -> dict:
    card = _post(f"/issuing/cards/{card_id}", {"status": "canceled"}, assert_test_key(key))
    return {"id": card.get("id"), "status": card.get("status")}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_mutually_exclusive_group(required=True)
    sub.add_argument("--amount", help="spending cap in dollars (use decision['card_limit'] from gate.py)")
    sub.add_argument("--cancel", metavar="CARD_ID", help="cancel a card after the order is done")
    ap.add_argument("--order-id", default="manual")
    ap.add_argument("--cardholder", help="Stripe cardholder id, ich_...")
    ap.add_argument("--execute", action="store_true", help="actually call Stripe (test mode)")
    args = ap.parse_args(argv)

    if args.cancel:
        if not args.execute:
            print(f"[dry-run] would cancel {args.cancel}")
            return 0
        print(json.dumps(cancel_card(args.cancel, os.environ.get("STRIPE_SECRET_KEY")), indent=2))
        return 0

    if not args.cardholder:
        ap.error("--cardholder is required")
    params = build_params(args.amount, args.order_id, args.cardholder)
    if not args.execute:
        print("[dry-run] would POST /v1/issuing/cards with:")
        print(json.dumps(params, indent=2))
        return 0
    print(json.dumps(create_card(params, os.environ.get("STRIPE_SECRET_KEY"), args.order_id), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
