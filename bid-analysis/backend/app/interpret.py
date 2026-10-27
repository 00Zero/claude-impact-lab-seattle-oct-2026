"""Plain-language description -> draft profile + follow-up questions.

Ported from the frontend's src/lib/sim/interpret.ts (keyword rules), plus an embedding fallback that guesses a
service category when no keyword fires. Only what the vendor actually wrote is extracted; licenses, bonding,
insurance, certifications, experience and equipment are never inferred from a trade or business name (ONB-07).
Pricing is never asked (ONB-06). Everything inferred is marked "inferred" until the vendor confirms it."""

import re
from typing import Optional, TypeVar

from .embeddings import AiUnavailable, embed
from .models import (
    CountiesArea, FollowUpOption, FollowUpQuestion, InterpretResponse, ProfileField, StatewideArea,
    VendorProfileFields,
)
from .taxonomy import WA_COUNTIES, WA_PLACES, WORK_CATEGORIES

T = TypeVar("T")

SERVICE_PATTERNS = [
    ("pothole_repair", r"pot ?holes?|patch(ing|es)?\b"),
    ("paving", r"\b(pav(e|ing|ers?)|asphalt|overlay|blacktop|crack ?seal|chip ?seal|seal ?coat)"),
    ("excavation", r"excavat|trench|dig(ging)?\b|hauling|earthwork|dirt work"),
    ("grading", r"\bgrad(e|ing)\b|leveling|shoulder work|gravel road"),
    ("drainage", r"drain|culvert|storm ?water|ditch|swale|catch basin"),
    ("landscaping", r"landscap|\bplant(ing|s)?\b|irrigation|\blawns?\b|\bturf\b|restoration planting|\btrees?\b"),
    ("site_prep", r"site ?prep|clearing|land clearing|erosion control|demo(lition)?\b"),
    ("concrete", r"concrete|sidewalk|curbs?\b|flatwork|gutter|curb ramp"),
    ("utilities", r"water ?main|sewer|utility (work|lines?)"),
    ("janitorial", r"janitor|custodial|cleaning services"),
    ("it_services", r"software|\bIT\b|network|cyber"),
]
SERVICE_RE = [(cid, re.compile(p, re.I)) for cid, p in SERVICE_PATTERNS]
NEGATION = re.compile(r"\b(no|not|don'?t|do not|never|won'?t|without|except|avoid|exclud)", re.I)
EQUIPMENT = ["excavator", "mini excavator", "backhoe", "skid steer", "dump truck", "paver", "roller", "grader",
             "loader", "crack sealer", "hydroseeder", "concrete saw", "water truck"]

EMBED_FALLBACK_MIN = 0.40   # best-matching category must reach this to be suggested without a keyword hit


def _field(value: Optional[T], provenance: Optional[str] = None) -> ProfileField:
    return ProfileField(value=value, provenance=provenance or ("unknown" if value is None else "inferred"))


def _clauses(text: str) -> list[str]:
    return [c.strip() for c in re.split(r"[.;\n]|,\s*(?:but|and)\s+|\bbut\b", text, flags=re.I) if c.strip()]


def find_counties(text: str) -> list[str]:
    found = []
    for c in WA_COUNTIES:
        if re.search(rf"\b{c}\s+(county|counties|co\.?)\b", text, re.I) or re.search(rf"\b{c}\b(?=[^.]*\bcounties\b)", text, re.I):
            found.append(c)
    return found


def find_place(text: str) -> Optional[tuple[str, str]]:
    return next(((n, c) for n, c in WA_PLACES if re.search(rf"\b{n}\b", text, re.I)), None)


def _guess_category_by_embedding(text: str) -> Optional[str]:
    ids = [i for i in WORK_CATEGORIES if i != "other"]
    try:
        vecs = embed([text, *[WORK_CATEGORIES[i][1] for i in ids]])
    except AiUnavailable:
        return None
    sims = vecs[1:] @ vecs[0]
    best = int(sims.argmax())
    return ids[best] if float(sims[best]) >= EMBED_FALLBACK_MIN else None


