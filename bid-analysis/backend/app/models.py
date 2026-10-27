"""API data contracts. These mirror the frontend's src/lib/contracts.ts (the single source the backend must
match), so JSON is camelCase and enum values are the frontend's ids. `Bid` is the exception: it mirrors a row of
the Supabase `bids` table (snake_case) and is what the matcher reads."""

from datetime import date, datetime
from typing import Annotated, Any, Generic, Literal, Optional, TypeVar, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
    )


# ---------------------------------------------------------------- shared literals

WorkCategoryId = Literal[
    "paving", "pothole_repair", "excavation", "grading", "drainage", "landscaping", "site_prep",
    "concrete", "utilities", "janitorial", "it_services", "supplies", "other",
]
TriState = Literal["yes", "no", "unknown"]          # unknown is not false
FieldProvenance = Literal["user", "inferred", "confirmed", "unknown"]
FitTier = Literal["good_fit", "possible_fit", "not_a_fit", "needs_review"]
AssessmentState = Literal["assessed", "pending", "unavailable"]
AgencyType = Literal[
    "state", "county", "city", "port", "school", "university", "utility", "transit", "tribal", "federal",
    "other", "unknown",
]
SortKey = Literal["recommended", "closing_soonest", "newly_posted"]
ErrorCode = Literal[
    "invalid_input", "source_unavailable", "ai_unavailable", "rate_limited", "unauthenticated",
    "forbidden", "not_found", "revision_conflict", "internal_error",
]

# Keys of VendorProfileFields (camelCase): FollowUpQuestion.field and FitStatement.profileFields refer to these.
ProfileFieldName = Literal[
    "businessName", "baseLocation", "serviceArea", "coreServices", "specialties", "exclusions", "crewSize",
    "equipment", "relevantExperience", "governmentExperience", "projectScale", "contractorRegistration",
    "licenses", "bonding", "insurance", "certifications", "roleInterest", "availability",
    "mobilizationLeadTime", "workingConstraints",
]

T = TypeVar("T")


# ---------------------------------------------------------------- evidence

class EvidenceRef(CamelModel):
    source_url: Optional[str] = None
    document_url: Optional[str] = None
    collected_at: Optional[datetime] = None
    excerpt: Optional[str] = None
    section: Optional[str] = None


# ---------------------------------------------------------------- vendor profile

class ProfileField(CamelModel, Generic[T]):
    """Every profile field says how we know it. Inferred values stay drafts until the vendor confirms."""
    value: Optional[T] = None
    provenance: FieldProvenance = "unknown"


class CountiesArea(CamelModel):
    kind: Literal["counties"] = "counties"
    counties: list[str] = Field(default_factory=list)


class StatewideArea(CamelModel):
    kind: Literal["statewide"] = "statewide"


ServiceArea = Annotated[Union[CountiesArea, StatewideArea], Field(discriminator="kind")]


def _unknown() -> ProfileField:
    return ProfileField()


class VendorProfileFields(CamelModel):
    """No pricing, rates, margins or revenue fields exist by design (SRS ONB-06)."""
    business_name: ProfileField[str] = Field(default_factory=_unknown)
    base_location: ProfileField[str] = Field(default_factory=_unknown)
    service_area: ProfileField[ServiceArea] = Field(default_factory=_unknown)
    core_services: ProfileField[list[WorkCategoryId]] = Field(default_factory=_unknown)
    specialties: ProfileField[list[str]] = Field(default_factory=_unknown)
    exclusions: ProfileField[list[WorkCategoryId]] = Field(default_factory=_unknown)
    crew_size: ProfileField[str] = Field(default_factory=_unknown)
    equipment: ProfileField[list[str]] = Field(default_factory=_unknown)
    relevant_experience: ProfileField[str] = Field(default_factory=_unknown)
    government_experience: ProfileField[Literal["first_time", "subcontractor", "prime"]] = Field(default_factory=_unknown)
    project_scale: ProfileField[Literal["small_repairs", "maintenance", "multi_crew", "larger_projects"]] = Field(default_factory=_unknown)
    contractor_registration: ProfileField[TriState] = Field(default_factory=_unknown)
    licenses: ProfileField[list[str]] = Field(default_factory=_unknown)
    bonding: ProfileField[TriState] = Field(default_factory=_unknown)
    insurance: ProfileField[TriState] = Field(default_factory=_unknown)
    certifications: ProfileField[list[str]] = Field(default_factory=_unknown)
    role_interest: ProfileField[Literal["prime", "subcontract", "both", "unsure"]] = Field(default_factory=_unknown)
    availability: ProfileField[str] = Field(default_factory=_unknown)
    mobilization_lead_time: ProfileField[str] = Field(default_factory=_unknown)
    working_constraints: ProfileField[list[str]] = Field(default_factory=_unknown)


class VendorProfile(VendorProfileFields):
    id: str
    revision: int
    owner_user_id: str
    original_description: str
    confirmed_at: Optional[datetime] = None


# ---------------------------------------------------------------- profile interpretation

class FollowUpOption(CamelModel):
    label: str
    value: Any = None


class FollowUpQuestion(CamelModel):
    id: str
    field: ProfileFieldName                  # profile field the answer fills
    prompt: str
    why: str
    options: list[FollowUpOption] = Field(default_factory=list)
    allows_multiple: Optional[bool] = None


