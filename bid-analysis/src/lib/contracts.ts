// Frontend view of the shared data contract (SRS v1.1, sections 12 and 13).
// Workstream C owns opportunity/agency transport and workstream B owns the
// profile and fit schemas. Changes here must be coordinated with them.

export type ISODate = string;

/* ---------- Evidence, dates, locations ---------- */

export interface EvidenceRef {
  sourceUrl: string | null;
  documentUrl?: string | null;
  collectedAt?: ISODate | null;
  excerpt?: string | null;
  section?: string | null;
}

export interface DateValue {
  rawText: string | null;
  /** ISO date (YYYY-MM-DD) or ISO timestamp. */
  value: string;
  precision: "date" | "datetime";
  timeZone: string | null;
  evidenceRef?: EvidenceRef | null;
}

export type LocationPrecision =
  | "exact_site"
  | "address"
  | "road_segment"
  | "city"
  | "county"
  | "region"
  | "statewide"
  | "remote"
  | "unknown";

export type LocationStatus = "located" | "approximate" | "multiple" | "statewide" | "remote" | "unknown";

/** GeoJSON order: [longitude, latitude]. */
export type LngLat = [number, number];

export interface PerformanceLocation {
  id: string;
  label: string;
  precision: LocationPrecision;
  geometry: GeoJSON.Geometry | null;
  displayPoint: LngLat | null;
  displayPointBasis: "exact_location" | "geocoded_address" | "city_centroid" | "county_centroid" | "other" | null;
  countyNames: string[];
  cityName: string | null;
  rawLocationText: string | null;
  evidenceRef: EvidenceRef | null;
  resolutionMethod: "source_geometry" | "deterministic_parsing" | "geocoder" | "model_assisted" | "manual_review" | null;
  resolutionConfidence: "high" | "medium" | "low" | null;
}

/* ---------- Agency ---------- */

export type AgencyType =
  | "state"
  | "county"
  | "city"
  | "port"
  | "school"
  | "university"
  | "utility"
  | "transit"
  | "tribal"
  | "federal"
  | "other"
  | "unknown";

export interface Agency {
  id: string;
  name: string;
  sourceNames: string[];
  agencyType: AgencyType;
  jurisdiction: string | null;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  contactSource: string | null;
  sourceIds: string[];
  inventoryOrigin: string | null;
  procurementCoverage: "checked" | "partial" | "inaccessible" | "not_checked" | "no_public_listing_found";
}

/* ---------- Opportunity ---------- */

export type OpportunityStatus = "open" | "closed" | "awarded" | "canceled" | "forecast" | "unknown";

export interface Requirement {
  id: string;
  category: "license" | "experience" | "equipment" | "insurance" | "bonding" | "site_visit" | "schedule" | "compliance" | "other";
  text: string;
  mandatory: boolean | null;
  evidenceRef: EvidenceRef | null;
  extractionStatus: "verified_excerpt" | "extracted" | "needs_review";
}

export interface SourceReference {
  sourceId: string;
  sourceNativeId: string | null;
  url: string | null;
  evidenceRef: EvidenceRef | null;
}

export interface DocumentLink {
  label: string;
  url: string | null;
  access: "public" | "login_required" | "unavailable";
}

export interface PublicContact {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  evidenceRef: EvidenceRef | null;
}

export interface WorkCategoryTag {
  id: WorkCategoryId;
  provenance: "source" | "inferred";
}

export interface Opportunity {
  id: string;
  version: string;
  sourceReferences: SourceReference[];
  agencyId: string;
  title: string;
  solicitationType: { sourceLabel: string | null; normalized: "itb" | "rfp" | "rfq" | "small_works" | "other" | null };
  status: OpportunityStatus;
  statusBasis: string | null;
  description: string | null;
  /** Grounded summary; summaryIsGenerated marks model-written text. */
  summary: string | null;
  summaryIsGenerated: boolean;
  workCategories: WorkCategoryTag[];
  classificationCodes: { scheme: string; code: string; label: string | null; provenance: "source" | "inferred" }[];
  publication: DateValue | null;
  amendment: DateValue | null;
  deadline: DateValue | null;
  performanceStart: DateValue | null;
  performanceEnd: DateValue | null;
  locations: PerformanceLocation[];
  locationStatus: LocationStatus;
  requirements: Requirement[];
  requirementsCompleteness: "complete" | "partial" | "not_extracted";
  documentLinks: DocumentLink[];
  publicContact: PublicContact | null;
  publishedValue: { amount: number | null; min: number | null; max: number | null; currency: string; rawText: string; evidenceRef: EvidenceRef | null } | null;
  firstSeenAt: ISODate | null;
  lastVerifiedAt: ISODate | null;
  extractedAt: ISODate | null;
  sourceSnapshotAt: ISODate | null;
  completeness: string[];
  /** Development-only marker. Fixture records are never real open work. */
  isDevelopmentFixture?: boolean;
}

/* ---------- Work categories (display taxonomy) ---------- */

export type WorkCategoryId =
  | "paving"
  | "pothole_repair"
  | "excavation"
  | "grading"
  | "drainage"
  | "landscaping"
  | "site_prep"
  | "concrete"
  | "utilities"
  | "janitorial"
  | "it_services"
  | "supplies"
  | "other";

/* ---------- Filters (SRS 13.2) ---------- */

export type SortKey = "recommended" | "closing_soonest" | "newly_posted";

