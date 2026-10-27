#!/usr/bin/env python3
"""Validate an Intake Brief and fill in every number the model must not type.

Usage: python3 validate_intake.py <intake.json> [--log research-log.jsonl] [--write]

Computes bundles, size math, ad verdicts, per-creative results, lexicon voice, normalized
weights/shares and readiness; checks shapes, references, verbatim quotes, provenance and guardrails.
Exits 1 on any integrity error, so a broken brief is never handed off. Standard library only
(runs in Claude chat's sandbox too).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # works under python -I too
from guardrails import check_messaging  # noqa: E402
from provenance import check_evidence, check_lexicon, load_log, norm  # noqa: E402
from economics import compute_ads, num, size_math  # noqa: E402
from creatives import check_creatives  # noqa: E402
from structure import check_structure  # noqa: E402

CORE_ATTRIBUTES = ["role", "currentSolution", "priceSensitivity", "urgency", "skepticism", "buyingStage"]
TODAY_DIMENSIONS = ("geography", "age", "price", "channel", "regulatory", "interest")
SCRIPT_PREFIX = "[script] "
BUCKETS = {"locked", "preference", "hypothesis", "unknown"}
SKEPTIC_KINDS = {"motivation", "incumbent-gap", "size"}
SKEPTIC_RESULTS = {"unresolved", "resolved", "nothing-found"}


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.notes: list[str] = []

    def ref(self, ok: bool, where: str, ref_id: object, kind: str) -> None:
        if not ok:
            self.errors.append(f"{where}: unknown {kind} '{ref_id}'")


def ids_of(items: list[dict], label: str, report: Report) -> set[str]:
    seen = [i.get("id") for i in items]
    for dup, n in Counter(seen).items():
        if n > 1:
            report.errors.append(f"duplicate {label} id '{dup}'")
    return set(seen)


def compute_segments(brief: dict, ev_ids: set, con_ids: set, r: Report) -> None:
    segments = brief.get("segments", [])
    sizing = size_math(brief.get("business", {}), r)  # owner inputs only; no default adoption rate
    missing = [s for s in segments if num(s.get("sampleShare"), r, "sampleShare") is None]
    if missing:
        left = 1 - sum(num(s.get("sampleShare"), r, "sampleShare") or 0 for s in segments)
        r.notes.append(f"sampleShare missing on {len(missing)} group(s): giving them the remaining share equally")
        for s in missing:
            s["sampleShare"] = left / len(missing) if left > 0 else 1.0 / len(segments)
    total_share = sum(s["sampleShare"] for s in segments) or 1.0
    for s in segments:
        s["sampleShare"] = round(s["sampleShare"] / total_share, 4)
        where = f"segment {s.get('id')}"
        names = {a.get("name") for a in s.get("attributes", [])}
        for missing in [a for a in CORE_ATTRIBUTES if a not in names]:
            r.errors.append(f"{where}: missing core attribute '{missing}'")
        for attr in s.get("attributes", []):
            weights = [num(v.get("weight"), r, "weight") or 0 for v in attr.get("values", [])]
            if not weights or sum(weights) <= 0:
                r.errors.append(f"{where}: attribute '{attr.get('name')}' has no positive weights")
                continue
            if abs(sum(weights) - 1) > 0.05:
                r.warnings.append(f"{where}: '{attr.get('name')}' weights summed to {sum(weights):.2f}; normalized")
            for v in attr["values"]:
                v["weight"] = round((num(v.get("weight"), r, "weight") or 0) / sum(weights), 4)
        # Concern bundles: count each excerpt's exact set of concerns for this group.
        tagged = [tuple(sorted(e["concernIds"])) for e in brief.get("evidence", [])
                  if s.get("id") in e.get("segmentIds", []) and e.get("concernIds") and e.get("sourceType") in ("review", "forum-post")]  # customer voices only
        n = len(tagged)
        confidence = "low" if n < 10 else "medium" if n < 30 else "high"
        s["concernBundles"] = [{"concernIds": list(k), "observedCount": c, "weight": round(c / n, 4), "confidence": confidence}
                               for k, c in Counter(tagged).most_common()]
        per_concern = Counter(c for k in tagged for c in k)
        r.notes.append(f"{where}: {n} tagged excerpts ({confidence}); top concerns "
                       + ", ".join(f"{c}={k}" for c, k in per_concern.most_common(4)))
        sv = s.get("serviceability", {})
        for key in ("switchingEvidenceIds",):
            for e in sv.get(key, []):
                r.ref(e in ev_ids, where, e, "evidence")
        for e in sv.get("size", {}).get("evidenceIds", []):
            r.ref(e in ev_ids, where, e, "evidence")
        for inc in sv.get("incumbents", []):
            for e in inc.get("evidenceIds", []):
                r.ref(e in ev_ids, where, e, "evidence")
        for c in sv.get("unresolvedConcernIds", []):
            r.ref(c in con_ids, where, c, "concern")
        sv["sizeMath"] = dict(sizing)
        pop, minimum = sv.get("size", {}).get("population"), sizing["minPopulation"]
        if minimum is None:
            r.warnings.append(f"{where}: size not judged (needs price, minimum revenue and the owner's adoption estimate)")
        elif pop is not None and pop < minimum and sv.get("verdict") == "serviceable":
            r.warnings.append(f"{where}: verdict is serviceable but population {pop:,} < minimum {minimum:,}")


def check_refs(brief: dict, ev_ids: set, seg_ids: set, r: Report) -> None:
    def evs(where: str, ids: list) -> None:
        for e in ids or []:
            r.ref(e in ev_ids, where, e, "evidence")
    for h in brief.get("hypotheses", []):
        evs(f"hypothesis {h.get('id')}", h.get("evidenceIds"))
    for f in brief.get("findings", []):
        evs(f"finding {f.get('id')}", f.get("evidenceIds"))
        if f.get("segmentId"):
            r.ref(f["segmentId"] in seg_ids, f"finding {f.get('id')}", f["segmentId"], "segment")
    for c in brief.get("constraints", []):
        evs(f"constraint {c.get('dimension')}", (c.get("pushback") or {}).get("evidenceIds"))
    interest_ids = {g.get("id") for g in brief.get("interests", [])}
    for g in brief.get("interests", []):
        for d in g.get("demographics", []):
            evs(f"interest {g.get('id')}", d.get("evidenceIds"))
    for o in brief.get("overlaps", []):
        evs("overlap", o.get("evidenceIds"))
        for gid in o.get("groupIds", []):
            r.ref(gid in interest_ids, "overlap", gid, "interest group")
    for i, s in enumerate(brief.get("skeptic", [])):
        evs(f"skeptic[{i}]", s.get("evidenceIds"))
    icp = brief.get("icp")
    if icp:
        r.ref(icp.get("segmentId") in seg_ids, "icp", icp.get("segmentId"), "segment")


def readiness(brief: dict, messaging_ok: bool, r: Report) -> None:
    icp, hyps, segs = brief.get("icp"), brief.get("hypotheses", []), brief.get("segments", [])
    bucket = {c.get("dimension"): c.get("bucket") for c in brief.get("constraints", [])}
    for c in brief.get("constraints", []):
        if c.get("bucket") not in BUCKETS:
            r.errors.append(f"constraint {c.get('dimension')}: bucket must be one of {sorted(BUCKETS)}")
    primaries = [h for h in hyps if h.get("kind") == "primary"]
    if len(primaries) != 1 or len(hyps) - len(primaries) > 2:
        r.errors.append("hypotheses: need exactly 1 primary and at most 2 alternates")
    verdicts = {s.get("id"): s.get("serviceability", {}).get("verdict") for s in segs}
    if icp and verdicts.get(icp.get("segmentId")) in ("not-serviceable", "insufficient-evidence"):
        r.errors.append("icp points at a customer group the research does not support; pick another or set icp to null")
    if icp is None and "serviceable" in verdicts.values():
        r.errors.append("icp is null but a customer group is marked serviceable: pick it, or downgrade its verdict")
    checks = {
        "ICP has a statement, 3+ must-haves and 1+ disqualifier":
            icp is None or (bool(icp.get("statement")) and len(icp.get("mustHaves", [])) >= 3 and len(icp.get("disqualifiers", [])) >= 1),
        "Today's targeting dimensions all recorded (geography, age, price, channel, regulatory, interests)":
            all(d in bucket for d in TODAY_DIMENSIONS),
        "Geography and price are set (not unknown)":
            all(bucket.get(d) not in (None, "unknown") for d in ("geography", "price")),
        "One primary hypothesis with 'wrong if'": len(primaries) == 1 and bool(primaries[0].get("wrongIf")),
        "At least 2 customer groups, each with a verdict":
            len(segs) >= 2 and all(s.get("serviceability", {}).get("verdict") for s in segs),
        "Concern counts computed for every customer group": all(s.get("concernBundles") for s in segs),
        "3-5 messaging lines that pass the messaging check":
            3 <= len(brief.get("roughMessaging", [])) <= 5 and messaging_ok,
        "Every finding is typed and cites evidence":
            bool(brief.get("findings")) and all(f.get("kind") and f.get("evidenceIds") for f in brief["findings"]),
        "Skeptic pass covers motivation, incumbent gap and size, each with queries and a result":
            SKEPTIC_KINDS <= {s.get("kind") for s in brief.get("skeptic", [])}
            and all(s.get("queries") and s.get("result") in SKEPTIC_RESULTS for s in brief.get("skeptic", [])),
        "No integrity errors": not r.errors,
    }
    block = brief.setdefault("readiness", {"status": "needs-more", "checks": []})
    checks["Owner confirmation recorded"] = any(
        c.get("check", "").startswith("Owner confirmed") and c.get("pass") for c in block.get("checks", []))
    kept = [c for c in block.get("checks", []) if not c.get("check", "").startswith(SCRIPT_PREFIX)]
    block["checks"] = kept + [{"check": SCRIPT_PREFIX + k, "pass": v} for k, v in checks.items()]
    if r.errors or not all(c.get("pass") for c in block["checks"]):
        block["status"] = "needs-more"
    elif icp is None:
        block["status"] = "no-supported-segment"
    else:
        block["status"] = "ready"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("intake")
    ap.add_argument("--log", help="research-log.jsonl; when given, web evidence must appear in it")
    ap.add_argument("--write", action="store_true", help="write computed fields back to the file")
    args = ap.parse_args()
    with open(args.intake, encoding="utf-8") as f:
        brief = json.load(f)
    if not isinstance(brief, dict):
        print("ERROR intake file must be a JSON object")
        return 1

    r = Report()
    check_structure(brief, r)
    if r.errors:  # every later check assumes these shapes; stop here rather than crash or write half a result
        for item in r.errors:
            print(f"ERROR {item}")
        print("readiness: not checked (fix the file's structure first; nothing was written)")
        return 1
    seg_ids = ids_of(brief.get("segments", []), "segment", r)
    con_ids = ids_of(brief.get("concerns", []), "concern", r)
    ids_of(brief.get("findings", []), "finding", r)
    ids_of(brief.get("hypotheses", []), "hypothesis", r)
    ids_of(brief.get("priorExperiments", []), "prior experiment", r)
    ids_of(brief.get("creatives") or [], "creative", r)
    log_sources, log_queries = load_log(args.log, r)
    evidence = check_evidence(brief, seg_ids, con_ids, log_sources, bool(args.log), r)
    if args.log:  # the skeptic must have actually run the disconfirming queries it reports
        for i, s in enumerate(brief.get("skeptic", [])):
            for q in s.get("queries", []):
                if norm(q) not in log_queries:
                    r.errors.append(f"skeptic[{i}]: query not in research log: \"{q}\"")
    ids_of(brief.get("evidence", []), "evidence", r)
    lex_voice = check_lexicon(brief, evidence, seg_ids, r)
    compute_segments(brief, set(evidence), con_ids, r)
    target, target_source = compute_ads(brief, r)
    # imageFile paths are relative to the save file's folder (the workspace), not the shell's cwd.
    check_creatives(brief, os.path.dirname(os.path.abspath(args.intake)), target, target_source, r)
    messaging_ok = check_messaging(brief, seg_ids, lex_voice, r)
    check_refs(brief, set(evidence), seg_ids, r)
    readiness(brief, messaging_ok, r)

    for label, items in (("ERROR", r.errors), ("WARN", r.warnings), ("note", r.notes)):
        for item in items:
            print(f"{label:5} {item}")
    print(f"readiness: {brief['readiness']['status']}")
    if args.write:
        tmp = args.intake + ".tmp"  # write then rename, so a crash never leaves half a file
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(brief, f, indent=2, ensure_ascii=False)
            f.write("\n")
        os.replace(tmp, args.intake)
        print(f"wrote {args.intake}")
    return 1 if r.errors else 0


if __name__ == "__main__":
    sys.exit(main())
