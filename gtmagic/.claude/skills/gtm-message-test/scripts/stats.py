"""The numbers behind a message test (used by evaluate.py). Pure code: no model decides a number.

A "response" here is a cleaned dict: {customerId, segmentId, choice ("hyp_…" or "none"),
ratings {candidateId: {dimension: 1-5}}}. Counting follows docs/CONTRACTS.md → ExperimentResults;
the decoy and head-to-head checks are additions, proposed in references/method.md.
"""
from __future__ import annotations

import random

DIMENSIONS = ("relevance", "credibility", "differentiation", "clarity", "actionIntent")
RESAMPLES = 500             # CONTRACTS.md: bootstrap winner rate over 500 seeded resamples
DIFFERENT_SEGMENT_GAP = 0.10  # another group must beat the owner's guess by this much...
DIFFERENT_SEGMENT_WINS = 0.80  # ...and come first in this share of resamples
UNSTABLE_WINNER = 0.70
CLEAR = 0.975               # proposed: a winner must beat the runner-up and the current message in 97.5% of resamples
                            # (top and runner-up are picked from the same data, so 95% acts like ~90%; 97.5% restores ~5% false calls)
GUESS_STABLE = 0.80         # the owner's guess must come first in this share of resamples to call it a stable result
WILSON_Z = 1.645            # 90% interval for each share
MIN_ANSWERED = 30           # proposed: below this, no message is called a winner
MIN_SEGMENT = 5             # a customer group needs this many answers before it can beat the owner's guess
NOBODY_INTERESTED = 0.5     # if more than half chose "none", no message is called a winner
MIN_REPEATS = 5             # customers asked twice needed before consistency can be checked
STEADY_ENOUGH = 0.9         # repeat agreement that counts as steady however popular the top message is


def mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def wilson(count: int, n: int) -> list[float]:
    """90% Wilson interval for a share: sensible even at 0 of n, unlike resampling, which can't vary a zero."""
    if n == 0:
        return [0.0, 0.0]
    p, z2 = count / n, WILSON_Z ** 2
    centre = (p + z2 / (2 * n)) / (1 + z2 / n)
    half = WILSON_Z * ((p * (1 - p) / n + z2 / (4 * n * n)) ** 0.5) / (1 + z2 / n)
    return [round(max(0.0, centre - half), 4), round(min(1.0, centre + half), 4)]