class InterpretRequest(CamelModel):
    description: str = Field(max_length=4000)
    base_location: Optional[str] = None
    service_area_text: Optional[str] = None


class InterpretResponse(CamelModel):
    draft: VendorProfileFields
    follow_ups: list[FollowUpQuestion] = Field(default_factory=list)
    mode: Literal["live", "simulated"] = "live"


# ---------------------------------------------------------------- catalog filter (sent with /matches)

class ViewportBounds(CamelModel):
    west: float
    south: float
    east: float
    north: float


class CatalogFilter(CamelModel):
    query: str = ""
    work_categories: list[WorkCategoryId] = Field(default_factory=list)
    agency_ids: list[str] = Field(default_factory=list)
    agency_types: list[AgencyType] = Field(default_factory=list)
    county_names: list[str] = Field(default_factory=list)
    published_within_days: Optional[int] = None
    deadline_within_days: Optional[Union[int, Literal["unknown"]]] = None
    include_unknown_dates: bool = True
    include_statewide: bool = True
    include_unknown_locations: bool = True
    viewport_bounds: Optional[ViewportBounds] = None
    fit_tiers: list[FitTier] = Field(default_factory=list)
    sort: SortKey = "recommended"


# ---------------------------------------------------------------- fit assessment and matching

class FitStatement(CamelModel):
    text: str
    profile_fields: list[ProfileFieldName] = Field(default_factory=list)
    evidence: Optional[EvidenceRef] = None


class FitAssessment(CamelModel):
    opportunity_id: str
    opportunity_version: str
    profile_id: str
    profile_revision: int
    state: AssessmentState
    tier: Optional[FitTier] = None
    ranking_score: Optional[float] = None    # internal ordering only: never shown, never a win probability
    reasons: list[FitStatement] = Field(default_factory=list)
    mismatches: list[FitStatement] = Field(default_factory=list)
    unknowns: list[FitStatement] = Field(default_factory=list)
    suggested_clarifications: list[str] = Field(default_factory=list)
    assessed_at: Optional[datetime] = None
    ranking_version: str

    @model_validator(mode="after")
    def tier_only_when_assessed(self):
        # A pending or unavailable assessment must never carry an invented tier or score (SRS 12.9).
        if self.state != "assessed" and (self.tier is not None or self.ranking_score is not None):
            raise ValueError("tier and rankingScore are only allowed when state is 'assessed'")
        if self.state == "assessed" and self.tier is None:
            raise ValueError("an assessed result needs a tier")
        return self


class MatchRequest(CamelModel):
    profile_id: str
    profile_revision: int
    filter: CatalogFilter
    # Not in the frontend contract: lets the backend be exercised before profile storage exists.
    profile: Optional["VendorProfile"] = None


class MatchMeta(CamelModel):
    profile_revision: int                    # echoed from the request so stale responses can be dropped
    ranking_version: str
    assessed_count: int
    unassessed_count: int
    assessment_state: Literal["complete", "partial", "unavailable"]
    mode: Literal["live", "simulated"] = "live"


class MatchResponse(CamelModel):
    data: list[FitAssessment]
    meta: MatchMeta


class ProfileEmbedding(CamelModel):
    """What gets stored on the user's row whenever a profile is saved: `info` (text of everything we collect) and
    `embed` (its embedding, built without the exclusions line)."""
    profile_revision: int
    info: str
    embed: list[float]
    embedding_model: str
    embedding_version: str


class SaveProfileRequest(CamelModel):
    """Body of PUT /me/profile, as the frontend adapter sends it."""
    fields: VendorProfileFields
    original_description: str = Field(max_length=4000)
    expected_revision: Optional[int] = None


class SignupRequest(CamelModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=128)


class LoginRequest(CamelModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=128)


class AccountUser(CamelModel):
    id: str
    username: str


class Session(CamelModel):
    user: AccountUser
    persistence: Literal["account", "session_only"] = "account"


# ---------------------------------------------------------------- envelopes and errors

class ApiError(CamelModel):
    code: ErrorCode
    message: str                             # never raw prompts, secrets, stack traces or account IDs
    retryable: bool = False


class ErrorResponse(CamelModel):
    error: ApiError


class DataResponse(CamelModel, Generic[T]):
    data: T


# ---------------------------------------------------------------- a row of the Supabase `bids` table

class Bid(BaseModel):
    """Snake_case on purpose: this is the database row, not an API shape. Unknown columns are ignored."""
    model_config = ConfigDict(extra="ignore")

    id: str
    source_id: Optional[str] = None
    agency: str
    title: str
    solicitation_number: Optional[str] = None
    bid_type: str = "other"
    status: str = "open"
    summary: Optional[str] = None
    description: Optional[str] = None
    categories: list[str] = Field(default_factory=list)       # plain work types (same ids as WorkCategoryId)
    naics_codes: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)     # 'licensed', 'bonded', 'insured', ...
    set_asides: list[str] = Field(default_factory=list)
    state: Optional[str] = None
    county: Optional[str] = None
    city: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    posted_date: Optional[date] = None
    deadline: Optional[datetime] = None
    prebid_at: Optional[datetime] = None
    questions_due_at: Optional[datetime] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    estimated_value_text: Optional[str] = None
    source_url: Optional[str] = None
    documents: list[dict[str, Any]] = Field(default_factory=list)
    extraction_method: Optional[str] = None
    last_checked: Optional[datetime] = None
    updated_at: Optional[datetime] = None
