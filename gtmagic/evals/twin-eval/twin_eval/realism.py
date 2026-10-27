"""Two checks on the "LLM averaging" risk from the GTMagic plan.

- spread: are simulated answers as varied as real people's, or does every
  simulated person give the same answer? 1.0 means as varied as humans.
- invented personas: when Claude invents the people, do their demographics
  look like the real population? Measured as total variation distance (0 = same
  mix, 1 = no overlap) per attribute, next to the gap a real random sample of
  the same size shows by chance.
"""
from __future__ import annotations

import statistics
from collections import Counter
from typing import Dict, List

from .data import Dataset
from .metrics import _human, match_rate, norm_entropy, references
from .tasks import EXPERIMENTS, PRICING_COLUMNS, condition_for


def spread(ds: Dataset, pids: List[str], recs: Dict[str, dict]) -> dict:
    ratios: List[float] = []
    zero_spread: List[str] = []
    columns = list(PRICING_COLUMNS) + [c.score_column for e in EXPERIMENTS for c in e.conditions]
    for col in columns:
        q = ds.questions[col]
        if q.kind != "choice":
            continue
        seen = [p for p in pids if p in recs and recs[p]["answers"].get(col) is not None]
        if len(seen) < 5:
            continue
        human = [v for v in (_human(ds, p, col, "wave4") for p in seen) if v is not None]
        sim = [recs[p]["answers"][col] for p in seen]
        h, s = norm_entropy(human, len(q.options)), norm_entropy(sim, len(q.options))
        if h:
            ratios.append(s / h)
        if len(set(sim)) == 1:
            zero_spread.append(col)
    return {
        "questions": len(ratios),
        "medianRatio": round(statistics.median(ratios), 3) if ratios else None,
        "everyoneSameAnswer": len(zero_spread),
    }


def framing_individual(ds: Dataset, pids: List[str], recs: Dict[str, dict], seed: int) -> dict:
    """Exact-match rate on the framing questions each twin actually saw."""
    choice_cols = [c.score_column for e in EXPERIMENTS for c in e.conditions
                   if ds.questions[c.score_column].kind == "choice"]
    seen = lambda p, c: any(cond.score_column == c for cond in   # noqa: E731
                            (condition_for(ds.respondents[p], e) for e in EXPERIMENTS) if cond)
    sim = lambda p, c: recs[p]["answers"].get(c) if p in recs and seen(p, c) else None   # noqa: E731
    answered = [p for p in pids if p in recs]
    return match_rate(ds, answered, choice_cols, sim, seed)


def framing_references(ds: Dataset, pids: List[str], seed: int) -> dict:
    choice_cols = [c.score_column for e in EXPERIMENTS for c in e.conditions
                   if ds.questions[c.score_column].kind == "choice"]
    return references(ds, pids, choice_cols, seed)


def _tvd(a: Counter, b: Counter) -> float:
    na, nb = sum(a.values()), sum(b.values())
    keys = set(a) | set(b)
    return 0.5 * sum(abs(a[k] / na - b[k] / nb) for k in keys) if na and nb else 1.0


def invented_personas(ds: Dataset, pids: List[str], recs: Dict[str, dict]) -> dict:
    invented = [recs[p]["invented"] for p in pids if p in recs and recs[p].get("invented")]
    if not invented:
        return {"people": 0, "attributes": []}
    rows = []
    for q in ds.demographic_questions:
        population = Counter(r.wave1_3[q.column] for r in ds.respondents.values() if r.wave1_3.get(q.column))
        sample = Counter(ds.respondents[p].wave1_3[q.column] for p in pids if ds.respondents[p].wave1_3.get(q.column))
        made_up = Counter(i[q.column] for i in invented if i.get(q.column))
        top_real = population.most_common(1)[0][0]
        top_made = made_up.most_common(1)[0]
        rows.append({
            "question": q.text,
            "inventedGap": round(_tvd(made_up, population), 3),
            "realSampleGap": round(_tvd(sample, population), 3),
            "mostCommonInvented": f"{top_made[0]} ({top_made[1]} of {len(invented)})",
            "mostCommonReal": f"{top_real} ({population[top_real] / sum(population.values()):.0%})",
        })
    rows.sort(key=lambda r: r["inventedGap"] - r["realSampleGap"], reverse=True)
    distinct = len({tuple(sorted(i.items())) for i in invented})
    return {"people": len(invented), "distinctProfiles": distinct, "attributes": rows}
