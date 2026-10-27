"""Turn a vendor profile or a bid into text. Kept short: MiniLM truncates around 256 tokens.

`profile_info` is the text form of everything onboarding collects; it is stored in the user's `info` column.
The vector in `embed` is built from the same text without the exclusions line (embeddings don't understand
negation: "Does not do: concrete" would pull concrete bids closer). Exclusions are still enforced by the rules."""

from typing import Optional

from .models import Bid, VendorProfileFields
from .naics import title_for
from .taxonomy import category_label, specific_categories

GOVERNMENT_EXPERIENCE = {
    "first_time": "first time bidding on government work",
    "subcontractor": "has done government work as a subcontractor",
    "prime": "has done government work as a prime contractor",
}
PROJECT_SCALE = {
    "small_repairs": "small repairs", "maintenance": "maintenance", "multi_crew": "multi-crew projects",
    "larger_projects": "larger projects",
}
ROLE = {"prime": "prime contractor", "subcontract": "subcontractor", "both": "prime or subcontractor", "unsure": "not sure yet"}


def _words(text: Optional[str], n: int) -> str:
    return " ".join((text or "").split()[:n])


def _join(items: list[str]) -> str:
    return ", ".join(i for i in items if i)


def profile_info(profile: VendorProfileFields, original_description: Optional[str] = None, include_exclusions: bool = True) -> str:
    """One line per fact the vendor gave us. Unknown fields are left out, never written as "unknown"."""
    lines: list[str] = []

    def add(label: str, value) -> None:
        if value not in (None, "", []):
            lines.append(f"{label}: {value}")

    add("Business name", profile.business_name.value)
    add("Based in", profile.base_location.value)
    area = profile.service_area.value
    if area is not None:
        add("Service area", "Statewide in Washington" if area.kind == "statewide" else f"{_join(area.counties)} County" if len(area.counties) == 1 else f"{_join(area.counties)} Counties")
    add("Services", _join([category_label(c) for c in profile.core_services.value or []]))
    if include_exclusions:
        add("Does not do", _join([category_label(c) for c in profile.exclusions.value or []]))
    add("Specialties", _join(profile.specialties.value or []))
    add("Crew size", profile.crew_size.value)
    add("Equipment", _join(profile.equipment.value or []))
    add("Typical project size", PROJECT_SCALE.get(profile.project_scale.value or ""))
    add("Relevant past work", profile.relevant_experience.value)
    add("Government experience", GOVERNMENT_EXPERIENCE.get(profile.government_experience.value or ""))
    for label, f in (("Active contractor registration", profile.contractor_registration), ("Can provide a bid bond", profile.bonding), ("Has liability insurance", profile.insurance)):
        if f.value in ("yes", "no"):
            add(label, f.value)
    add("Licenses", _join(profile.licenses.value or []))
    add("Certifications", _join(profile.certifications.value or []))
    add("Role", ROLE.get(profile.role_interest.value or ""))
    add("Availability", profile.availability.value)
    add("Mobilization lead time", profile.mobilization_lead_time.value)
    add("Working constraints", _join(profile.working_constraints.value or []))
    add("In their own words", _words(original_description, 150))
    return "\n".join(lines)


def vendor_text(profile: VendorProfileFields, original_description: Optional[str] = None) -> str:
    """What gets embedded for matching: the info text without the exclusions line."""
    return profile_info(profile, original_description, include_exclusions=False)


def bid_text(bid: Bid) -> str:
    parts = [bid.title.strip()]
    if bid.summary:
        parts.append(_words(bid.summary, 60))
    if bid.description:
        parts.append(_words(bid.description, 150))
    cats = [category_label(c) for c in specific_categories(bid.categories)]
    if cats:
        parts.append(f"Work type: {_join(cats)}.")
    titles = [t for t in (title_for(c) for c in bid.naics_codes) if t]
    if titles:
        parts.append(f"Industry: {_join(titles)}.")
    return " ".join(parts)