export interface ViewportBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface CatalogFilter {
  query: string;
  workCategories: WorkCategoryId[];
  agencyIds: string[];
  agencyTypes: AgencyType[];
  countyNames: string[];
  /** Days back from now; null means any time. */
  publishedWithinDays: number | null;
  /** Days ahead from now; "unknown" keeps only records without a published deadline; null means any open deadline. */
  deadlineWithinDays: number | "unknown" | null;
  includeUnknownDates: boolean;
  includeStatewide: boolean;
  includeUnknownLocations: boolean;
  viewportBounds: ViewportBounds | null;
  /** Applied after matching, because tiers depend on the active profile revision. */
  fitTiers: FitTier[];
  sort: SortKey;
}

/* ---------- Envelopes (SRS 13.3 to 13.5) ---------- */

export type ApiErrorCode =
  | "invalid_input"
  | "source_unavailable"
  | "ai_unavailable"
  | "rate_limited"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "revision_conflict"
  | "internal_error";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
}

export interface CatalogMeta {
  schemaVersion: string;
  catalogVersion: string;
  generatedAt: ISODate;
  sourceSnapshotAt: ISODate | null;
  isStale: boolean;
  totalFiltered: number;
  mappedCount: number;
  unmappedCount: number;
  limitations: string[];
}

export interface Facets {
  workCategories: Partial<Record<WorkCategoryId, number>>;
  counties: Record<string, number>;
  agencies: Record<string, number>;
}

export interface CatalogResponse {
  data: Opportunity[];
  agencies: Agency[];
  facets: Facets;
  meta: CatalogMeta;
}

export interface CoverageSummary {
  agenciesInInventory: number | null;
  agenciesChecked: number | null;
  agenciesWithOpenWork: number | null;
  uniqueOpenOpportunities: number | null;
  locationBreakdown: { located: number; approximate: number; statewide: number; unknown: number };
  lastSuccessfulCheckAt: ISODate | null;
  catalogVersion: string;
  isStale: boolean;
  limitations: string[];
}

/* ---------- Vendor profile (SRS 10.2, 12.8) ---------- */

/** user: typed by the vendor; inferred: proposed from their description and not yet confirmed; confirmed: reviewed; unknown: not provided. */
export type FieldProvenance = "user" | "inferred" | "confirmed" | "unknown";

export interface ProfileField<T> {
  value: T | null;
  provenance: FieldProvenance;
}

export type ServiceArea = { kind: "counties"; counties: string[] } | { kind: "statewide" };
export type TriState = "yes" | "no" | "unknown";

export interface VendorProfileFields {
  businessName: ProfileField<string>;
  baseLocation: ProfileField<string>;
  serviceArea: ProfileField<ServiceArea>;
  coreServices: ProfileField<WorkCategoryId[]>;
  specialties: ProfileField<string[]>;
  exclusions: ProfileField<WorkCategoryId[]>;
  crewSize: ProfileField<string>;
  equipment: ProfileField<string[]>;
  relevantExperience: ProfileField<string>;
  governmentExperience: ProfileField<"first_time" | "subcontractor" | "prime">;
  projectScale: ProfileField<"small_repairs" | "maintenance" | "multi_crew" | "larger_projects">;
  contractorRegistration: ProfileField<TriState>;
  licenses: ProfileField<string[]>;
  bonding: ProfileField<TriState>;
  insurance: ProfileField<TriState>;
  certifications: ProfileField<string[]>;
  roleInterest: ProfileField<"prime" | "subcontract" | "both" | "unsure">;
  availability: ProfileField<string>;
  mobilizationLeadTime: ProfileField<string>;
  workingConstraints: ProfileField<string[]>;
}

export interface VendorProfile extends VendorProfileFields {
  id: string;
  revision: number;
  ownerUserId: string;
  originalDescription: string;
  confirmedAt: ISODate | null;
}

export interface FollowUpQuestion {
  id: string;
  /** Profile field the answer fills. */
  field: keyof VendorProfileFields;
  prompt: string;
  why: string;
  options: { label: string; value: unknown }[];
  allowsMultiple?: boolean;
}

export interface InterpretResponse {
  draft: VendorProfileFields;
  followUps: FollowUpQuestion[];
  mode: "live" | "simulated";
}

/* ---------- Fit assessment (SRS 11.3, 11.5, 12.9) ---------- */

export type FitTier = "good_fit" | "possible_fit" | "not_a_fit" | "needs_review";

export interface FitStatement {
  text: string;
  profileFields: (keyof VendorProfileFields)[];
  evidence: EvidenceRef | null;
}

export interface FitAssessment {
  opportunityId: string;
  opportunityVersion: string;
  profileId: string;
  profileRevision: number;
  state: "assessed" | "pending" | "unavailable";
  tier: FitTier | null;
  /** Internal ordering score. Never a win probability. */
  rankingScore: number | null;
  reasons: FitStatement[];
  mismatches: FitStatement[];
  unknowns: FitStatement[];
  suggestedClarifications: string[];
  assessedAt: ISODate | null;
  rankingVersion: string;
}

export interface MatchResponse {
  data: FitAssessment[];
  meta: {
    profileRevision: number;
    rankingVersion: string;
    assessedCount: number;
    unassessedCount: number;
    assessmentState: "complete" | "partial" | "unavailable";
    mode: "live" | "simulated";
  };
}

/* ---------- Accounts (SRS 12.11, 14) ---------- */

export interface SessionUser {
  id: string;
  username: string;
}

export interface Session {
  user: SessionUser;
  /** "account" when stored server-side; "session_only" for the development stand-in. */
  persistence: "account" | "session_only";
}
