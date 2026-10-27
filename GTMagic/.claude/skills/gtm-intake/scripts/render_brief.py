#!/usr/bin/env python3
"""Render the owner-facing brief.md from intake.json: render_brief.py <intake.json> [-o brief.md] [--no-links] [--public]

Plain language only ("customer group", not "segment"; no "ICP"). Numbers come from the JSON, computed by
validate_intake.py; the only math here is cost per sign-up, for display. Estimates are always labeled.
--public = no links, and drug names in the plain-AI baseline are masked (for video or sharing).
Plain-words tables and the owner-input sections live in brief_sections.py.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brief_sections import (CHANNELS, FINDING_KINDS, READINESS, SEGMENT_VERDICTS,  # noqa: E402
                            SKEPTIC_RESULTS, SOURCE_TYPES, Json, best_guess, count, currency_of,
                            customer_worth, made, money, must_be_true, not_done, verdict_text)
from guardrails import DRUG_NAMES  # noqa: E402  (drug names only: generic words like "medication" stay)

QUOTE_SOURCES = {"forum-post", "review"}  # first-hand customer words, not stats
NO_GROUP = "We didn't find a group we can stand behind yet."
MAX_WORRIES = 5  # keep the list scannable; the full counts stay in intake.json
# \w* swallows word endings ("GLP-1s") so no fragment of a name is left behind.
DRUG_MASK = re.compile(rf"(?:{DRUG_NAMES})\w*", re.IGNORECASE)


def plain(text: str) -> str:
    """Strip internal IDs like '(ev_15)' or '(see concernBundles)', and speak to the owner directly."""
    text = re.sub(r"\s*\((?:see [A-Za-z]+|(?:ev|seg|con|px|cr|fnd|lex|int)_\w+(?:,\s*\w+)*)\)", "", text)
    text = re.sub(r"\s*\b(?:ev|seg|con|px|cr|fnd|lex|int|hyp)_\d+\b,?", "", text)  # bare IDs inside longer notes
    text = re.sub(r"\bthe owner's\b", "your", text)
    return re.sub(r"\bThe owner's\b", "Your", text).strip()


def masked(texts: list[str], public: bool) -> list[str]:
    """Public mode hides drug names in the plain-AI baseline only; research text and quotes stay verbatim."""
    return [DRUG_MASK.sub("[medication]", t) for t in texts] if public else texts


def cell(items: list[str], empty: str) -> str:
    """Join items into one Markdown table cell."""
    return "<br>".join(s.replace("|", "\\|").replace("\n", " ") for s in items) or empty


def people(n: float) -> str:
    return f"{n / 1_000_000:.1f} million" if n >= 1_000_000 else f"{n:,.0f}"


def ranked_segments(brief: Json) -> list[Json]:
    return sorted(brief.get("segments") or [], key=lambda s: s.get("ownerRank") or 99)


def target_message(brief: Json) -> Json | None:
    """First message line for the chosen group, else the first line overall."""
    lines: list[Json] = brief.get("roughMessaging") or []
    seg_id = (brief.get("icp") or {}).get("segmentId")
    return next((m for m in lines if m.get("segmentId") == seg_id), lines[0] if lines else None)


def short_version(brief: Json) -> list[str]:
    icp: Json | None = brief.get("icp")
    readiness: Json = brief.get("readiness") or {}
    status = readiness.get("status", "needs-more")
    out = ["## The short version", ""]
    if icp and status != "no-supported-segment":
        out.append(f"**Who to target:** {icp.get('statement', '')}")
        if icp.get("mustHaves"):
            out.append(f"- Good fit if they are: {'; '.join(icp['mustHaves']).lower()}.")
        if icp.get("disqualifiers"):
            out.append(f"- Not a fit: {'; '.join(icp['disqualifiers']).lower()}.")
    else:
        out.append(f"**Who to target:** {NO_GROUP}")
    msg = target_message(brief)
    what = f"\"{msg.get('headline', '')}\" — {msg.get('subheadline', '')}" if msg else "No message lines yet."
    out += ["", f"**What to say:** {what}"] + customer_worth(brief)
    out += ["", f"**Where things stand:** {READINESS.get(status, status)}"]
    # Check names are internal; say what's still missing in the owner's terms.
    out += [f"- Not done yet: {not_done(c.get('check', ''))}." for c in readiness.get("checks", []) if not c.get("pass")]
    return out + [""]


def before_after(brief: Json, public: bool) -> list[str]:
    base: Json = brief.get("baseline") or {}
    icp: Json | None = brief.get("icp")
    out = ["## Before and after", ""]
    if base.get("ownerFirstDescription"):
        out += [f"You started with: \"{masked([base['ownerFirstDescription']], public)[0]}\"", ""]
    after_who = [icp.get("statement", "")] if icp else [NO_GROUP]
    after_say = [m.get("headline", "") for m in brief.get("roughMessaging") or []]
    return out + [
        "| | Before research (plain AI, no evidence) | After research |",
        "|---|---|---|",
        f"| **Who** | {cell(masked(base.get('icps', []), public), '(none)')} | {cell(after_who, '(none)')} |",
        f"| **What to say** | {cell(masked(base.get('taglines', []), public), '(none)')} | {cell(after_say, '(none yet)')} |",
        "",
    ]


def customer_groups(brief: Json) -> list[str]:
    out = ["## Customer groups we looked at", ""]
    segs = ranked_segments(brief)
    if not segs:
        return out + ["No customer groups yet.", ""]
    for seg in segs:
        svc: Json = seg.get("serviceability") or {}
        rank = f" (your #{seg['ownerRank']} pick)" if seg.get("ownerRank") else ""
        origin = "This was your original guess." if seg.get("isOwnerGuess") else "Research found this group."
        out += [f"### {seg.get('name', 'Unnamed group')}{rank}", ""]
        out += [seg["description"], ""] if seg.get("description") else []
        out.append(f"- **Where it came from:** {origin}")
        if svc.get("verdict"):
            out.append(f"- **Our verdict:** {SEGMENT_VERDICTS.get(svc['verdict'], svc['verdict'])} "
                       f"({svc.get('confidence', 'low')} confidence)")
        if svc.get("reasoning"):
            out.append(f"- **Why:** {plain(svc['reasoning'])}")
        size: Json = svc.get("size") or {}
        pop = size.get("population")
        if pop:
            label = " (estimate)" if size.get("isEstimate") else ""
            how = f" How we got there: {plain(size['logic'])}" if size.get("logic") else ""
            out.append(f"- **How many people:** about {people(pop)}{label}.{how}")
        else:
            out.append("- **How many people:** we couldn't estimate this yet.")
        # sizeMath is null until the validator can compute it from the owner's inputs; only show it once computed.
        math: Json = svc.get("sizeMath") or {}
        need, minimum = math.get("customersNeeded") or 0, math.get("minPopulation") or 0
        if need and minimum:
            clears = "" if not pop else (" This group clears that bar." if pop >= minimum
                                         else " This group may be too small.")
            out.append(f"- **Is it big enough?** To reach the minimum revenue you said you need, you'd need about "
                       f"{need:,.0f} customers, so the group must have at least {minimum:,.0f} people (assuming about "
                       f"{math.get('adoptionRate') or 0:.0%} of them would buy, your estimate).{clears}")
        out.append("")
    return out


def segment_quotes(brief: Json, seg_id: str, limit: int = 3) -> list[Json]:
    """Customer quotes for this group, preferring ones tagged to this group alone."""
    mine = [e for e in brief.get("evidence") or [] if seg_id in e.get("segmentIds", [])
            and e.get("sourceType") in QUOTE_SOURCES and e.get("origin") != "owner-file"]
    return sorted(mine, key=lambda e: len(e.get("segmentIds", [])) > 1)[:limit]


def worries(brief: Json, links: bool) -> list[str]:
    out = ["## What they worry about", ""]
    labels = {c["id"]: c.get("label", c["id"]) for c in brief.get("concerns") or [] if "id" in c}
    quote_heading = "**Real quotes**" + (" (fictional examples in this demo)" if brief.get("mode") == "demo" else "")
    for seg in ranked_segments(brief):
        seg_id = seg.get("id", "")
        out += [f"### {seg.get('name', 'Unnamed group')}", ""]
        bundles: list[Json] = sorted(seg.get("concernBundles") or [], key=lambda b: -b.get("observedCount", 0))
        # Bundles count exact combinations; owners need each worry's total across all posts.
        posts = sum(b.get("observedCount", 0) for b in bundles)
        totals: dict[str, int] = {}
        for b in bundles:
            for cid in b.get("concernIds", []):
                totals[cid] = totals.get(cid, 0) + b.get("observedCount", 0)
        for cid, n in sorted(totals.items(), key=lambda kv: -kv[1])[:MAX_WORRIES]:
            out.append(f"- {labels.get(cid, cid)}: mentioned in {n} of {posts} customer posts and reviews")
        combos = [b for b in bundles if len(b.get("concernIds", [])) > 1][:3]
        if combos:
            out.append("- Often raised together: " + "; ".join(
                " + ".join(labels.get(c, c) for c in b["concernIds"]) + f" ({b.get('observedCount', 0)})" for b in combos))
        if not bundles:  # not counted yet: list the worries tagged in this group's evidence, no numbers
            tagged = {cid for e in brief.get("evidence") or [] if seg_id in e.get("segmentIds", [])
                      for cid in e.get("concernIds", [])}
            out += [f"- {label}" for cid, label in labels.items() if cid in tagged] or ["- None recorded yet."]
        quotes = segment_quotes(brief, seg_id)
        out += ["", quote_heading, ""] if quotes else [""]
        for q in quotes:
            source = SOURCE_TYPES.get(q.get("sourceType", ""), "source")
            cite = f"[{source}]({q['url']})" if links and q.get("url") else source
            out += [f"> \"{q.get('excerpt', '')}\"", f"> — {cite}", ""]
    return out


def tried(brief: Json) -> list[str]:
    out = ["## What you've already tried", ""]
    business: Json = brief.get("business") or {}
    econ, currency = business.get("unitEconomics") or {}, currency_of(brief)
    if econ.get("targetCpaSource") == "derived" and econ.get("targetCpaUsed"):
        goal = f" (most you can spend: {money(econ['targetCpaUsed'], currency, 2)}, worked out from your numbers)"
    else:  # the owner's own target; files from before unitEconomics only carry targetCpa
        target = econ.get("targetCpaUsed") or business.get("targetCpa")
        goal = f" (your target: {money(target, currency, 2)})" if target else ""
    experiments: list[Json] = brief.get("priorExperiments") or []
    if not experiments:
        return out + ["You didn't share any past ad results.", ""]
    for px in experiments:
        headline = (px.get("message") or {}).get("headline") or px.get("hypothesis") or "Untitled ad"
        metrics: Json = px.get("metrics") or {}
        spend, signups = px.get("spend"), metrics.get("conversions")
        cost = (money(spend / signups, currency, 2) if spend is not None and signups
                else "no sign-ups" if signups == 0 else "not recorded")
        out += [f"### {CHANNELS.get(px.get('channel', ''), 'Ad')}: \"{headline}\"", "",
                f"- **Who saw it:** {px.get('audience', 'not recorded')}",
                f"- **Spent:** {money(spend, currency)} · **Clicks:** {count(metrics.get('clicks'))} "
                f"· **Sign-ups:** {count(signups)}",
                f"- **Cost per sign-up:** {cost}{goal}",
                f"- **Result:** {verdict_text(px)}", ""]
    return out


def how_sure(brief: Json) -> list[str]:
    out = ["## How sure we are", ""]
    findings: list[Json] = brief.get("findings") or []
    for kind, heading in FINDING_KINDS:
        group = [f for f in findings if f.get("kind") == kind]
        if group:
            out += [f"**{heading}**", ""]
            for f in group:
                caveat = f" Caveat: {plain(f['limitations'])}." if f.get("limitations") else ""
                out.append(f"- {plain(f.get('claim', ''))} _({f.get('confidence', 'low')} confidence.{caveat})_")
            out.append("")
    if not findings:
        out += ["No findings recorded yet.", ""]
    skeptic: list[Json] = brief.get("skeptic") or []
    if skeptic:
        out += ["**We tried to prove this wrong:**", ""]
        for s in skeptic:
            searched = ", ".join(f"\"{q}\"" for q in s.get("queries", [])) or "nothing yet"
            result = SKEPTIC_RESULTS.get(s.get("result", ""), "result not recorded")
            out.append(f"- *{s.get('claim', '')}.* We searched for {searched}. Result: {result}.")
        out.append("")
    return out


def render(brief: Json, links: bool = True, public: bool = False) -> str:
    name = (brief.get("business") or {}).get("name", "Your business")
    out = [f"# {name}: your GTMagic brief", ""]
    if brief.get("mode") == "demo":
        out += ["**Demo run — all data is fictional.**", ""]
    for section in (short_version(brief), must_be_true(brief), best_guess(brief), before_after(brief, public),
                    customer_groups(brief), worries(brief, links and not public), made(brief), tried(brief),
                    how_sure(brief)):
        out += section
    out += ["## Still open", ""] + ([f"- {plain(q)}" for q in brief.get("openQuestions") or []] or ["Nothing open right now."])
    return "\n".join(out).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Render brief.md from an intake.json save file.")
    parser.add_argument("intake", help="path to intake.json")
    parser.add_argument("-o", "--output", help="write here instead of stdout")
    parser.add_argument("--no-links", action="store_true", help="hide source links (e.g. for video)")
    parser.add_argument("--public", action="store_true", help="no links, and mask medication names in the baseline")
    args = parser.parse_args()
    try:
        with open(args.intake, encoding="utf-8") as fh:
            brief = json.load(fh)
        if not isinstance(brief, dict):
            raise ValueError("top level is not a JSON object")
        text = render(brief, links=not args.no_links, public=args.public)
        if not args.output:
            sys.stdout.write(text)
            return 0
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(text)
    except (OSError, ValueError) as err:  # JSONDecodeError is a ValueError
        print(f"render_brief: failed on {args.intake}: {err}", file=sys.stderr)
        return 1
    except (AttributeError, KeyError, TypeError) as err:  # a malformed file: the validator names the problem
        print(f"render_brief: {args.intake} isn't shaped as expected ({err}); run validate_intake.py on it first",
              file=sys.stderr)
        return 1
    print(f"render_brief: wrote {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
