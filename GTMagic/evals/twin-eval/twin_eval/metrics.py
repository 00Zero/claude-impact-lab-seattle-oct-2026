"""Every number in the report is computed here, in plain code.

Scores compare each arm's simulated answers with the real twin's wave-4
answers. Two references bound them:
- ceiling: the same real people answering the same question in waves 1-3
  (test-retest). A simulation can't be expected to beat a person's own
  consistency.
- floor: predicting the most common wave 1-3 answer for everyone.
"""
from __future__ import annotations

import math
import random
import statistics
from collections import Counter
from typing import Callable, Dict, List, Optional, Sequence

from .data import Dataset
from .tasks import EXPERIMENTS, PRICING_COLUMNS, condition_for, encode_label

BOOTSTRAP_RESAMPLES = 500
SMALL_EFFECT = 0.02   # human effects under 2% of the scale are too small to call a direction


def pearson(xs: Sequence[float], ys: Sequence[float]) -> Optional[float]:
    if len(xs) < 3 or len(set(xs)) < 2 or len(set(ys)) < 2:
        return None
    return statistics.correlation(xs, ys) if hasattr(statistics, "correlation") else _pearson(xs, ys)


def _pearson(xs: Sequence[float], ys: Sequence[float]) -> float:
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return sxy / (sx * sy)


def bootstrap_ci(per_unit: Dict[str, List[int]], seed: int) -> Optional[List[float]]:
    """95% interval for a match rate, resampling people (not answers)."""
    units = sorted(per_unit)
    if len(units) < 2:
        return None
    rng = random.Random(seed)
    rates = []
    for _ in range(BOOTSTRAP_RESAMPLES):
        hits = total = 0
        for u in (rng.choice(units) for _ in units):
            hits += sum(per_unit[u])
            total += len(per_unit[u])
        rates.append(hits / total if total else 0.0)
    rates.sort()
    return [round(rates[int(0.025 * len(rates))], 4), round(rates[int(0.975 * len(rates)) - 1], 4)]


def _human(ds: Dataset, pid: str, col: str, wave: str) -> Optional[float]:
    r = ds.respondents[pid]
    return encode_label(ds.questions[col], (r.wave4 if wave == "wave4" else r.wave1_3).get(col, ""))


def match_rate(ds: Dataset, pids: List[str], cols: List[str],
               predict: Callable[[str, str], Optional[float]], seed: int) -> dict:
    per_pid: Dict[str, List[int]] = {}
    for pid in pids:
        for col in cols:
            truth = _human(ds, pid, col, "wave4")
            guess = predict(pid, col)
            if truth is None or guess is None:
                continue
            per_pid.setdefault(pid, []).append(int(guess == truth))
    hits = sum(sum(v) for v in per_pid.values())
    n = sum(len(v) for v in per_pid.values())
    return {"rate": round(hits / n, 4) if n else None, "matches": hits, "n": n,
            "people": len(per_pid), "ci95": bootstrap_ci(per_pid, seed)}


def references(ds: Dataset, pids: List[str], cols: List[str], seed: int) -> dict:
    majority: Dict[str, Optional[float]] = {}
    for col in cols:
        counts = Counter(v for v in (_human(ds, p, col, "wave1_3") for p in ds.respondents) if v is not None)
        majority[col] = counts.most_common(1)[0][0] if counts else None
    return {
        "retest_ceiling": match_rate(ds, pids, cols, lambda p, c: _human(ds, p, c, "wave1_3"), seed),
        "majority_floor": match_rate(ds, pids, cols, lambda p, c: majority[c], seed),
    }


def norm_entropy(values: List[float], k: int) -> Optional[float]:
    if not values or k < 2:
        return None
    counts = Counter(values)
    h = -sum((c / len(values)) * math.log(c / len(values)) for c in counts.values())
    return h / math.log(k)


