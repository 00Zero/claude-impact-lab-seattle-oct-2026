"""Code-only scoring of answered draws: per-ad counts, mean rating, pick share, rankings and consistency.

Means and shares are exact fractions until they're written out, so a tie is a real tie, not a float
accident. Rankings: mean rating, then pick share, then a seeded coin flip (judges: Borda points, then the
coin). A coin-flip tie is marked tied and gets an average rank. Every number here is simulated; nothing
in this file is a rate of real people doing anything. build_results is shared by `run` and `verify`.
"""
from __future__ import annotations

from collections import Counter
from fractions import Fraction

from design import LABELS, rng
from outputs import DISCLAIMER

MIN_ANSWERED_SHARE = Fraction(4, 5)   # below this, the run is flagged (never failed)


def coins(asset_ids: list[str], seed: int, task: str) -> dict[str, float]:
    """The seeded coin flip that settles exact ties; drawn in a fixed (sorted) order."""
    r = rng(seed, f"tiebreak:{task}")
    return {a: r.random() for a in sorted(asset_ids)}


def decimal(value: Fraction | None, places: int = 3) -> float | None:
    return None if value is None else round(float(value), places)


def exact(value: Fraction | None) -> str | None:
    return None if value is None else f"{value.numerator}/{value.denominator}"


def answered(records: list[dict]) -> list[dict]:
    return [r for r in records if r.get("status") == "answered"]


def skip_reasons(records: list[dict]) -> dict[str, int]:
    return dict(sorted(Counter(r.get("skipReason") for r in records if r.get("status") != "answered").items()))


def ranked(order: list[str], tie_key, broken_by) -> list[dict]:
    """Rank entries; assets with equal tie_key (a true tie, settled only by the coin) share an average rank."""
    entries = []
    for i, a in enumerate(order):
        group = [j for j, b in enumerate(order) if tie_key(b) == tie_key(a)]
        entry = {"rank": i + 1, "assetId": a, "averageRank": (group[0] + group[-1] + 2) / 2, "tied": len(group) > 1}
        reason = broken_by(order[i - 1], a) if i else None
        if reason:
            entry["tieWithAboveBrokenBy"] = reason
        entries.append(entry)
    return entries


def position_counts(records: list[dict], asset_ids: list[str]) -> dict[str, list[int]]:
    """How often each ad was shown in each position, among answered draws (the Latin square's balance)."""
    counts = {a: [0] * len(asset_ids) for a in asset_ids}
    for r in answered(records):
        for label, a in r["labelMap"].items():
            counts[a][LABELS.index(label)] += 1
    return counts


def rating_summary(records: list[dict], asset_ids: list[str], seed: int, task: str) -> dict:
    """Persona or crowd draws: rating counts 1–5, mean rating, picks and pick share per ad, and the ranking."""
    done = answered(records)
    stats: dict[str, dict] = {}
    for a in asset_ids:
        ratings = [r["result"]["ratings"][a] for r in done]
        picks = sum(1 for r in done if r["result"]["pick"] == a)
        stats[a] = {"n": len(ratings), "counts": {str(v): ratings.count(v) for v in range(1, 6)},
                    "sum": sum(ratings), "mean": Fraction(sum(ratings), len(ratings)) if ratings else None,
                    "picks": picks, "share": Fraction(picks, len(done)) if done else Fraction(0)}
    coin = coins(asset_ids, seed, task)
    order = sorted(asset_ids, key=lambda a: (-(stats[a]["mean"] or 0), -stats[a]["share"], coin[a])) if done else []

    def broken_by(above: str, a: str) -> str | None:
        if stats[a]["mean"] != stats[above]["mean"]:
            return None
        return "pick share" if stats[a]["share"] != stats[above]["share"] else "seeded coin flip"

    return {"calls": len(records), "answered": len(done), "skipReasons": skip_reasons(records),
            "noneCount": sum(1 for r in done if r["result"]["pick"] == "none"),
            "assets": {a: {"n": s["n"], "ratingCounts": s["counts"], "ratingSum": s["sum"],
                           "meanRating": decimal(s["mean"]), "meanRatingExact": exact(s["mean"]), "picks": s["picks"],
                           "pickShare": decimal(s["share"]), "pickShareExact": exact(s["share"])}
                       for a, s in stats.items()},
            "positionCounts": position_counts(records, asset_ids),
            "ranking": ranked(order, lambda a: (stats[a]["mean"], stats[a]["share"]), broken_by)}