def quantile(xs: list[float], q: float) -> float:
    s = sorted(xs)
    pos = (len(s) - 1) * q
    lo, hi = int(pos), min(int(pos) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def counts(resps: list[dict], cids: list[str]) -> dict[str, int]:
    c = {cid: 0 for cid in cids}
    c["none"] = 0
    for r in resps:
        c[r["choice"]] = c.get(r["choice"], 0) + 1
    return c


def candidates_table(resps: list[dict], cids: list[str], seg_ids: list[str]) -> list[dict]:
    c, n = counts(resps, cids), len(resps)
    table = []
    for cid in cids:
        rated = [r["ratings"][cid] for r in resps if cid in r["ratings"]]
        table.append({
            "candidateId": cid,
            "choiceCount": c[cid],
            "preferenceShare": round(c[cid] / n, 4) if n else 0.0,
            "dimensionMeans": {d: round(mean([x[d] for x in rated]), 2) for d in DIMENSIONS},
            "segmentBreakdown": [
                {"segmentId": s, "choiceCount": sum(1 for r in resps if r["segmentId"] == s and r["choice"] == cid),
                 "n": sum(1 for r in resps if r["segmentId"] == s)}
                for s in seg_ids
            ],
        })
    return table


def segment_ranking(resps: list[dict], seg_ids: list[str]) -> list[dict]:
    """CONTRACTS.md: score = (1 − noneShare) × mean actionIntent of the chosen option / 5, per segment."""
    rows = []
    for s in seg_ids:
        group = [r for r in resps if r["segmentId"] == s]
        if not group:
            continue
        chose = [r for r in group if r["choice"] != "none"]
        none_share = 1 - len(chose) / len(group)
        intent = mean([r["ratings"].get(r["choice"], {}).get("actionIntent", 0) for r in chose])
        picks: dict[str, int] = {}
        for r in chose:
            picks[r["choice"]] = picks.get(r["choice"], 0) + 1
        best = max(sorted(picks), key=lambda cid: picks[cid]) if picks else "none"
        rows.append({"segmentId": s, "n": len(group), "noneShare": round(none_share, 4),
                     "bestCandidateId": best, "bestShare": round(picks.get(best, 0) / len(group), 4),
                     "actionIntent": round(intent, 2), "score": round((1 - none_share) * intent / 5, 4)})
    return sorted(rows, key=lambda x: (-x["score"], -x["n"], x["segmentId"]))


def icp_verdict(resps: list[dict], seg_ids: list[str], guess: str | None, seed: int) -> tuple[str, float | None]:
    """guess-holds / different-segment / too-close-to-call / no-guess, exactly as CONTRACTS.md defines them."""
    if not guess:
        return "no-guess", None
    ranking = segment_ranking(resps, seg_ids)
    guess_row = next((x for x in ranking if x["segmentId"] == guess), None)
    others = [x for x in ranking if x is not guess_row]
    # Strictly ahead (a tie isn't a hold) of at least one other group, with enough answers on both sides to compare.
    if (guess_row and others and min(x["n"] for x in [guess_row, *others]) >= MIN_SEGMENT
            and all(x["score"] < guess_row["score"] for x in others)):
        return "guess-holds", None
    top = ranking[0] if ranking else None
    if top is None or guess_row is None or top is guess_row:
        return "too-close-to-call", None
    if top["score"] - guess_row["score"] < DIFFERENT_SEGMENT_GAP:
        return "too-close-to-call", None
    if min(top["n"], guess_row["n"]) < MIN_SEGMENT:  # resampling one or two customers shows no spread at all
        return "too-close-to-call", None
    # Resample customers within each segment (the sample is balanced by segment), then re-rank.
    rng = random.Random(seed)
    by_seg = {s: [r for r in resps if r["segmentId"] == s] for s in seg_ids}
    wins = 0
    for _ in range(RESAMPLES):
        sample = [rng.choice(g) for g in by_seg.values() for _ in g]
        ranked = segment_ranking(sample, seg_ids)
        wins += 1 if ranked and ranked[0]["segmentId"] == top["segmentId"] else 0
    rate = wins / RESAMPLES
    return ("different-segment" if rate >= DIFFERENT_SEGMENT_WINS else "too-close-to-call"), round(rate, 3)


def guess_first_rate(resps: list[dict], seg_ids: list[str], guess: str | None, seed: int) -> float | None:
    """How often the owner's guess ranks first when customers are resampled within each segment (an addition:
    CONTRACTS.md's guess-holds has no stability test)."""
    if not guess:
        return None
    rng = random.Random(seed + 1)
    by_seg = {s: [r for r in resps if r["segmentId"] == s] for s in seg_ids}
    first = 0
    for _ in range(RESAMPLES):
        ranked = segment_ranking([rng.choice(g) for g in by_seg.values() for _ in g], seg_ids)
        first += 1 if ranked and ranked[0]["segmentId"] == guess else 0
    return round(first / RESAMPLES, 3)


def bootstrap(resps: list[dict], cids: list[str], top: str, rivals: list[str], seed: int) -> dict:
    """Winner rate, 90% ranges of each share, and how often `top` beats each rival, over seeded resamples."""
    rng = random.Random(seed)
    n = len(resps)
    shares: dict[str, list[float]] = {cid: [] for cid in cids}
    wins, beats = 0.0, {r: 0.0 for r in rivals}
    for _ in range(RESAMPLES):
        c = counts([resps[rng.randrange(n)] for _ in range(n)], cids)
        for cid in cids:
            shares[cid].append(c[cid] / n)
        best = max(c[cid] for cid in cids)
        leaders = [cid for cid in cids if c[cid] == best]
        wins += (1 / len(leaders)) if top in leaders else 0
        for r in rivals:
            beats[r] += 1 if c[top] > c[r] else 0.5 if c[top] == c[r] else 0
    return {"winnerRate": round(wins / RESAMPLES, 3),
            "ranges": {cid: [round(quantile(v, 0.05), 4), round(quantile(v, 0.95), 4)] for cid, v in shares.items()},
            "beats": {r: round(v / RESAMPLES, 3) for r, v in beats.items()}}


def repeat_pairs(main: list[dict], repeats: list[dict]) -> tuple[int, int]:
    """(customers who chose the same option the second time, customers asked twice)."""
    first = {r["customerId"]: r["choice"] for r in main}
    pairs = [(first[r["customerId"]], r["choice"]) for r in repeats if r["customerId"] in first]
    return sum(a == b for a, b in pairs), len(pairs)


def repeat_consistency(main: list[dict], repeats: list[dict]) -> float | None:
    """Share of repeated customers who chose the same option the second time (ordering reversed)."""
    same, pairs = repeat_pairs(main, repeats)
    return round(same / pairs, 3) if pairs else None


def chance_agreement(main: list[dict]) -> float:
    """How often two answers would match by luck alone, given how the choices were spread."""
    c: dict[str, int] = {}
    for r in main:
        c[r["choice"]] = c.get(r["choice"], 0) + 1
    return sum((k / len(main)) ** 2 for k in c.values()) if main else 0.0


def message_checks(table: list[dict], kinds: dict[str, str], heads: dict[str, str], boot: dict,
                   answered: int, none_count: int, repeats: tuple[int, int, float] = (0, 0, 0.0)) -> tuple[list[dict], str, str | None]:
    """Decoy, head-to-head and current-message checks, then the message verdict (proposed additions)."""
    ranked = sorted(table, key=lambda c: -c["choiceCount"])
    top, second = ranked[0], (ranked[1] if len(ranked) > 1 else None)
    pct = lambda x: f"{round(x * 100)}%"  # noqa: E731
    label = lambda c: f"\"{heads.get(c['candidateId'], c['candidateId'])}\" ({c['choiceCount']} of {answered})"  # noqa: E731
    checks: list[dict] = []

    decoy = next((c for c in table if kinds.get(c["candidateId"]) == "decoy"), None)
    if decoy:
        # Fail on how often the decoy was chosen, not its rank: a couple of stray picks shouldn't sink a strong
        # result, but a decoy chosen about as often as an average option means the customers can't tell them apart.
        n, chose_any = len(table), answered - none_count
        limit = max(4, (2 / 3) * chose_any / n) if n else 4
        below = sum(c["choiceCount"] < decoy["choiceCount"] for c in table)
        place = 1 + sum(c["choiceCount"] > decoy["choiceCount"] for c in table)
        detail = f"The generic decoy {label(decoy)} placed {place} of {n}"
        status = "fail" if decoy["choiceCount"] >= limit else "pass" if below <= (1 if n >= 5 else 0) else "warn"
        checks.append({"id": "decoy", "status": status, "detail": detail + {
            "fail": ", about as often as a typical message. Simulated customers can't tell a generic message from a specific one; don't trust the ranking.",
            "pass": ", as it should.",
            "warn": f". {below} real message(s) did worse than this generic one; consider dropping them."}[status]})
    if second:
        rate = boot["beats"].get(second["candidateId"], 0.0)
        checks.append({"id": "winner", "status": "pass" if rate >= CLEAR else "warn",
                       "detail": f"{label(top)} was chosen more often than {label(second)} in {round(rate * RESAMPLES)} of {RESAMPLES} reshuffles of the answers"
                                 + ("." if rate >= CLEAR else "; too close to call.")})
    owner = next((c for c in table if kinds.get(c["candidateId"]) == "founder-current"), None)
    if owner and owner is not top:
        rate = boot["beats"].get(owner["candidateId"], 0.0)
        checks.append({"id": "current-message", "status": "pass" if rate >= CLEAR else "warn",
                       "detail": f"{label(top)} beat the current message {label(owner)} in {round(rate * RESAMPLES)} of {RESAMPLES} reshuffles of the answers."})
    elif owner:
        checks.append({"id": "current-message", "status": "pass", "detail": f"The current message {label(owner)} came first."})
    if answered and (none_count / answered > NOBODY_INTERESTED or none_count >= top["choiceCount"]):
        checks.append({"id": "interest", "status": "warn",
                       "detail": f"{none_count} of {answered} chose none of these messages, at least as many as chose the top one, "
                                 "so none is worth calling a winner."})
    same, pairs, chance = repeats
    if pairs >= MIN_REPEATS:
        # Customers asked twice should repeat themselves clearly more than luck would (chance + 0.15). When one message
        # is so popular that luck alone nearly guarantees a repeat, that bar passes 100%, so 9 in 10 is enough.
        steady = same / pairs > chance + 0.15 or same / pairs >= STEADY_ENOUGH
        checks.append({"id": "consistency", "status": "pass" if steady else "warn",
                       "detail": f"{same} of {pairs} customers asked twice chose the same message again (luck alone: about "
                                 f"{round(chance * pairs)})" + ("." if steady else "; answers aren't steady enough to name a winner.")})
    else:  # no evidence isn't a pass
        checks.append({"id": "consistency", "status": "warn",
                       "detail": f"Only {pairs} customers were asked twice (at least {MIN_REPEATS} are needed), so nobody "
                                 "checked whether answers are steady enough to name a winner."})
    if answered < MIN_ANSWERED:
        checks.append({"id": "sample-size", "status": "warn", "detail": f"Only {answered} answered; at least {MIN_ANSWERED} are needed to call a winner."})

    status = {c["id"]: c["status"] for c in checks}
    if status.get("decoy") == "fail":
        return checks, "unreliable", None
    clear = (kinds.get(top["candidateId"]) != "decoy" and top["choiceCount"] > 0 and answered >= MIN_ANSWERED
             and status.get("winner", "pass") == "pass" and status.get("current-message", "pass") == "pass"
             and "interest" not in status and status.get("consistency", "pass") == "pass")
    return checks, ("clear-winner" if clear else "no-clear-winner"), (top["candidateId"] if clear else None)
