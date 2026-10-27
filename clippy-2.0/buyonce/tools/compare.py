#!/usr/bin/env python3
"""Rank vendor quotes against the owner's policy and explain the pick.

Starts with price, but never *only* price: landed cost (items + shipping + tax),
delivery vs. deadline, vendor rating, vendor history, budget, and inventory cover.

    python3 tools/compare.py --quotes examples/quotes.flour.json \
        --policy policy/policy.example.toml --context examples/context.example.json \
        --item "bread flour 50lb" --category supplies --need-by 2026-10-30 --today 2026-10-25
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from decimal import Decimal

from core import fmt, landed_cost, load_json, load_policy, money, parse_date, with_defaults


def _known_vendor(quote: dict, policy: dict) -> bool:
    approved = {v.lower() for v in policy["vendors"]["approved"]}
    return quote["vendor"].lower() in approved or int(quote.get("past_orders", 0)) > 0


def _reliability(quote: dict, policy: dict) -> float:
    rating = quote.get("vendor_rating")
    base = (float(rating) / 5.0) if rating is not None else 0.7
    if not policy["vendors"]["prefer_past_vendors"]:
        return base
    history = min(int(quote.get("past_orders", 0)), 5) / 5.0
    return base * 0.8 + history * 0.2


def _budget_note(total: Decimal, category: str | None, context: dict) -> dict | None:
    if not category:
        return None
    entry = (context.get("budget") or {}).get(category)
    if not entry:
        return None
    remaining = money(Decimal(str(entry["monthly"])) - Decimal(str(entry["spent"])))
    return {
        "category": category,
        "remaining": remaining,
        "over_by": max(Decimal("0.00"), money(total - remaining)),
    }


def evaluate(quotes: list, policy: dict, request: dict, context: dict | None = None,
             today: date | None = None) -> dict:
    policy = with_defaults(policy)
    context = context or {}
    today = today or date.today()
    need_by = parse_date(request["need_by"]) if request.get("need_by") else None
    blocked = {v.lower() for v in policy["vendors"]["blocked"]}
    hard_cap = Decimal(str(policy["spending"]["hard_cap"]))

    options = []
    for q in quotes:
        cost = landed_cost(q)
        arrive = parse_date(q["delivery_date"])
        days = (arrive - today).days
        why_not = []
        if q["vendor"].lower() in blocked:
            why_not.append("vendor is on your blocked list")
        rating = q.get("vendor_rating")
        if rating is not None and float(rating) < float(policy["quality"]["min_rating"]):
            why_not.append(f"rated {rating}, below your minimum of {policy['quality']['min_rating']}")
        if need_by and arrive > need_by:
            why_not.append(f"arrives {arrive:%b %d}, after your {need_by:%b %d} deadline")
        elif not need_by and days > int(policy["delivery"]["max_days"]):
            why_not.append(f"takes {days} days, over your {policy['delivery']['max_days']}-day limit")
        if cost["total"] > hard_cap:
            why_not.append(f"{fmt(cost['total'])} is over your {fmt(hard_cap)} per-order cap")
        if q.get("in_stock", True) is False:
            why_not.append("out of stock")

        flags = []
        if not _known_vendor(q, policy):
            flags.append("new vendor (no past orders, not on approved list)")
        budget = _budget_note(cost["total"], request.get("category"), context)
        if budget and budget["over_by"] > 0:
            flags.append(
                f"over your {budget['category']} budget by {fmt(budget['over_by'])} "
                f"({fmt(budget['remaining'])} left this month)"
            )
        options.append({
            "vendor": q["vendor"], "item": q.get("item", request.get("item")),
            "qty": int(q["qty"]), "url": q.get("url"),
            **{k: cost[k] for k in ("unit_price", "subtotal", "shipping", "tax", "total")},
            "delivery_date": arrive.isoformat(), "days": days,
            "vendor_rating": rating, "past_orders": int(q.get("past_orders", 0)),
            "excluded": why_not, "flags": flags,
        })

    eligible = [o for o in options if not o["excluded"]]
    weights = policy["scoring"]
    if eligible:
        min_total = min(o["total"] for o in eligible)
        min_days = min(max(o["days"], 0) for o in eligible)
        src = {q["vendor"]: q for q in quotes}
        for o in eligible:
            parts = {
                "price": float(min_total / o["total"]),
                "speed": (min_days + 1) / (max(o["days"], 0) + 1),
                "reliability": _reliability(src[o["vendor"]], policy),
            }
            o["score"] = round(sum(weights[k] * parts[k] for k in parts) / sum(weights.values()), 4)
            o["score_parts"] = {k: round(v, 3) for k, v in parts.items()}
        eligible.sort(key=lambda o: (-o["score"], o["total"]))

    result = {
        "request": request,
        "business": policy["business"]["name"],
        "eligible": eligible,
        "excluded": [o for o in options if o["excluded"]],
        "recommendation": eligible[0] if eligible else None,
        "cheapest_overall": min(options, key=lambda o: o["total"]) if options else None,
    }
    result["explanation"] = explain(result, context)
    return result


def explain(result: dict, context: dict) -> list:
    lines = []
    pick, cheapest = result["recommendation"], result["cheapest_overall"]
    if not pick:
        lines.append("No quote meets your rules. Nothing was recommended.")
        for o in result["excluded"]:
            lines.append(f"{o['vendor']}: " + "; ".join(o["excluded"]))
        return lines

    if cheapest["vendor"] == pick["vendor"]:
        lines.append(f"{pick['vendor']} is the best price ({fmt(pick['total'])} delivered) "
                     "among options that meet your rules.")
    elif cheapest["excluded"]:
        lines.append(
            f"{cheapest['vendor']} has the lowest price ({fmt(cheapest['total'])}) but was skipped: "
            + "; ".join(cheapest["excluded"]) + "."
        )
        lines.append(f"{pick['vendor']} is the best of the rest at {fmt(pick['total'])} delivered.")
    else:
        extra = money(pick["total"] - cheapest["total"])
        lines.append(
            f"{pick['vendor']} costs {fmt(extra)} more than {cheapest['vendor']} but scores higher on "
            "delivery and reliability for your priorities."
        )

    others = [o for o in result["eligible"] if o["vendor"] != pick["vendor"]]
    if others:
        worst = max(others, key=lambda o: o["total"])
        if worst["total"] > pick["total"]:
            lines.append(f"That is {fmt(worst['total'] - pick['total'])} less than {worst['vendor']}.")
    lines.append(f"Arrives {pick['delivery_date']} ({pick['days']} days).")

    item = (result["request"].get("item") or "").lower()
    stock = next((v for k, v in (context.get("inventory") or {}).items() if k.lower() == item), None)
    if stock and stock.get("weekly_usage"):
        weeks = Decimal(str(stock["on_hand"])) / Decimal(str(stock["weekly_usage"]))
        lines.append(f"You have {stock['on_hand']} on hand and use about {stock['weekly_usage']} a week "
                     f"({weeks:.1f} weeks of cover).")
    return lines


def render(result: dict) -> str:
    out = []
    req = result["request"]
    out.append(f"BuyOnce comparison for {result['business']}: {req.get('qty', '?')} x {req.get('item')}")
    out.append("")
    pick = result["recommendation"]
    if pick:
        out.append(f"RECOMMENDED: {pick['vendor']}  {fmt(pick['total'])} delivered "
                   f"(items {fmt(pick['subtotal'])} + shipping {fmt(pick['shipping'])} + tax {fmt(pick['tax'])})")
    out.append("")
    out.append("Why:")
    out.extend(f"  - {line}" for line in result["explanation"])
    if result["eligible"]:
        out.append("")
        out.append("Ranking (eligible):")
        for i, o in enumerate(result["eligible"], 1):
            note = f"  [{'; '.join(o['flags'])}]" if o["flags"] else ""
            out.append(f"  {i}. {o['vendor']:<20} {fmt(o['total']):>10}  score {o['score']:.3f}{note}")
    if result["excluded"]:
        out.append("")
        out.append("Skipped:")
        for o in result["excluded"]:
            out.append(f"  x {o['vendor']:<20} {fmt(o['total']):>10}  {'; '.join(o['excluded'])}")
    return "\n".join(out)


def _default(obj):
    if isinstance(obj, Decimal):
        return str(obj)
    raise TypeError(type(obj))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quotes", required=True, help="JSON list of vendor quotes")
    ap.add_argument("--policy", required=True, help="policy TOML")
    ap.add_argument("--context", help="JSON with budget/inventory from your systems")
    ap.add_argument("--item", help="what you are buying (matches inventory context)")
    ap.add_argument("--category", help="budget category, e.g. supplies")
    ap.add_argument("--need-by", help="deadline, YYYY-MM-DD")
    ap.add_argument("--today", help="override today's date (for repeatable demos)")
    ap.add_argument("--out", help="write full result JSON here (feed it to gate.py)")
    ap.add_argument("--json", action="store_true", help="print JSON instead of text")
    args = ap.parse_args(argv)

    quotes = load_json(args.quotes)
    request = {"item": args.item or (quotes[0].get("item") if quotes else None),
               "qty": quotes[0]["qty"] if quotes else None,
               "category": args.category, "need_by": args.need_by}
    result = evaluate(quotes, load_policy(args.policy), request,
                      load_json(args.context) if args.context else {},
                      parse_date(args.today) if args.today else None)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(result, handle, indent=2, default=_default)
    print(json.dumps(result, indent=2, default=_default) if args.json else render(result))
    return 0 if result["recommendation"] else 2


if __name__ == "__main__":
    sys.exit(main())
