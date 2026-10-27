"""Write the run folder: personas.jsonl, responses.jsonl, results.json, summary.md, run.json, outputs.sha256.

Every number is labeled simulated. The fixed disclaimer is the only place words like "click-through rate"
or "forecast" may appear, and only to say what this is not. outputs.sha256 is written last; its final line
is the digest of the lines above it, so a finished run can be sealed by one hash.
"""
from __future__ import annotations

import hashlib
import json
import os

from cost import cents_up

DISCLAIMER = ("Simulated draws from one model: correlated outputs, not people. "
              "Not a forecast and not a click-through rate.")
OUTPUT_FILES = ("run.json", "personas.jsonl", "responses.jsonl", "results.json", "summary.md")
HASH_FILE = "outputs.sha256"


def prepare_dir(path: str) -> None:
    """The run folder must be new or empty: a finished run is never overwritten."""
    if os.path.exists(path) and (not os.path.isdir(path) or os.listdir(path)):
        raise FileExistsError(f"{path} already exists and isn't empty; pick a new --out folder")
    os.makedirs(path, exist_ok=True)


def write_json(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def write_jsonl(path: str, rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def append_jsonl(path: str, row: dict) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def seal(folder: str) -> str:
    """Hash every output file, write outputs.sha256, and return the digest of its lines."""
    lines = []
    for name in OUTPUT_FILES:
        with open(os.path.join(folder, name), "rb") as f:
            lines.append(f"{hashlib.sha256(f.read()).hexdigest()}  {name}\n")
    digest = hashlib.sha256("".join(lines).encode("utf-8")).hexdigest()
    with open(os.path.join(folder, HASH_FILE), "w", encoding="utf-8") as f:
        f.writelines(lines)
        f.write(f"# sha256 of the lines above: {digest}\n")
    return digest


def append_ledger(path: str, row: dict) -> None:
    """One line per run start and finish, never edited: re-running with new seeds stays visible.
    Opened without following a symlink, so a planted link can't redirect it."""
    flags = os.O_WRONLY | os.O_APPEND | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(path, flags, 0o644), "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def _name(asset: dict) -> str:
    detail = asset.get("file") or f"\"{asset.get('text', '')}\""
    return f"{asset['id']} ({detail})".replace("|", "\\|")


def _rank_cell(entry: dict) -> str:
    if entry.get("tied"):
        return f"{entry['rank']} (tied, average rank {entry['averageRank']:g}; order set by a seeded coin flip)"
    if entry.get("tieWithAboveBrokenBy"):
        return f"{entry['rank']} (same mean as the ad above; {entry['tieWithAboveBrokenBy']} decides)"
    return str(entry["rank"])


def _rating_table(summary: dict, names: dict[str, str]) -> list[str]:
    if not summary["ranking"]:
        return ["No usable answers, so there's no ranking."]
    rows = ["| Rank | Ad | Mean rating, 1–5 (simulated) | Picked (simulated) | Ratings 1/2/3/4/5 |",
            "|---|---|---|---|---|"]
    for entry in summary["ranking"]:
        s = summary["assets"][entry["assetId"]]
        counts = "/".join(str(s["ratingCounts"][str(v)]) for v in range(1, 6))
        mean = "n/a" if s["meanRating"] is None else f"{s['meanRating']:.2f}"
        rows.append(f"| {_rank_cell(entry)} | {names[entry['assetId']]} | {mean} | "
                    f"{s['picks']} of {summary['answered']} | {counts} |")
    return rows


def _borda_table(summary: dict, names: dict[str, str]) -> list[str]:
    if not summary["ranking"]:
        return ["No usable answers, so there's no ranking."]
    rows = ["| Rank | Ad | Borda points (simulated) | First places |", "|---|---|---|---|"]
    for entry in summary["ranking"]:
        s = summary["assets"][entry["assetId"]]
        rows.append(f"| {_rank_cell(entry)} | {names[entry['assetId']]} | {s['bordaPoints']} | {s['firstPlaces']} |")
    return rows


def _answered_line(summary: dict, noun: str) -> str:
    skipped = ", ".join(f"{n} {why}" for why, n in summary["skipReasons"].items())
    return f"{summary['answered']} of {summary['calls']} {noun} answered" + (f" (skipped: {skipped})." if skipped else ".")


def summary_md(run: dict, results: dict) -> str:
    names = {a["id"]: _name(a) for a in results["assets"]}
    kind = "images" if results["assetType"] == "image" else "headlines"
    seg_counts = ", ".join(f"{sid}: {n}" for sid, n in run["drawsPerSegment"].items())
    out = [f"# Simulated evaluation of {len(names)} {kind}", "", f"> {DISCLAIMER}", "",
           f"Mode: {run['mode']} · model {run['model']} (effort {run['effort']}) · prompt {run['promptVersion']} · "
           f"seed {run['seed']} · {run['n']} simulated draws ({seg_counts}).", ""]
    if run.get("aborted"):
        return "\n".join(out + ["## Stopped early: incomplete, not a result", "",
                                 f"The run stopped sending calls: {run['aborted']}", "",
                                 "No ranking is shown. The partial numbers stay in results.json for diagnosis only.",
                                 ""] + _cost_lines(run))
    p = results["personas"]
    out += ["## Simulated customers", "", _answered_line(p, "draws") + f" Picked none of them: {p['noneCount']}.",
            ""] + _rating_table(p, names) + [""]
    for key, title in (("judgeBrief", "Judge who read the brief"), ("judgePlain", "Judge with no brief")):
        out += [f"## {title} (simulated)", "", _answered_line(results[key], "orderings")
                + " One ranking per order the ads were shown in.", ""] + _borda_table(results[key], names) + [""]
    if results.get("crowd"):
        c = results["crowd"]
        out += ["## Plain crowd: no customer card (simulated)", "", _answered_line(c, "draws")
                + f" Picked none of them: {c['noneCount']}.", ""] + _rating_table(c, names) + [""]
    k = results["consistency"]
    if k["pairsCompared"]:
        out += ["## Consistency check (not in the scores)", "",
                f"{k['repeatsAsked']} draws were asked again with the ads in reverse order; {k['pairsCompared']} "
                f"could be compared. Same pick: {k['samePick']} of {k['pairsCompared']} (two independent picks from "
                f"this run's own mix of picks would match about {k['chanceSamePickShare']:.0%} of the time). Ratings "
                f"moved {k['meanAbsRatingChange']:.2f} points on average (1–5 scale).", ""]
    notes = [f"- {f}" for f in results["flags"]] + [f"- {w}" for w in results["warnings"]]
    if notes:
        out += ["## Flags and warnings", ""] + notes + [""]
    return "\n".join(out + _cost_lines(run))


def _cost_lines(run: dict) -> list[str]:
    spend = run["cost"]
    return ["## Cost", "", f"Estimated before the run: about ${spend['estimate']['expectedUsd']:.2f} "
            f"(at most ${cents_up(spend['estimate']['worstCaseUsd']):.2f}). Actual: ${spend['actualUsd']:.4f}.", ""]
