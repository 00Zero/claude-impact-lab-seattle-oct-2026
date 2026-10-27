#!/usr/bin/env python3
"""Place an approved BuyOnce run through the Zinc API (sandbox by default).

  python3 tools/api_order.py mint [--email you@x.com]      get a free sandbox key (no account), saved to data/zinc.key
  python3 tools/api_order.py place --run data/run.json --product-url URL --address examples/address.sandbox.json
  python3 tools/api_order.py status ORDER_ID

`place` only works after the run controller has an approval for the order (executor.py approve).
"""
from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from core import load_policy, project_root  # noqa: E402
import executor  # noqa: E402
import zinc  # noqa: E402


def cents(dollars) -> int:
    return int((Decimal(str(dollars)) * 100).to_integral_value())


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("mint"); m.add_argument("--email")
    p = sub.add_parser("place")
    p.add_argument("--run", default="data/run.json"); p.add_argument("--product-url", required=True)
    p.add_argument("--address", required=True); p.add_argument("--qty", type=int)
    s = sub.add_parser("status"); s.add_argument("order_id")
    pl = sub.add_parser("plan", help="print the exact request body for an approved run (for a relay that can reach the API)")
    pl.add_argument("--run", default="data/run.json"); pl.add_argument("--product-url", required=True)
    pl.add_argument("--address", required=True); pl.add_argument("--qty", type=int)
    rc = sub.add_parser("record", help="record a response that a relay got from the API for an approved run")
    rc.add_argument("--run", default="data/run.json"); rc.add_argument("--response", required=True)
    rc.add_argument("--request", required=True, help="the plan JSON that was sent")
    args = ap.parse_args(argv)
    root = project_root()
    try:
        if args.cmd == "mint":
            out = zinc.mint_key(email=args.email)
            path = zinc.save_key(root, out["api_key"])
            print(json.dumps({"saved_to": str(path), "claim_url": out.get("claim_url"),
                              "note": "keep claim_url: it is shown once and lets a human take over this sandbox"}, indent=2))
            return 0
        if args.cmd == "status":
            print(json.dumps(zinc.Zinc(zinc.load_key(root), allow_live=True).get_order(args.order_id), indent=2))
            return 0
        ex = executor.Executor(args.run)
        run = ex.run
        if args.cmd == "plan":
            if run["state"] != "executing" or not run["approval"]:
                raise executor.ExecError(f"no approved order to send (state is {run['state']})")
            qty = args.qty or int(run["request"].get("qty") or 1)
            print(json.dumps({"products": [{"url": args.product_url, "quantity": qty}],
                              "shipping_address": json.loads(Path(args.address).read_text()),
                              "max_price": cents(run["card_limit"]), "idempotency_key": run["order_id"]}))
            return 0
        if args.cmd == "record":
            sent = json.loads(Path(args.request).read_text())
            got = json.loads(Path(args.response).read_text())
            if sent.get("idempotency_key") != run["order_id"] or sent.get("max_price") != cents(run["card_limit"]):
                raise executor.ExecError("the request that was sent does not match the approved order")
            def place(order_id, card_limit):
                cents_total = ((got.get("job_result") or {}).get("price_components") or {}).get("total")
                return {"order_id": got.get("id") or got.get("order_id"), "status": got.get("status"),
                        "merchant_order_id": (got.get("merchant_order_ids") or [None])[0],
                        "total": f"{Decimal(cents_total) / 100:.2f}" if cents_total is not None else None,
                        "relay": True}
            print(json.dumps(ex.execute_via_api(place), indent=2, default=str))
            return 0
        policy = load_policy(run["policy_path"])
        client = zinc.Zinc(zinc.load_key(root), allow_live=bool(policy.get("api", {}).get("allow_live", False)))
        address = json.loads(Path(args.address).read_text())
        qty = args.qty or int(run["request"].get("qty") or 1)

        def place(order_id, card_limit):
            o = client.create_order(args.product_url, qty, address, cents(card_limit), idempotency_key=order_id)
            return {"order_id": o.get("id") or o.get("order_id"), "status": o.get("status"),
                    "total": None, "live": client.live}

        print(json.dumps(ex.execute_via_api(place), indent=2, default=str))
        return 0
    except (zinc.ZincError, executor.ExecError, KeyError) as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