def pricing(ds: Dataset, pids: List[str], recs: Dict[str, dict], seed: int) -> dict:
    sim = lambda p, c: recs[p]["answers"].get(c) if p in recs else None   # noqa: E731
    answered = [p for p in pids if p in recs]
    buy_sim, buy_human = [], []
    for col in PRICING_COLUMNS:
        # Only people with both a simulated and a real answer, so both rates cover the same people.
        pairs = [(s, h) for s, h in ((sim(p, col), _human(ds, p, col, "wave4")) for p in answered)
                 if s is not None and h is not None]
        if not pairs:
            continue   # nothing to compare: leave the product out rather than score it 0%
        buy_sim.append(sum(s == 0 for s, _ in pairs) / len(pairs))
        buy_human.append(sum(h == 0 for _, h in pairs) / len(pairs))
    totals_sim, totals_human = [], []
    for p in answered:
        s = [sim(p, c) for c in PRICING_COLUMNS if sim(p, c) is not None]
        h = [_human(ds, p, c, "wave4") for c in PRICING_COLUMNS]
        if len(s) == len(PRICING_COLUMNS) and None not in h:
            totals_sim.append(sum(v == 0 for v in s))
            totals_human.append(sum(v == 0 for v in h))
    sd = lambda xs: round(statistics.pstdev(xs), 2) if xs else None   # noqa: E731
    mean = lambda xs: round(statistics.fmean(xs), 4) if xs else None   # noqa: E731
    corr_products = pearson(buy_sim, buy_human)
    corr_people = pearson(totals_sim, totals_human)
    return {
        "individual": match_rate(ds, answered, PRICING_COLUMNS, sim, seed),
        "productBuyShare": {
            "products": len(buy_sim),
            "meanAbsError": mean([abs(a - b) for a, b in zip(buy_sim, buy_human)]),
            "correlation": None if corr_products is None else round(corr_products, 3),
            "simulatedOverall": mean(buy_sim),
            "humanOverall": mean(buy_human),
        },
        "productsBoughtPerPerson": {
            "people": len(totals_sim),
            "correlationWithTwin": None if corr_people is None else round(corr_people, 3),
            "simulatedSd": sd(totals_sim), "humanSd": sd(totals_human),
        },
    }


def _stat(values: List[float], how: str) -> Optional[float]:
    if not values:
        return None
    return statistics.median(values) if how == "median" else statistics.fmean(values)


def framing(ds: Dataset, pids: List[str], recs: Dict[str, dict]) -> dict:
    rows, h_effects, s_effects = [], [], []
    calls = agree = 0
    for exp in EXPERIMENTS:
        groups = {c.label: {"human": [], "sim": []} for c in exp.conditions}
        for pid in pids:
            cond = condition_for(ds.respondents[pid], exp)
            if cond is None:
                continue
            h = _human(ds, pid, cond.score_column, "wave4")
            s = recs[pid]["answers"].get(cond.score_column) if pid in recs else None
            if h is not None:
                groups[cond.label]["human"].append(h)
            if s is not None:
                groups[cond.label]["sim"].append(s)
        first = exp.conditions[0]
        q0 = ds.questions[first.score_column]
        if q0.kind == "choice":
            scale = len(q0.options) - 1
        else:
            pooled = [v for g in groups.values() for v in g["human"]]
            scale = statistics.pstdev(pooled) if len(pooled) > 1 else 1.0
        conditions = []
        for c in exp.conditions:
            g = groups[c.label]
            conditions.append({"label": c.label, "humanN": len(g["human"]), "simN": len(g["sim"]),
                               "human": _round(_stat(g["human"], exp.stat)),
                               "simulated": _round(_stat(g["sim"], exp.stat))})
        contrasts = []
        base = conditions[0]
        for c in conditions[1:]:
            if None in (base["human"], c["human"], base["simulated"], c["simulated"]) or not scale:
                continue
            h_eff = (c["human"] - base["human"]) / scale
            s_eff = (c["simulated"] - base["simulated"]) / scale
            callable_ = abs(h_eff) >= SMALL_EFFECT
            same = callable_ and (h_eff > 0) == (s_eff > 0) and s_eff != 0
            calls += callable_
            agree += same
            h_effects.append(h_eff)
            s_effects.append(s_eff)
            contrasts.append({"vs": f"{c['label']} vs {base['label']}", "condition": c["label"],
                              "humanEffect": round(h_eff, 3), "simulatedEffect": round(s_eff, 3),
                              "direction": "matches" if same else ("too small" if not callable_ else "wrong")})
        rows.append({"key": exp.key, "title": exp.title, "stat": exp.stat, "meaning": exp.meaning,
                     "conditions": conditions, "contrasts": contrasts})
    corr = pearson(s_effects, h_effects)
    return {"experiments": rows, "directionMatches": agree, "directionCallable": calls,
            "effectCorrelation": None if corr is None else round(corr, 3)}


def _round(v: Optional[float]) -> Optional[float]:
    return None if v is None else round(v, 3)
