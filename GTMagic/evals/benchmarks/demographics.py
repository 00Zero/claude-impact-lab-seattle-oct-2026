"""Draw demographics for simulated customers from research-sourced distributions. Code only; no model ever "picks".

Quota sampling, the way pollsters build a small panel: within each segment, the first QUOTA_DIMS get exact
counts that match their distribution (largest-remainder rounding), shuffled across people; every other dimension
is an independent seeded draw. With 30 people, pure random draws could easily give 50/50 on a 63/37 split.
"""
from __future__ import annotations

import random

QUOTA_DIMS = ("gender", "ageBand")
AGE_RANGE = {"18-24": (18, 24), "25-34": (25, 34), "35-44": (35, 44), "45-54": (45, 54), "55-64": (55, 64),
             "18-29": (18, 29), "30-49": (30, 49), "50-64": (50, 64), "65+": (65, 78), "65-74": (65, 74), "75+": (75, 84)}
LABEL = {"gender": "Gender", "ageBand": "Age", "raceEthnicity": "Race/ethnicity", "education": "Education",
         "householdIncome": "Household income", "region": "Region", "community": "Community",
         "employment": "Work", "household": "Household"}


def _norm(values: list[dict]) -> list[tuple[str, float]]:
    vals = [(str(v["value"]), max(0.0, float(v.get("weight", 0)))) for v in values if v.get("value") is not None]
    total = sum(w for _, w in vals) or 1.0
    return [(v, w / total) for v, w in vals]


def quota(values: list[dict], n: int, rng: random.Random) -> list[str]:
    vals = _norm(values)
    raw = [(v, n * w) for v, w in vals]
    counts = {v: int(x) for v, x in raw}
    for v, x in sorted(raw, key=lambda r: -(r[1] - int(r[1])))[: n - sum(counts.values())]:
        counts[v] += 1
    out = [v for v, _ in raw for _ in range(counts[v])]
    rng.shuffle(out)
    return out


def assign(alloc: list[str], demographics: dict[str, list[dict]], rng: random.Random) -> list[dict]:
    """alloc[i] = segmentId of person i; demographics[segmentId] = [{"name", "values", "source"}]. Returns one dict per person."""
    people: list[dict] = [{} for _ in alloc]
    for sid in dict.fromkeys(alloc):
        idx = [i for i, s in enumerate(alloc) if s == sid]
        for dim in demographics.get(sid, []):
            if not dim.get("values"):
                continue
            if dim["name"] in QUOTA_DIMS:
                for i, v in zip(idx, quota(dim["values"], len(idx), rng)):
                    people[i][dim["name"]] = v
            else:
                vals = _norm(dim["values"])
                for i in idx:
                    people[i][dim["name"]] = rng.choices([v for v, _ in vals], [w for _, w in vals])[0]
    for p in people:  # an exact age inside the band, so cards read like a person, not a bracket
        band = str(p.get("ageBand", "")).replace("–", "-").replace(" ", "")
        lo_hi = AGE_RANGE.get(band)
        if lo_hi:
            p["age"] = rng.randint(*lo_hi)
    for i, sid in enumerate(alloc):  # redraw employment when it contradicts the age (at most 20 tries)
        dim = next((d for d in demographics.get(sid, []) if d["name"] == "employment" and d.get("values")), None)
        for _ in range(20):
            if not dim or not _incoherent(people[i]):
                break
            vals = _norm(dim["values"])
            people[i]["employment"] = rng.choices([v for v, _ in vals], [w for _, w in vals])[0]
    return people


def _label(k: str) -> str:
    if k in LABEL:
        return LABEL[k]
    import re
    words = re.sub(r"(?<!^)([A-Z])", r" \1", k).lower()
    return words[0].upper() + words[1:]


def _incoherent(p: dict) -> bool:
    """Combinations independent draws can produce but real people rarely are."""
    age, work = p.get("age"), str(p.get("employment", "")).lower()
    return age is not None and ((age >= 65 and "student" in work) or (age < 25 and "retired" in work))


def render(p: dict) -> list[str]:
    lines = []
    if "age" in p or "gender" in p:
        lines.append(f"- You: {p.get('age', p.get('ageBand', ''))}-year-old {p.get('gender', 'person')}".replace("--", "-"))
    for k, v in p.items():
        if k not in ("age", "ageBand", "gender"):
            lines.append(f"- {_label(k)}: {v}")
    return lines
