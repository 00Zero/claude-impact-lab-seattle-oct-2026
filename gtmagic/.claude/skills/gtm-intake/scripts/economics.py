"""Unit economics, size math and prior-ad verdicts (used by validate_intake.py and creatives.py).

Every figure comes from the owner's own inputs: price, purchases per year, minimum revenue, cost
to serve, the share they choose to spend on acquisition, and their adoption estimate. Nothing here
is a benchmark: a missing input leaves its figure null instead of falling back to a default.
"""
from __future__ import annotations

import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # avoid a runtime import cycle; only the type is needed
    from validate_intake import Report

# Minimum volume before an ad result means anything: validation thresholds, not business assumptions.
MIN_CLICKS, MIN_CONVERSIONS = 100, 10
AD_FIGURES = ("spend", "impressions", "clicks", "conversions")


def num(value: object, r: Report | None, field: str) -> float | None:
    """Parse a number the model or a file supplied; record an error instead of crashing.

    Pass r=None to re-read a value already checked elsewhere, so a bad value isn't reported twice.
    """
    if value is None or value == "":
        return None
    try:
        if isinstance(value, bool):  # JSON true/false is not a count; float(True) would quietly give 1
            raise TypeError
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        if r is not None:
            r.errors.append(f"{field}: '{value}' is not a number")
        return None


def ad_figures(px: dict, r: Report | None) -> dict[str, float | None]:
    """One result's spend and metrics, each checked once: a finite number, zero or more. None = not recorded.

    compute_ads reports problems; creatives re-read with r=None so nothing is reported twice.
    """
    pid, metrics = px.get("id"), px.get("metrics")
    if not isinstance(metrics, dict):
        if metrics is not None and r is not None:
            r.errors.append(f"{pid}.metrics: must be an object")
        metrics = {}
    out: dict[str, float | None] = {}
    for key in AD_FIGURES:
        raw = px.get("spend") if key == "spend" else metrics.get(key)
        value = num(raw, r, f"{pid}.{key}")
        if value is not None and (not math.isfinite(value) or value < 0):
            if r is not None:
                r.errors.append(f"{pid}.{key}: '{raw}' must be a finite number, zero or more")
            value = None
        out[key] = value
    return out


def share(biz: dict, field: str, r: Report) -> float | None:
    """An owner-confirmed share between 0 and 1 (0 is valid). Out of range is an error, not a guess."""
    value = num(biz.get(field), r, field)
    if value is not None and not 0 <= value <= 1:
        r.errors.append(f"business.{field}: {value:g} must be a share between 0 and 1 (e.g. 0.4 for 40%)")
        return None
    return value


def annual_revenue(biz: dict, r: Report) -> float | None:
    pricing = biz.get("pricing") or {}
    price = num(pricing.get("amount"), r, "pricing.amount")
    per_year = num(pricing.get("purchasesPerYear"), r, "purchasesPerYear")
    for field, value in (("pricing.amount", price), ("purchasesPerYear", per_year)):
        if value is not None and value <= 0:
            r.errors.append(f"{field}: {value:g} must be greater than zero")
            return None
    return round(price * per_year, 2) if price is not None and per_year is not None else None


def size_math(biz: dict, r: Report) -> dict:
    """Customers needed to reach the owner's minimum revenue, and the smallest group that could supply them."""
    annual = annual_revenue(biz, r)
    goal = num(biz.get("revenueGoal12mo"), r, "revenueGoal12mo")
    rate = share(biz, "adoptionRate", r)
    needed = math.ceil(goal / annual) if goal is not None and annual else None
    min_pop = math.ceil(needed / rate) if needed is not None and rate else None
    return {"customersNeeded": needed, "adoptionRate": rate, "minPopulation": min_pop}


def compute_unit_economics(brief: dict, r: Report) -> tuple[float | None, str]:
    """What a customer is worth, the break-even and chosen max cost per sign-up, and the margin left."""
    biz = brief.setdefault("business", {})
    annual = annual_revenue(biz, r)
    owner_target = num(biz.get("targetCpa"), r, "targetCpa")
    acq, serve = share(biz, "acquisitionShare", r), share(biz, "costToServeShare", r)
    max_cac = round(annual * acq, 2) if annual is not None and acq is not None else None
    break_even = round(annual * (1 - serve), 2) if annual is not None and serve is not None else None
    margin = round(1 - serve - acq, 4) if serve is not None and acq is not None else None
    if margin is not None and margin < 0:
        r.warnings.append(f"business: serving costs ({serve:.0%}) plus acquisition ({acq:.0%}) exceed first-year revenue; "
                          "each new customer loses money in year one")
    elif margin == 0:
        r.warnings.append("business: serving costs plus acquisition use all first-year revenue; each new customer only breaks even")
    target = owner_target if owner_target is not None else max_cac
    source = "owner" if owner_target is not None else "derived" if max_cac is not None else "none"
    biz["unitEconomics"] = {"annualRevenuePerCustomer": annual, "maxCac": max_cac, "breakEvenCac": break_even,
                            "firstYearMarginShare": margin,
                            "firstYearMargin": round(annual * margin, 2) if annual is not None and margin is not None else None,
                            "targetCpaUsed": target, "targetCpaSource": source}
    r.notes.append(f"unit economics: {annual} per customer per year; break-even {break_even}; max cost per sign-up {max_cac}; "
                   f"judging ads by {target} ({source})")
    return target, source


def judge_ad(spend: float | None, clicks: float | None, conversions: float | None, kind: str | None,
             target: float | None, source: str) -> tuple[str, str]:
    """One ad result against the owner's target, as (verdict, plain-words reason).

    Shared by prior experiments and creatives (via their linked results), so the two can never disagree.
    The first blocking reason wins, so the brief explains *why* a result is inconclusive. A figure that
    wasn't recorded is said so, never treated as zero.
    """
    reason = ("no target cost per sign-up, and not enough numbers to work one out" if target is None else
              "these sign-ups were free trials, not paying customers" if kind == "trial" else
              "we don't know whether these sign-ups were paying customers" if kind != "paying" else
              "no spend was recorded" if spend is None else
              "clicks weren't recorded" if clicks is None else
              f"fewer than {MIN_CLICKS} clicks" if clicks < MIN_CLICKS else
              "sign-ups weren't recorded" if conversions is None else
              f"fewer than {MIN_CONVERSIONS} sign-ups" if conversions < MIN_CONVERSIONS else None)
    if reason:
        return "inconclusive", reason
    cpa = spend / conversions  # type: ignore[operator]  (no reason means spend, target and conversions are set)
    label = "most you can spend, worked out from your numbers" if source == "derived" else "target"
    return ("worked" if cpa <= target else "didnt-work",
            f"cost per sign-up {cpa:.2f} {'within' if cpa <= target else 'above'} the {target:g} {label}")


def compute_ads(brief: dict, r: Report) -> tuple[float | None, str]:
    """Judge every prior experiment; returns the target and its source so creatives are judged the same way."""
    target, source = compute_unit_economics(brief, r)
    for px in brief.get("priorExperiments", []):
        fig = ad_figures(px, r)
        px["verdict"], px["verdictReason"] = judge_ad(fig["spend"], fig["clicks"], fig["conversions"],
                                                      px.get("conversionType"), target, source)
        shown = ", ".join(f"{k}={'not recorded' if v is None else f'{v:g}'}" for k, v in fig.items())
        r.notes.append(f"ad {px.get('id')}: {shown} -> {px['verdict']} ({px['verdictReason']})")
    return target, source
