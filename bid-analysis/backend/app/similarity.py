"""Scoring factors and their combination (SRS 11.4). Plain functions over vectors, codes and names, so they
don't depend on the shared data models. A factor returns None when it can't be judged: unknown is not false,
and a None factor is dropped from the score and lowers `completeness` instead."""

import re
from datetime import date
from typing import NamedTuple, Optional

import numpy as np

from .embeddings import embed
from .naics import title_for

# SRS 11.4 starting weights (proposed, not calibrated)
WEIGHTS = {"semantic": 0.45, "code": 0.20, "geography": 0.20, "capacity": 0.10, "availability": 0.05}


class OppCode(NamedTuple):
    scheme: str                    # keep the source's own scheme: "NAICS", "NIGP", ...
    code: str
    label: Optional[str] = None    # code title, used for text comparison when schemes differ


class Scored(NamedTuple):
    score: Optional[float]         # 0..1 over the factors that could be scored; None if none could
    completeness: float            # share of total weight actually scored, 0..1
    factors: dict                  # factor name -> value or None


def semantic_score(vendor_vec: np.ndarray, opp_vec: np.ndarray) -> float:
    """Cosine similarity of normalized vectors (a dot product), clipped to 0..1."""
    return float(np.clip(np.dot(vendor_vec, opp_vec), 0.0, 1.0))


def _lead_digits(code: str) -> str:
    m = re.match(r"\d+", code.strip())    # "31-33" -> "31"
    return m.group() if m else ""


def _prefix_score(a: str, b: str) -> float:
    a, b = _lead_digits(a), _lead_digits(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if len(a) >= 4 and len(b) >= 4 and a[:4] == b[:4]:
        return 0.6
    if len(a) >= 2 and len(b) >= 2 and a[:2] == b[:2]:
        return 0.3
    return 0.0


def code_alignment(vendor_naics: list[str], opp_codes: list[OppCode]) -> Optional[float]:
    """Vendor codes are NAICS. Same scheme: exact 1.0 / same 4 digits 0.6 / same 2-digit sector 0.3.
    Different scheme (e.g. NIGP): compare code titles by embedding. None if either side has no codes."""
    if not vendor_naics or not opp_codes:
        return None
    same_scheme = [c for c in opp_codes if c.scheme.upper() == "NAICS"]
    if same_scheme:
        return max(_prefix_score(v, c.code) for v in vendor_naics for c in same_scheme)
    vendor_titles = [t for t in (title_for(c) for c in vendor_naics) if t]
    opp_titles = [c.label for c in opp_codes if c.label]
    if not vendor_titles or not opp_titles:
        return None
    v, o = embed(["; ".join(vendor_titles), "; ".join(opp_titles)])
    return semantic_score(v, o)


def _county(name: str) -> str:
    return re.sub(r"\s+county$", "", name.strip().lower())


def geography_score(
    service_counties: list[str],
    statewide: bool,
    opp_counties: list[str],
) -> Optional[float]:
    """1.0 if the vendor is statewide or any work county is in the service area (multi-site: any match counts);
    0.0 if the work counties are known and all outside; None if the vendor's area or the work location is unknown."""
    if not opp_counties:                       # unknown, or statewide with no county named
        return None
    if statewide:
        return 1.0
    if not service_counties:
        return None
    area = {_county(c) for c in service_counties}
    return 1.0 if any(_county(c) in area for c in opp_counties) else 0.0


def capacity_score(vendor_items: list[str], required_items: list[str]) -> Optional[float]:
    """Share of required equipment/capabilities the vendor states (case-insensitive substring match).
    None unless both sides state something. Crude on purpose: only what both sides substantiate."""
    if not vendor_items or not required_items:
        return None
    have = [v.lower() for v in vendor_items]
    met = sum(1 for r in required_items if any(r.lower() in h or h in r.lower() for h in have))
    return met / len(required_items)


def availability_score(vendor_available_from: Optional[date], work_starts: Optional[date]) -> Optional[float]:
    """1.0 if the vendor is available by the published work start, else 0.0. None unless both are stated.
    Never infer a start date from a bid deadline."""
    if vendor_available_from is None or work_starts is None:
        return None
    return 1.0 if vendor_available_from <= work_starts else 0.0


def combine(factors: dict[str, Optional[float]]) -> Scored:
    """Weighted mean over the factors that could be scored (weights re-normalized), plus completeness.
    The score alone can look high when little was scored, so labels must also check completeness."""
    unknown = set(factors) - set(WEIGHTS)
    if unknown:
        raise ValueError(f"unknown factors: {sorted(unknown)}")
    scored = {k: v for k, v in factors.items() if v is not None}
    weight_scored = sum(WEIGHTS[k] for k in scored)
    completeness = weight_scored / sum(WEIGHTS.values())
    if not scored:
        return Scored(None, 0.0, dict(factors))
    score = sum(WEIGHTS[k] * v for k, v in scored.items()) / weight_scored
    return Scored(score, completeness, dict(factors))


def category_alignment(vendor_services: list[str], bid_categories: list[str], adjacent: dict[str, set[str]] | None = None) -> Optional[float]:
    """Share of the bid's categories the vendor covers (both sides use the same work-category ids).
    A category the vendor only covers through an adjacent one (e.g. paving for pothole repair) counts half.
    None if the vendor lists no services or the bid has no usable category ('other' means unclear)."""
    cats = [c for c in bid_categories if c != "other"]
    if not vendor_services or not cats:
        return None
    adjacent = adjacent or {}
    svc = set(vendor_services)
    near = {a for s in svc for a in adjacent.get(s, set())}
    return sum(1.0 if c in svc else 0.5 if c in near else 0.0 for c in cats) / len(cats)
