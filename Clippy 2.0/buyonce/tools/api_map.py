#!/usr/bin/env python3
"""Show how a recorded browser workflow collapses into API calls.

  python3 tools/api_map.py examples/recorded-skill-3-retailers/SKILL.md

Reads a recorded skill (via preflight), groups the quote steps by retailer site, and says which retailers one
Zinc call can cover (Zinc searches and orders across many retailers). Sites Zinc does not cover stay browser steps.
Prints a plan only; it does not call anything.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import preflight  # noqa: E402

# Retailers Zinc names on its site (zinc.com/blog/buy-products-online-with-ai, 2026-10-25). Not exhaustive.
ZINC_RETAILERS = {"amazon.com": "Amazon", "walmart.com": "Walmart", "target.com": "Target"}
HOST = re.compile(r"https?://[^\s/,;:)]*[^\s/.,;:!?)]")
COMPARE = re.compile(r"\bcompare\b", re.I)


def retailer(host: str):
    host = host.lower().removeprefix("www.")
    return next((n for d, n in ZINC_RETAILERS.items() if host == d or host.endswith("." + d)), None)


def build(plan: dict) -> dict:
    groups, current, quote_steps = {}, None, [s for s in plan["steps"] if s["phase"] == "quote"]
    for st in quote_steps:
        m = HOST.search(st["text"])
        if m:
            current = m.group(0).split("//", 1)[1].lower()
            groups.setdefault(current, [])
        if current and not COMPARE.search(st["text"]):
            groups[current].append(st["n"])
    covered = {h: retailer(h) for h in groups}
    zinc_hosts = [h for h, n in covered.items() if n]
    steps_replaced = sorted(n for h in zinc_hosts for n in groups[h])
    return {"sites": covered, "zinc_covers": [covered[h] for h in zinc_hosts],
            "browser_only": [h for h, n in covered.items() if not n], "steps_replaced": steps_replaced,
            "compare_steps": [s["n"] for s in quote_steps if COMPARE.search(s["text"])]}


def render(plan: dict, m: dict) -> str:
    n = len(m["steps_replaced"])
    out = [f"Recorded skill: {plan['name']}", "",
           f"The owner visits {len(m['sites'])} sites by hand ({n} steps of searching and note-taking):"]
    out += [f"  {h:<22} -> {'Zinc covers ' + r if r else 'NOT covered by Zinc: stays a browser step'}"
            for h, r in m["sites"].items()]
    if m["zinc_covers"]:
        out += ["", f"One Zinc call replaces steps {m['steps_replaced'][0]}-{m['steps_replaced'][-1]} (the per-site searching):",
                f"  cross-retailer search for {{item}} -> price, shipping, delivery from {', '.join(m['zinc_covers'])}",
                f"  the owner's compare step ({', '.join(map(str, m['compare_steps']))}) becomes BuyOnce's compare engine, using the owner's rules",
                "  then ONE order call (max_price = approved limit) places it at the winner",
                "  the card, address and 'place order' clicks disappear: there is no checkout page to drive"]
    if m["browser_only"]:
        out += ["", "Still browser steps: " + ", ".join(m["browser_only"])]
    return "\n".join(out)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("skill")
    a = ap.parse_args(argv)
    plan = preflight.parse_skill(Path(a.skill).read_text(encoding="utf-8"), a.skill)
    print(render(plan, build(plan)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
