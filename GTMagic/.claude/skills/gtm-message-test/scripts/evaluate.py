#!/usr/bin/env python3
"""Score a message test: customer-responses.json -> experiment-results.json.

Usage: python3 evaluate.py <intake.json> <positioning-set.json> <experiment-request.json> <customer-responses.json>
                           [--themes themes.json] [--seed 42] [--out experiment-results.json]
       python3 evaluate.py ... --list-objections      # print objections for Claude to tag into themes.json

Checks every response against what was shown (CONTRACTS.md validator 3), then computes counts, shares,
segment ranking, ICP verdict, stability, flags, objection-theme counts and the message checks.
Exits 1 if nothing usable was answered. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # works under python -I too
import stats  # noqa: E402

MANY_SKIPPED = 0.10
SMALL_SEGMENT = 5
THIN_EVIDENCE = 10  # gtm-intake: below 10 tagged excerpts, a segment's evidence is low confidence


def load(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def is_score(x: object) -> bool:
    return type(x) is int and 1 <= x <= 5  # a bool is an int in Python; exclude it


def clean(responses: object, request: dict, seg_ids: set[str], warnings: list[str]):
    """Split responses into answered main, answered repeats and a skipped count. Anything that doesn't match
    what was shown (CONTRACTS.md validator 3) is counted as skipped invalid-output, never guessed at."""
    shown = {s["candidateId"] for s in request.get("stimuli", [])}
    k = len(request.get("orderings") or [])
    main, repeats, skipped, seen = [], [], 0, set()
    for r in responses if isinstance(responses, list) else []:
        if not isinstance(r, dict) or not isinstance(r.get("customerId"), str):
            warnings.append("ignored a response with no customerId")
            continue
        is_repeat = r.get("isRepeat") is True
        key = (r["customerId"], is_repeat)
        if r.get("experimentId") != request["id"] or key in seen:
            warnings.append(f"ignored response {r.get('id')}: other experiment or repeated customer")
            continue
        seen.add(key)
        ratings: dict[str, dict] = {}
        ok = (r.get("status") == "answered" and isinstance(r.get("id"), str) and isinstance(r.get("segmentId"), str)
              and r["segmentId"] in seg_ids and isinstance(r.get("choice"), str)
              and r.get("choice") in shown | {"none"} and type(r.get("orderingIndex")) is int and 0 <= r["orderingIndex"] < k
              and isinstance(r.get("ratings"), list))
        for rating in r.get("ratings") if ok else []:
            scores = rating.get("scores") if isinstance(rating, dict) else None
            cid = rating.get("candidateId") if isinstance(rating, dict) else None
            if not isinstance(scores, dict) or not isinstance(cid, str) or cid not in shown or not all(is_score(scores.get(d)) for d in stats.DIMENSIONS):
                ok = False
                break
            ratings[rating["candidateId"]] = {d: scores[d] for d in stats.DIMENSIONS}
        ok = ok and set(ratings) == shown  # every shown option rated, so no score silently defaults to zero
        if not ok:
            if r.get("status") == "answered":
                warnings.append(f"response {r.get('id')}: choice, ordering or ratings don't match what was shown; counted as skipped")
            skipped += 0 if is_repeat else 1
            continue
        given = r.get("objections") if isinstance(r.get("objections"), list) else []  # malformed objections are dropped, not the answer
        objections = [o for o in given if isinstance(o, dict) and isinstance(o.get("text"), str)]
        item = {"id": r.get("id"), "customerId": r["customerId"], "segmentId": r["segmentId"], "choice": r["choice"],
                "ratings": ratings, "objections": objections}
        (repeats if is_repeat else main).append(item)
    return main, repeats, skipped


def themes_from(data: dict | None, main: list[dict], shown: set[str], warnings: list[str]) -> list[dict]:
    """Claude tags objections with theme ids; code does the counting and picks the simulated quotes."""
    if data is None:
        return []
    themes = data.get("themes") if isinstance(data, dict) and isinstance(data.get("themes"), list) else []
    tags = data.get("tags") if isinstance(data, dict) and isinstance(data.get("tags"), list) else []
    names: dict[str, str] = {}
    for t in themes:
        if not isinstance(t, dict) or not isinstance(t.get("id"), str):
            continue
        if t["id"] in names:
            warnings.append(f"theme id '{t['id']}' is used twice; keeping the first")
            continue
        names[t["id"]] = str(t.get("theme", ""))
    by_id = {r["id"]: r for r in main}
    found: dict[str, list[dict]] = {t: [] for t in names}
    seen = set()
    for tag in tags:
        tag = tag if isinstance(tag, dict) else {}
        rid, idx, theme = tag.get("responseId"), tag.get("objectionIndex"), tag.get("themeId")
        r = by_id.get(rid) if isinstance(rid, str) else None
        if not r or not isinstance(theme, str) or theme not in names or type(idx) is not int or not 0 <= idx < len(r["objections"]) or (r["id"], idx) in seen:
            warnings.append(f"ignored theme tag {tag}: unknown response, objection or theme, or tagged twice")
            continue
        seen.add((r["id"], idx))
        found[theme].append(r["objections"][idx])
    total = sum(len(r["objections"]) for r in main)
    if total and len(seen) < total:
        warnings.append(f"{total - len(seen)} of {total} objections have no theme tag, so the theme counts leave them out")
    out = [{"theme": names[t], "count": len(objs),
            "candidateIds": sorted({o["candidateId"] for o in objs if isinstance(o.get("candidateId"), str) and o["candidateId"] in shown}),
            "simulatedQuotes": [o["text"] for o in objs[:3]]} for t, objs in found.items() if objs]
    return sorted(out, key=lambda t: -t["count"])


def check_fingerprint(request: dict, responses: dict, warnings: list[str]) -> None:
    """build_test.py reuses exp_1 and hyp_ ids, so after a rebuild only the fingerprint tells old answers from new."""
    expected, got = request.get("fingerprint"), responses.get("requestFingerprint")
    if expected and got and got != expected:
        raise SystemExit("ERROR customer-responses.json answers an older version of this test (requestFingerprint doesn't "
                         "match experiment-request.json): simulate again before scoring")
    if expected and not got:
        warnings.append("customer-responses.json has no requestFingerprint, so nothing confirms it answered this version "
                        "of the test; make sure it was simulated after the last build_test.py run")


def evaluate(intake: dict, positioning: dict, request: dict, responses: dict, themes: dict | None, seed: int):
    warnings: list[str] = []
    segments = intake.get("segments", [])
    seg_ids = [s["id"] for s in segments]
    shown = [s["candidateId"] for s in request.get("stimuli", [])]
    kinds = {h["id"]: h.get("source", "generated") for h in positioning.get("hypotheses", [])}
    check_fingerprint(request, responses, warnings)
    main, repeats, skipped = clean(responses.get("responses"), request, set(seg_ids), warnings)
    if not main:
        raise SystemExit("ERROR no usable answered responses; check customer-responses.json against experiment-request.json")
    answered = len(main)

    table = stats.candidates_table(main, shown, seg_ids)
    ranking = stats.segment_ranking(main, seg_ids)
    guess = next((s["id"] for s in segments if s.get("isOwnerGuess")), None)
    verdict, verdict_rate = stats.icp_verdict(main, seg_ids, guess, seed)
    top = max(table, key=lambda c: c["choiceCount"])["candidateId"]
    boot = stats.bootstrap(main, shown, top, [c for c in shown if c != top], seed)
    for c in table:
        c["preferenceRange"] = stats.wilson(c["choiceCount"], answered)  # proposed optional field: 90% Wilson interval
    heads = {h["id"]: h.get("headline", "") for h in positioning.get("hypotheses", [])}
    none_count = sum(1 for r in main if r["choice"] == "none")
    same, pairs = stats.repeat_pairs(main, repeats)
    checks, message_verdict, recommended = stats.message_checks(table, kinds, heads, boot, answered, none_count,
                                                                (same, pairs, stats.chance_agreement(main)))
    guess_rate = stats.guess_first_rate(main, seg_ids, guess, seed)
    if verdict == "guess-holds" and guess_rate is not None:
        stable = guess_rate >= stats.GUESS_STABLE
        checks.append({"id": "customer-group", "status": "pass" if stable else "warn",
                       "detail": f"The owner's guess came first in {round(guess_rate * stats.RESAMPLES)} of {stats.RESAMPLES} reshuffles"
                                 + ("." if stable else "; treat \"your guess holds\" as a lead, not a finding.")})

    # Counted the way gtm-intake counts them: customer-voice excerpts (reviews, forum posts) tagged to the group
    # that also carry a concern tag. The owner's own words don't count.
    evidence_by_seg = {s: sum(s in (e.get("segmentIds") or []) and bool(e.get("concernIds"))
                              and e.get("sourceType") in ("review", "forum-post") for e in intake.get("evidence", []))
                       for s in seg_ids}
    per_seg = {s: sum(1 for r in main if r["segmentId"] == s) for s in seg_ids}
    flags = [name for name, on in (
        ("small-sample", any(n < SMALL_SEGMENT for n in per_seg.values())),
        ("everyone-agreed", none_count == 0),
        ("nobody-interested", none_count / answered > stats.NOBODY_INTERESTED),
        ("unstable-winner", boot["winnerRate"] < stats.UNSTABLE_WINNER),
        ("thin-evidence", any(n < THIN_EVIDENCE for n in evidence_by_seg.values())),
        ("many-skipped", skipped / (answered + skipped) > MANY_SKIPPED),
    ) if on]

    limitations = ["Simulated customers, not real ones: these are hypotheses to test, not results."]
    if skipped:
        limitations.append(f"{skipped} simulated customers were skipped (refused, timed out or answered invalidly).")
    if str(responses.get("_note") or "").startswith("FAKE"):
        limitations.insert(0, "FAKE responses generated for testing; nothing here is a finding.")
    if verdict_rate is not None:
        limitations.append(f"The top customer group came first in {round(verdict_rate * stats.RESAMPLES)} of {stats.RESAMPLES} reshuffles of the answers.")
    theme_counts = themes_from(themes, main, set(shown), warnings)
    if themes is None:
        limitations.append("Objection themes weren't grouped for this run.")

    fake = str(responses.get("_note") or "").startswith("FAKE")
    return {
        "schemaVersion": 1,
        **({"_note": "FAKE: computed from FAKE responses generated for testing. Not a finding."} if fake else {}),
        "experimentId": request["id"], "protocolVersion": request.get("protocol", {}).get("version", ""),
        "answered": answered, "skipped": skipped,
        "candidates": table, "noneCount": none_count, "segmentRanking": ranking, "icpVerdict": verdict,
        "stability": {"bootstrapWinnerRate": boot["winnerRate"], "repeatConsistency": stats.repeat_consistency(main, repeats)},
        "confidenceFlags": flags, "objectionThemes": theme_counts, "limitations": limitations,
        # Proposed additions (optional fields; see references/method.md):
        "messageVerdict": message_verdict, "recommendedCandidateId": recommended, "checks": checks,
    }, warnings


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    for name in ("intake", "positioning", "request", "responses"):
        ap.add_argument(name)
    ap.add_argument("--themes", help="themes.json: Claude's theme ids and tags for objections")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="experiment-results.json")
    ap.add_argument("--list-objections", action="store_true", help="print objections (one JSON per line) and exit")
    args = ap.parse_args()
    intake, positioning, request, responses = (load(p) for p in (args.intake, args.positioning, args.request, args.responses))
    for name, data in (("intake", intake), ("positioning", positioning), ("request", request), ("responses", responses)):
        if not isinstance(data, dict):
            raise SystemExit(f"ERROR {getattr(args, name)} isn't a JSON object")

    if args.list_objections:
        main_resps, _, _ = clean(responses.get("responses"), request, {s["id"] for s in intake.get("segments", [])}, [])
        for r in main_resps:
            for i, o in enumerate(r["objections"]):
                print(json.dumps({"responseId": r["id"], "objectionIndex": i, "candidateId": o.get("candidateId"), "text": o.get("text", "")}))
        return 0

    results, warnings = evaluate(intake, positioning, request, responses, load(args.themes) if args.themes else None, args.seed)
    for w in warnings:
        print(f"WARNING {w}")
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"OK {results['answered']} answered, {results['skipped']} skipped; message verdict {results['messageVerdict']}, "
          f"ICP verdict {results['icpVerdict']}; wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