def interpret_description(description: str, base_location: Optional[str] = None, service_area_text: Optional[str] = None) -> InterpretResponse:
    d = VendorProfileFields()
    text = description.strip()

    services: list[str] = []
    exclusions: list[str] = []
    for clause in _clauses(text):
        negative = bool(NEGATION.search(clause))
        for cid, rx in SERVICE_RE:
            if rx.search(clause):
                bucket = exclusions if negative else services
                if cid not in bucket:
                    bucket.append(cid)
    services = [s for s in services if s not in exclusions]
    if not services and not exclusions and text:
        guess = _guess_category_by_embedding(text)
        if guess:
            services = [guess]
    if services:
        d.core_services = _field(services)
    if exclusions:
        d.exclusions = _field(exclusions)

    name = re.search(r"\b(?i:we are|we're|i run|i own|called|named)\s+([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*){0,4})", text)
    if name:
        d.business_name = _field(re.sub(r"[.,]$", "", name.group(1)))

    base_text = (base_location or "").strip() or text
    place = find_place(base_text)
    if (base_location or "").strip():
        d.base_location = _field(base_location.strip(), "user")
    elif place:
        d.base_location = _field(f"{place[0]}, WA")

    area_text = f"{service_area_text or ''} {text}"
    prov = "user" if service_area_text else "inferred"
    if re.search(r"\bstatewide\b|anywhere in (the state|washington)|all of washington", area_text, re.I):
        d.service_area = ProfileField(value=StatewideArea(), provenance=prov)
    else:
        counties = find_counties(area_text)
        if counties:
            d.service_area = ProfileField(value=CountiesArea(counties=counties), provenance=prov)

    crew = re.search(r"\b(\d{1,3})\s*(?:-|to)?\s*(\d{1,3})?\s*(?:person|people|employees|guys|workers|crew members|man)\b", text, re.I)
    if crew:
        d.crew_size = _field(f"{crew.group(1)} to {crew.group(2)} people" if crew.group(2) else f"{crew.group(1)} people")

    equip = [e for e in EQUIPMENT if re.search(rf"\b{e}s?\b", text, re.I)]
    equip = [e for e in equip if not any(o != e and e in o for o in equip)]   # drop "excavator" when "mini excavator" is present
    if equip:
        d.equipment = _field(equip)

    # Only explicit statements count. Silence stays unknown.
    if re.search(r"\b(registered|licensed and bonded|contractor registration|L&I registered)\b", text, re.I) and not re.search(r"not (yet )?registered", text, re.I):
        d.contractor_registration = _field("yes")
    if re.search(r"not (yet )?registered|no contractor registration", text, re.I):
        d.contractor_registration = _field("no")
    if re.search(r"\bbonded\b", text, re.I) and not re.search(r"not bonded", text, re.I):
        d.bonding = _field("yes")
    if re.search(r"\binsured\b", text, re.I) and not re.search(r"not insured|uninsured", text, re.I):
        d.insurance = _field("yes")
    if re.search(r"subcontract|\bsub\b|as a sub", text, re.I):
        d.role_interest = _field("both" if re.search(r"prime", text, re.I) else "subcontract")
    elif re.search(r"\bprime\b", text, re.I):
        d.role_interest = _field("prime")
    if re.search(r"never (done|bid|worked).*(government|public|city|county)|first (government|public)", text, re.I):
        d.government_experience = _field("first_time")
    elif re.search(r"(city|county|state|government|public)\s+(contracts?|jobs|work)", text, re.I):
        d.government_experience = _field("subcontractor" if re.search(r"\bsub", text, re.I) else "prime")
    if re.search(r"night|weekend|emergency|24/7|on.call", text, re.I):
        wanted = [w for w in ("nights", "weekends", "emergency call-outs") if re.search(w.split(" ")[0].rstrip("s"), text, re.I)]
        if wanted:
            d.working_constraints = _field([f"Available for {w}" for w in wanted])

    return InterpretResponse(draft=d, follow_ups=follow_ups_for(d), mode="live")


def follow_ups_for(d: VendorProfileFields) -> list[FollowUpQuestion]:
    """At most three questions, only where the answer changes matching (ONB-05)."""
    yes_no = [FollowUpOption(label="Yes", value="yes"), FollowUpOption(label="No", value="no"), FollowUpOption(label="Not sure", value="unknown")]
    qs: list[FollowUpQuestion] = []
    if d.service_area.value is None:
        qs.append(FollowUpQuestion(id="q-area", field="serviceArea", prompt="Which counties can your crews work in?",
                                   why="Location is one of the biggest factors in whether a job fits.", allows_multiple=True))
    if not d.core_services.value:
        qs.append(FollowUpQuestion(id="q-services", field="coreServices", prompt="Which kinds of work do you do?",
                                   why="We couldn't tell your main services from the description.", allows_multiple=True))
    if d.contractor_registration.value is None:
        qs.append(FollowUpQuestion(id="q-reg", field="contractorRegistration", prompt="Do you have an active Washington contractor registration?",
                                   why="Most public works bids require one. If you're not sure, we'll flag it rather than rule anything out.", options=yes_no))
    if d.bonding.value is None and d.core_services.value:
        qs.append(FollowUpQuestion(id="q-bond", field="bonding", prompt="Can you provide a bid bond when a job asks for one?",
                                   why="Many public works bids require a bid guarantee. We won't rule anything out if you're not sure.", options=yes_no))
    if len(qs) < 3 and d.role_interest.value is None:
        qs.append(FollowUpQuestion(id="q-role", field="roleInterest", prompt="Do you want to bid as the prime contractor, or work as a subcontractor?",
                                   why="Some jobs suit a prime contractor, others a sub.",
                                   options=[FollowUpOption(label="Prime", value="prime"), FollowUpOption(label="Subcontractor", value="subcontract"),
                                            FollowUpOption(label="Either", value="both"), FollowUpOption(label="Not sure", value="unsure")]))
    return qs[:3]
