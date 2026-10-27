"""Fit tier, reasons and ranking score for one bid against one confirmed profile.

Ported from the frontend's src/lib/sim/match.ts (same tier rules, same reason wording) and extended with:
semantic similarity (orders results; decides only when a bid has no usable category), adjacent categories,
and a completeness gate. Rules decide labels; similarity never produces "Not a fit" on its own.
Unknown is not false: missing profile info becomes an unknown + clarification, never a conflict."""

from datetime import datetime, timezone
from typing import Optional

from .config import MIN_COMPLETENESS, RANKING_VERSION, SEMANTIC_GOOD, SEMANTIC_POSSIBLE
from .models import Bid, FitAssessment, FitStatement, FitTier, ProfileFieldName, VendorProfile
from .similarity import category_alignment, combine, geography_score
from .taxonomy import ADJACENT, category_label, specific_categories

PRIME_TYPES = {"itb", "rfp", "rfq", "small_works"}

# Bid requirement strings we can check against a profile field. Insurance can be arranged before award,
# so unknown insurance never caps the tier; unknown registration or bonding does.
TRACKED = {
    "licensed": ("contractor_registration", "contractorRegistration", "an active Washington contractor registration", True),
    "bonded": ("bonding", "bonding", "a bid bond", True),
    "insured": ("insurance", "insurance", "liability insurance", False),
}


def _list(xs: list[str]) -> str:
    return "".join(xs) if len(xs) <= 1 else f"{', '.join(xs[:-1])} and {xs[-1]}"


def _s(text: str, fields: list[ProfileFieldName] | None = None) -> FitStatement:
    return FitStatement(text=text, profile_fields=fields or [])