def borda_summary(records: list[dict], asset_ids: list[str], seed: int, task: str) -> dict:
    """Judges: each answered ordering gives k−1 points to its first choice, down to 0 for its last."""
    done = answered(records)
    k = len(asset_ids)
    points = {a: 0 for a in asset_ids}
    firsts = {a: 0 for a in asset_ids}
    for r in done:
        ranking = r["result"]["ranking"]
        for position, a in enumerate(ranking):
            points[a] += k - 1 - position
        firsts[ranking[0]] += 1
    coin = coins(asset_ids, seed, task)
    order = sorted(asset_ids, key=lambda a: (-points[a], coin[a])) if done else []  # no answers, no ranking
    return {"calls": len(records), "answered": len(done), "skipReasons": skip_reasons(records),
            "firstShownRankedFirst": sum(1 for r in done if r["result"]["ranking"][0] == r["labelMap"]["A"]),
            "assets": {a: {"bordaPoints": points[a], "firstPlaces": firsts[a]} for a in asset_ids},
            "ranking": ranked(order, lambda a: points[a],
                              lambda above, a: "seeded coin flip" if points[a] == points[above] else None)}


def chance_same_pick(persona_records: list[dict]) -> Fraction | None:
    """How often two independent picks from this run's own pick mix (each ad and "none") would agree: Σp²."""
    picks = Counter(r["result"]["pick"] for r in answered(persona_records))
    total = sum(picks.values())
    return sum(Fraction(c, total) ** 2 for c in picks.values()) if total else None


def consistency(persona_records: list[dict], repeat_records: list[dict], asset_ids: list[str]) -> dict:
    """Same draw, order reversed: how often the pick held, and how far ratings moved. Not used in scores."""
    first = {r["personaId"]: r for r in answered(persona_records)}
    pairs = [(first[r["personaId"]], r) for r in answered(repeat_records) if r["personaId"] in first]
    same = sum(1 for a, b in pairs if a["result"]["pick"] == b["result"]["pick"])
    moves = [abs(a["result"]["ratings"][x] - b["result"]["ratings"][x]) for a, b in pairs for x in asset_ids]
    return {"repeatsAsked": len(repeat_records), "pairsCompared": len(pairs), "samePick": same,
            "samePickShare": decimal(Fraction(same, len(pairs))) if pairs else None,
            "chanceSamePickShare": decimal(chance_same_pick(persona_records)),
            "meanAbsRatingChange": decimal(Fraction(sum(moves), len(moves))) if moves else None}


def flags(results: dict, records: list[dict]) -> list[str]:
    out = [f"no-answers: {key} got no usable answers, so it has no ranking"
           for key in ("personas", "judgeBrief", "judgePlain", "crowd") if results.get(key) and not results[key]["answered"]]
    p = results["personas"]
    if p["calls"] and Fraction(p["answered"], p["calls"]) < MIN_ANSWERED_SHARE:
        out.append(f"many-skipped: only {p['answered']} of {p['calls']} simulated draws answered")
    if any(r.get("skipReason") == "budget" for r in records):
        out.append("budget-cap-reached: the spend cap stopped some calls")
    if any(max(c) - min(c) > max(1, round(0.1 * max(c))) for c in p["positionCounts"].values()):
        out.append("position-imbalance: skipped draws left some ads shown in some positions noticeably more than others")
    for key in ("judgeBrief", "judgePlain"):
        j = results[key]
        if 0 < j["answered"] < j["calls"]:
            out.append(f"{key}-incomplete: {j['answered']} of {j['calls']} orderings answered, so its points "
                       "aren't balanced across positions")
        if j["answered"] >= 2 and j["firstShownRankedFirst"] == j["answered"]:
            out.append(f"{key}: ranked whichever ad was shown first as best every time (position-driven)")
    return out


def build_results(run: dict, records: list[dict]) -> dict:
    """results.json from run.json and responses.jsonl alone, so anyone can recompute it."""
    ids = [a["id"] for a in run["assets"]]
    seed = run["seed"]
    by_role: dict[str, list[dict]] = {}
    for r in sorted(records, key=lambda r: r["callId"]):
        by_role.setdefault(r["role"], []).append(r)
    results = {"label": DISCLAIMER, "simulated": True, "assetType": run["assetType"], "assets": run["assets"],
               "personas": rating_summary(by_role.get("persona", []), ids, seed, "personas"),
               "judgeBrief": borda_summary(by_role.get("judge-brief", []), ids, seed, "judge-brief"),
               "judgePlain": borda_summary(by_role.get("judge-plain", []), ids, seed, "judge-plain"),
               "crowd": rating_summary(by_role["crowd"], ids, seed, "crowd") if by_role.get("crowd") else None,
               "consistency": consistency(by_role.get("persona", []), by_role.get("repeat", []), ids),
               "warnings": run["warnings"]}
    results["flags"] = ([f"aborted: the run stopped early ({run['aborted']})"] if run.get("aborted") else []) \
        + flags(results, records)
    return results
