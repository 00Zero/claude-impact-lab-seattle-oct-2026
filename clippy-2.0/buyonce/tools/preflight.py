#!/usr/bin/env python3
"""Preflight: read ANY purchasing skill (a SKILL.md) and work out what a run needs.

The skill may come from our template or from someone else's recorder, so nothing here
requires a fixed layout. We read numbered steps, sort them into phases, and find the one
step where money changes hands (the transaction boundary).

    python3 tools/preflight.py skills/saucedemo-buy/SKILL.md
    python3 tools/preflight.py examples/assumed-skill/SKILL.md --json

What it works out:
  * start URL and the hosts the skill touches
  * parameters ({item}, {qty}, ...)
  * each step's phase: quote (safe, reads only) / cart / checkout / boundary / post
  * the transaction boundary: the step the agent must NEVER do on its own on a real site
  * steps only the owner may do (sign-in, anything with passwords or card details)
  * problems: no boundary, secrets in the file, steps after the boundary, and so on
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from lint_skill import SECRET_PATTERNS, _card_numbers, parse_frontmatter

PHASES = ["quote", "cart", "checkout"]
URL_RE = re.compile(r"https?://[^\s)>\]\"'`]*[^\s)>\]\"'`.,;:!?]")
STEP_RE = re.compile(r"^\s*(\d+)[.)]\s+(.+)$")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
SKIP_SECTION = re.compile(
    r"stop|verif|quirk|recover|before you start|parameter|goal|source|rules|safety|troubleshoot|when things|note",
    re.I)

# The step where money changes hands. Only looked for once the cart phase has started.
BOUNDARY_RE = re.compile(
    r"\b(place|submit|confirm|complete|finali[sz]e)\b.{0,20}\b(order|purchase|payment)\b"
    r"|\bpay(ment)?\b|\bbuy now\b|\bfinish\b|\bcard\b.{0,30}\b(charged|number|details)\b",
    re.I)
# Steps a person must do: signing in, passwords, card or bank details.
OWNER_RE = re.compile(
    r"sign[ -]?in|log[ -]?in|password|passcode|2fa|two-factor|one-time|captcha"
    r"|card number|cvv|cvc|security code|enter.{0,20}(card|bank|payment)",
    re.I)

_CART = re.compile(r"add(ed|ing)?\b.{0,40}\b(cart|basket|bag)\b|\b(open|view|go to)\b.{0,15}\bcart\b", re.I)
_CHECKOUT = re.compile(
    r"\bcheck ?out\b|shipping address|saved address|billing|delivery (option|method)|payment method"
    r"|\bplace\b|\bsubmit\b|\bfinish\b", re.I)
_QUOTE = re.compile(r"price|quote|cost|total|delivery date|stock|search|find|read|record|sort|quantity|qty", re.I)


def heading_phase(heading: str):
    h = heading.lower()
    if re.search(r"quote|price|compar", h):
        return "quote"
    if re.search(r"cart|basket", h):
        return "cart"
    if re.search(r"check ?out|payment|place order", h):
        return "checkout"
    return None


def infer_phase(text: str):
    if _CART.search(text):
        return 1
    if _CHECKOUT.search(text):
        return 2
    if _QUOTE.search(text):
        return 0
    return None


def _table_rows(lines):
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip().strip("`") for c in line.strip("|").split("|")]
        if not cells or set("".join(cells)) <= set("-: ") or cells[0].lower() in ("name", "parameter"):
            continue
        yield cells


def parse_skill(text: str, source: str = "<skill>") -> dict:
    meta, body = parse_frontmatter(text)
    warnings: list[str] = []
    errors: list[str] = []

    # ---- steps and parameters -------------------------------------------------
    steps: list[dict] = []
    param_lines: list[str] = []
    heading, explicit, in_params = "", None, False
    for line in body.splitlines():
        m = HEADING_RE.match(line)
        if m:
            heading = m.group(2)
            explicit = heading_phase(heading)
            in_params = bool(re.search(r"parameter", heading, re.I))
            continue
        if in_params:
            param_lines.append(line)
        if explicit is None and SKIP_SECTION.search(heading):
            continue
        s = STEP_RE.match(line)
        if s:
            steps.append({"n": len(steps) + 1, "label": s.group(1), "text": s.group(2).strip(),
                          "explicit": explicit})

    # ---- phases and the transaction boundary --------------------------------------
    cur, boundary_i = 0, None
    for i, st in enumerate(steps):
        target = PHASES.index(st["explicit"]) if st["explicit"] else infer_phase(st["text"])
        if target is not None:
            cur = max(cur, target)
        st["phase"] = PHASES[cur]
        if boundary_i is None and cur >= 1 and BOUNDARY_RE.search(st["text"]):
            boundary_i = i
    inferred_boundary = False
    if steps and boundary_i is None:
        boundary_i = len(steps) - 1
        inferred_boundary = True
        warnings.append("no transaction boundary found; treating the LAST step as the boundary "
                        "(the executor will stop before it unless the site is a listed sandbox)")
    for i, st in enumerate(steps):
        if boundary_i is not None:
            if i == boundary_i:
                st["phase"] = "boundary"
            elif i > boundary_i:
                st["phase"] = "post"
        no_urls = URL_RE.sub("", st["text"])
        st["boundary"] = st["phase"] == "boundary"
        st["owner_only"] = bool(OWNER_RE.search(no_urls)) and st["phase"] != "post"
        st.pop("explicit")

    post = [s for s in steps if s["phase"] == "post"]
    if post:
        warnings.append(f"{len(post)} step(s) come after the transaction boundary and will not be run "
                        f"(step {post[0]['n']} onward)")
    for s in steps:
        if s["owner_only"] and s["phase"] != "boundary":
            warnings.append(f"step {s['n']} involves signing in or sensitive details: the owner does it")
    if not steps:
        errors.append("no numbered steps found: nothing to run")
    if steps and not any(s["phase"] == "quote" for s in steps):
        warnings.append("no quote steps: quotes must come from somewhere else (email, PDF, another skill)")

    # ---- urls, hosts, parameters ------------------------------------------------------
    urls = URL_RE.findall(body)
    hosts = sorted({urlparse(u).netloc.lower() for u in urls if urlparse(u).netloc})
    start_url = next((u.rstrip(".,") for u in urls), None)
    if not start_url:
        warnings.append("no URL found: the agent will not know where to start")
    placeholders = sorted(set(re.findall(r"\{(\w+)\}", body)))
    parameters = [{"name": c[0], "example": c[1] if len(c) > 1 else "", "notes": c[2] if len(c) > 2 else ""}
                  for c in _table_rows(param_lines)]
    declared = {p["name"] for p in parameters}
    for ph in placeholders:
        if ph not in declared:
            parameters.append({"name": ph, "example": "", "notes": "from a {placeholder} in the steps"})

    # ---- secrets ----------------------------------------------------------------------
    for label, pattern in SECRET_PATTERNS.items():
        if pattern.search(text):
            errors.append(f"skill contains what looks like a {label}; remove it before running")
    for masked in _card_numbers(text):
        errors.append(f"skill contains what looks like a card number ({masked}); remove it before running")

    counts = {p: sum(1 for s in steps if s["phase"] == p) for p in PHASES + ["boundary", "post"]}
    boundary = next(({"n": s["n"], "text": s["text"]} for s in steps if s["boundary"]), None)
    return {
        "source": source, "name": meta.get("name") or Path(source).parent.name,
        "description": meta.get("description", ""), "start_url": start_url, "hosts": hosts,
        "parameters": parameters, "placeholders": placeholders, "steps": steps, "counts": counts,
        "boundary": boundary, "inferred_boundary": inferred_boundary,
        "warnings": warnings, "errors": errors, "ready": not errors,
    }


def render(plan: dict) -> str:
    out = [f"Skill: {plan['name']}   ({plan['source']})",
           f"Start:  {plan['start_url'] or '(none found)'}   hosts: {', '.join(plan['hosts']) or '-'}",
           "Params: " + (", ".join(p["name"] for p in plan["parameters"]) or "-"), ""]
    marks = {"quote": "Q", "cart": "C", "checkout": "K", "boundary": "$", "post": "x"}
    for s in plan["steps"]:
        flag = " [owner only]" if s["owner_only"] else ""
        out.append(f"  {s['n']:>2} {marks[s['phase']]} {s['phase']:<9} {s['text'][:90]}{flag}")
    out += ["", "Legend: Q quote (reads only)  C cart  K checkout  $ transaction boundary  x never run", ""]
    b = plan["boundary"]
    out.append(f"Transaction boundary: step {b['n']} ({'inferred' if plan['inferred_boundary'] else 'found'})"
               if b else "Transaction boundary: none")
    out += [f"  WARNING: {w}" for w in plan["warnings"]]
    out += [f"  ERROR: {e}" for e in plan["errors"]]
    out.append("READY" if plan["ready"] else "NOT READY")
    return "\n".join(out)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("skill", help="path to a SKILL.md")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    path = Path(args.skill)
    plan = parse_skill(path.read_text(encoding="utf-8"), source=str(path))
    print(json.dumps(plan, indent=2) if args.json else render(plan))
    return 0 if plan["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