def assess(bid: Bid, profile: VendorProfile, semantic: Optional[float] = None, now: Optional[datetime] = None) -> FitAssessment:
    reasons: list[FitStatement] = []
    mismatches: list[FitStatement] = []
    unknowns: list[FitStatement] = []
    clar: list[str] = []
    conflict = review = cap = False

    # ---- scope (work categories; the list is closed, so a mismatch is a supported conflict)
    cats = specific_categories(bid.categories)
    svc = profile.core_services.value or []
    excl = profile.exclusions.value or []
    if not svc:
        review = True
        unknowns.append(_s("Your services aren't in your profile yet, so the scope wasn't compared.", ["coreServices"]))
        clar.append("Add the kinds of work you do.")
    elif not cats:
        # No usable category: similarity decides between Possible fit and Needs review, never Not a fit.
        if semantic is not None and semantic >= SEMANTIC_POSSIBLE:
            cap = True
            unknowns.append(_s("The listing doesn't label its scope, but its wording resembles your services. Read it closely.", ["coreServices"]))
        else:
            review = True
            unknowns.append(_s("The listing doesn't describe the scope clearly enough to compare with your services."))
    else:
        direct = [c for c in cats if c in svc]
        near = [c for c in cats if c not in direct and c not in excl and any(c in ADJACENT.get(s, ()) for s in svc)]
        excluded = [c for c in cats if c in excl]
        other = [c for c in cats if c not in direct and c not in near and c not in excl]
        if len(excluded) == len(cats):
            conflict = True
            mismatches.append(_s(f"This job is {_list([category_label(c).lower() for c in excluded])} work, which you said you don't do.", ["exclusions"]))
        elif not direct and not near:
            conflict = True
            mismatches.append(_s(f"The scope is {_list([category_label(c).lower() for c in cats])}. Your confirmed services don't include it.", ["coreServices"]))
        else:
            if direct:
                reasons.append(_s(f"Matches your {_list([category_label(c).lower() for c in direct])} services.", ["coreServices"]))
            if near:
                cap = True
                unknowns.append(_s(f"The job is {_list([category_label(c).lower() for c in near])}, which is close to but not exactly your listed services.", ["coreServices"]))
                clar.append(f"Add {_list([category_label(c).lower() for c in near])} to your services if you do that work.")
            if excluded:
                cap = True
                mismatches.append(_s(f"Part of the scope is {_list([category_label(c).lower() for c in excluded])}, which you excluded. You may need a partner for that part.", ["exclusions"]))
            if other:
                cap = True
                unknowns.append(_s(f"The job also includes {_list([category_label(c).lower() for c in other])}, which isn't in your profile.", ["coreServices"]))
                clar.append(f"Add {_list([category_label(c).lower() for c in other])} to your services if you do that work.")

    # ---- geography (place of performance; a bid row carries one county)
    area = profile.service_area.value
    bid_counties = [bid.county] if bid.county else []
    geo: Optional[float] = None
    if area is None:
        cap = True
        unknowns.append(_s("Your service area isn't set, so location wasn't compared.", ["serviceArea"]))
    elif not bid_counties:
        review = True
        unknowns.append(_s("The listing doesn't say where the work happens.", ["serviceArea"]))
    else:
        statewide = area.kind == "statewide"
        geo = geography_score([] if statewide else area.counties, statewide, bid_counties)
        county = f"{bid.county} County"
        if statewide:
            reasons.append(_s(f"Work is in {county}, inside your statewide service area.", ["serviceArea"]))
        elif geo == 1.0:
            reasons.append(_s(f"Work is in {county}, inside your service area.", ["serviceArea"]))
        else:
            conflict = True
            mismatches.append(_s(f"Work is in {county}, outside your service area ({_list(area.counties)}).", ["serviceArea"]))

    # ---- published requirements (strings on the bid; treated as mandatory). Unknown is not false.
    for r in bid.requirements:
        if r in TRACKED:
            attr, field, name, material = TRACKED[r]
            v = getattr(profile, attr).value
            if v == "no":
                conflict = True
                mismatches.append(_s(f"The listing requires {name}. Your profile says you don't have it.", [field]))
            elif v == "yes":
                reasons.append(_s(f"Requires {name}, which your profile confirms.", [field]))
            else:
                cap = cap or material
                unknowns.append(_s(f"Requires {name}. Your status isn't in your profile yet.", [field]))
                clar.append(f"Confirm whether you have {name}.")
        elif r == "small_works_roster":
            cap = True
            unknowns.append(_s("Requires being on a small works roster. Your status isn't in your profile yet.", ["contractorRegistration"]))
            clar.append("Confirm whether you're on the agency's small works roster.")
        else:
            unknowns.append(_s(f"Check before bidding: {r.replace('_', ' ')}."))
    if not bid.requirements:
        unknowns.append(_s("No requirements were extracted for this listing. Read the full solicitation before bidding."))

    # ---- role: never invent a subcontract opening from a prime solicitation (REC-10)
    if profile.role_interest.value == "subcontract" and bid.bid_type in PRIME_TYPES:
        cap = True
        unknowns.append(_s("This solicitation is for prime contractors. Any subcontract work would depend on who wins.", ["roleInterest"]))

    # ---- score and completeness (capacity/availability are not on bid rows, so they stay unscored)
    scored = combine({
        "semantic": semantic,
        "code": category_alignment(svc, cats, ADJACENT),
        "geography": geo,
        "capacity": None,
        "availability": None,
    })

    tier: FitTier
    if conflict:
        tier = "not_a_fit"
    elif review:
        tier = "needs_review"
    elif scored.completeness < MIN_COMPLETENESS:
        tier = "needs_review"
        unknowns.append(_s("There isn't enough information to judge this one yet."))
    elif cap or (semantic is not None and semantic < SEMANTIC_GOOD):
        tier = "possible_fit"
    else:
        tier = "good_fit"

    return FitAssessment(
        opportunity_id=str(bid.id),
        opportunity_version=(bid.updated_at or bid.last_checked or datetime(1970, 1, 1, tzinfo=timezone.utc)).isoformat(),
        profile_id=profile.id,
        profile_revision=profile.revision,
        state="assessed",
        tier=tier,
        ranking_score=None if scored.score is None else round(scored.score, 3),
        reasons=reasons,
        mismatches=mismatches,
        unknowns=unknowns,
        suggested_clarifications=list(dict.fromkeys(clar)),
        assessed_at=now or datetime.now(timezone.utc),
        ranking_version=RANKING_VERSION,
    )


TIER_ORDER = {"good_fit": 0, "possible_fit": 1, "needs_review": 2, "not_a_fit": 3}


def sort_key(a: FitAssessment):
    return (TIER_ORDER[a.tier], -(a.ranking_score or 0.0))
