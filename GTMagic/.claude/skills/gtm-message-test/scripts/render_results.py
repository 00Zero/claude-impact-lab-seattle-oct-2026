#!/usr/bin/env python3
"""Readable results page from experiment-results.json (plus the options that were tested).

Usage: python3 render_results.py <experiment-results.json> <positioning-set.json> <intake.json> -o results.md

Shows counts with n, never bare percentages, and labels everything from simulated customers as simulated.
"""
from __future__ import annotations

import argparse
import json
import sys

VERDICT = {"clear-winner": "Clear winner (simulated)", "no-clear-winner": "No clear winner yet",
           "unreliable": "Unreliable: don't act on this ranking"}
FLAGS = {
    "small-sample": "Some customer groups had fewer than 5 simulated customers, so their numbers are shaky.",
    "everyone-agreed": "Nobody chose \"none of these\". Real people often do, so the simulated customers may be too easy to please.",
    "nobody-interested": "Most simulated customers chose none of these messages.",
    "unstable-winner": "The top message often lost its lead when the answers were reshuffled, so it isn't a stable winner.",
    "thin-evidence": "Some customer groups rest on fewer than 10 tagged real quotes, so their simulated customers are thinly grounded.",
    "many-skipped": "More than 1 in 10 simulated customers didn't give a usable answer.",
}
KIND = {"founder-current": "your current message", "decoy": "decoy (deliberately generic)", "generated": "new (draft)"}  # generated copy is always labeled a draft (CLAUDE.md)
STATUS = {"pass": "Pass", "warn": "Check", "fail": "Fail"}


def cell(s: str) -> str:
    """A headline inside a table cell, so a "|" in it can't break the table."""
    return s.replace("|", "\\|")


def icp_sentence(res: dict, intake: dict, seg: dict) -> str:
    """Name the groups: the owner's guess, the best-responding group, and the target confirmed in intake."""
    guess = next((s["id"] for s in intake.get("segments", []) if s.get("isOwnerGuess")), None)
    top = res["segmentRanking"][0]["segmentId"] if res["segmentRanking"] else None
    name = lambda sid: f"\"{seg.get(sid, sid)}\""  # noqa: E731
    answered = {row["segmentId"] for row in res["segmentRanking"]}
    if guess and guess not in answered:
        return f"No simulated customers from your guess, {name(guess)}, answered, so it can't be compared."
    if res["icpVerdict"] == "too-close-to-call" and top == guess:
        return f"Too close to call: your guess, {name(guess)}, tied for first with another group."
    text = {
        "guess-holds": f"Your guess, {name(guess)}, came out on top in this simulation.",
        "different-segment": f"{name(top)} responded better than your guess, {name(guess)}.",
        "too-close-to-call": f"Too close to call between {name(top)} and your guess, {name(guess)}.",
        "no-guess": f"{name(top)} responded best; there was no guess to compare against.",
    }.get(res["icpVerdict"], res["icpVerdict"])
    confirmed = (intake.get("icp") or {}).get("segmentId")
    if confirmed and confirmed != guess:
        text += f" The target you confirmed in the intake is {name(confirmed)}."
    return text


def render(res: dict, positioning: dict, intake: dict) -> str:
    hyp = {h["id"]: h for h in positioning.get("hypotheses", [])}
    seg = {s["id"]: s.get("name", s["id"]) for s in intake.get("segments", [])}
    n = res["answered"]
    out = [f"# Message test: {intake.get('business', {}).get('name', '')}", "",
           "_Simulated customers, not real ones: these are hypotheses to test, not results._", ""]
    for lim in res["limitations"]:
        if lim.startswith("FAKE"):
            out += [f"> **{lim}**", ""]
    rec = res.get("recommendedCandidateId")
    out += [f"**Verdict:** {VERDICT.get(res.get('messageVerdict', ''), res.get('messageVerdict', ''))}"
            + (f": \"{hyp[rec]['headline']}\"" if rec else ""), "",
            f"**Customer groups:** {icp_sentence(res, intake, seg)}", ""]

    out += ["## Which message they chose", "", f"{n} simulated customers answered; {res['skipped']} were skipped. "
            "The range is a 90% interval: how much each count could move with a fresh set of simulated customers from the same groups. "
            "It says nothing about real customers.", "",
            "| Message | Type | Chosen by | Range | Would act (1–5) |", "|---|---|---|---|---|"]
    for c in sorted(res["candidates"], key=lambda c: -c["choiceCount"]):
        lo, hi = c.get("preferenceRange", [0, 0])
        out.append(f"| \"{cell(hyp[c['candidateId']]['headline'])}\" | {KIND.get(hyp[c['candidateId']].get('source'), '')} | "
                   f"{c['choiceCount']} of {n} | {round(lo * n)}–{round(hi * n)} | {c['dimensionMeans']['actionIntent'] or '–'} |")
    out += [f"| None of these | | {res['noneCount']} of {n} | | |", ""]

    out += ["## By customer group", "", "Score (0 to 1) combines how many chose any message and how likely they said they'd act on it.", "",
            "| Group | n | Chose none | Favourite | Score |", "|---|---|---|---|---|"]
    for row in res["segmentRanking"]:
        best = hyp.get(row["bestCandidateId"], {}).get("headline", "none")
        out.append(f"| {seg.get(row['segmentId'], row['segmentId'])} | {row['n']} | {round(row['noneShare'] * row['n'])} | \"{cell(best)}\" | {row['score']:.2f} |")
    out += [""]

    out += ["## Can you trust this?", ""]
    out += [f"- **{STATUS[c['status']]}:** {c['detail']}" for c in res.get("checks", [])]
    out += [f"- **Caution:** {FLAGS.get(f, f)}" for f in res["confidenceFlags"]]
    stab = res["stability"]
    out += [f"- The top message stayed on top in {round(stab['bootstrapWinnerRate'] * 500)} of 500 reshuffles of the same answers."]
    out += [""]

    if res["objectionThemes"]:
        out += ["## Objections (simulated)", ""]
        for t in res["objectionThemes"]:
            out += [f"- **{t['theme']}** ({t['count']}): " + "; ".join(f"_simulated:_ {q}" for q in t["simulatedQuotes"])]
        out += [""]
    out += ["## Limitations", ""] + [f"- {lim}" for lim in res["limitations"]] + [""]
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("results")
    ap.add_argument("positioning")
    ap.add_argument("intake")
    ap.add_argument("-o", "--out", default="results.md")
    args = ap.parse_args()
    data = []
    for path in (args.results, args.positioning, args.intake):
        with open(path, encoding="utf-8") as f:
            data.append(json.load(f))
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(render(*data))
    print(f"OK wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
