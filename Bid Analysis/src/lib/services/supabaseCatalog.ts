import type { Agency, AgencyType, DateValue, Opportunity, PerformanceLocation, Requirement, WorkCategoryId } from "../contracts";
import { WORK_CATEGORIES } from "../taxonomy";
import { AGENCY_RECORD_METHOD } from "@/serviceArea/core/types";
import type { CatalogSnapshot } from "./fixtureServices";
import { ServiceError } from "./types";

// Reads the real open listings straight from Supabase with the publishable
// (anon) key, as described in docs/supabase-frontend-integration.md. Only the
// catalog is real; accounts, profile reading and matching stay simulated.

const TZ = "America/Los_Angeles";

export interface BidRow {
  id: string;
  source_id: string | null;
  agency: string;
  title: string;
  description: string | null;
  summary: string | null;
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  state: string | null;
  county: string | null;
  city: string | null;
  posted_date: string | null;
  deadline: string | null;
  solicitation_number: string | null;
  bid_type: string | null;
  status: string | null;
  categories: string[] | null;
  naics_codes: string[] | null;
  requirements: string[] | null;
  contact_name: string | null;
  contact_title?: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  estimated_value_text: string | null;
  source_url: string;
  documents: { name?: string; url?: string }[] | null;
  extraction_method: string | null;
  last_checked: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SourceRow {
  id: string;
  name: string;
  agency_type: string;
  county: string | null;
  city: string | null;
  state: string | null;
  homepage_url: string | null;
  procurement_url: string | null;
  status: string | null;
}

const KEPT_TYPES = new Set<AgencyType>(["state", "county", "city", "port", "school", "utility", "transit"]);
const CATEGORY_IDS = new Set<string>(WORK_CATEGORIES.map((c) => c.id));
const COVERAGE: Record<string, Agency["procurementCoverage"]> = { verified: "checked", candidate: "not_checked", missing: "no_public_listing_found", dead: "inaccessible" };
const BID_TYPES = new Set(["itb", "rfp", "rfq", "small_works"]);
const REQ_CATEGORY: Record<string, Requirement["category"]> = { bonded: "bonding", licensed: "license", insured: "insurance", prevailing_wage: "compliance" };

export function toAgency(s: SourceRow): Agency {
  const t = s.agency_type === "higher_ed" ? "university" : KEPT_TYPES.has(s.agency_type as AgencyType) ? (s.agency_type as AgencyType) : "other";
  return {
    id: s.id,
    name: s.name,
    sourceNames: [s.name],
    agencyType: t,
    jurisdiction: s.city ?? s.county ?? s.state,
    websiteUrl: s.homepage_url ?? s.procurement_url,
    email: null,
    phone: null,
    contactSource: null,
    sourceIds: [s.id],
    inventoryOrigin: "Supabase sources registry",
    procurementCoverage: COVERAGE[s.status ?? ""] ?? "not_checked",
  };
}

/** Agency for a bid whose source_id is missing, built from the bid's own agency text. */
export function syntheticAgency(name: string): Agency {
  return {
    id: `agency-text:${name.toLowerCase()}`,
    name,
    sourceNames: [name],
    agencyType: "unknown",
    jurisdiction: null,
    websiteUrl: null,
    email: null,
    phone: null,
    contactSource: null,
    sourceIds: [],
    inventoryOrigin: null,
    procurementCoverage: "not_checked",
  };
}

const day = (v: string | null): DateValue | null => (v ? { rawText: null, value: v, precision: "date", timeZone: TZ } : null);
const instant = (v: string | null): DateValue | null => (v ? { rawText: null, value: v, precision: "datetime", timeZone: TZ } : null);

/**
 * scripts/pull_bids.py copies county, city and coordinates from the agency's
 * own record, so they say where the agency is, not where the work happens.
 * They are marked agency_record so the Service Area Explorer keeps them out of
 * reachability counts, and the label says so wherever a location is shown.
 */
function agencyLocation(b: BidRow): PerformanceLocation[] {
  const hasPoint = b.lat != null && b.lng != null;
  if (!hasPoint && !b.county && !b.city) return [];
  const place = b.city ?? (b.county ? `${b.county} County` : "Washington");
  return [
    {
      id: `${b.id}-agency`,
      label: `${place} (agency's location; work site not confirmed)`,
      precision: b.city ? "city" : "county",
      geometry: hasPoint ? { type: "Point", coordinates: [b.lng!, b.lat!] } : null,
      displayPoint: hasPoint ? [b.lng!, b.lat!] : null,
      displayPointBasis: hasPoint ? "other" : null,
      countyNames: b.county ? [b.county.replace(/ County$/i, "")] : [],
      cityName: b.city,
      rawLocationText: b.location_text,
      evidenceRef: null,
      // Proposed value, not yet in the contract union (see src/serviceArea/core/types.ts).
      resolutionMethod: AGENCY_RECORD_METHOD as PerformanceLocation["resolutionMethod"],
      resolutionConfidence: "low",
    },
  ];
}

export function toOpportunity(b: BidRow, agencyId: string): Opportunity {
  const categories = [...new Set((b.categories ?? []).map((c) => (CATEGORY_IDS.has(c) ? c : "other")))] as WorkCategoryId[];
  const locations = agencyLocation(b);
  const bidType = (b.bid_type ?? "other").toLowerCase();
  return {
    id: b.id,
    version: b.updated_at ?? b.last_checked ?? b.id,
    sourceReferences: [{ sourceId: b.source_id ?? agencyId, sourceNativeId: b.solicitation_number, url: b.source_url, evidenceRef: null }],
    agencyId,
    title: b.title,
    solicitationType: { sourceLabel: b.solicitation_number, normalized: BID_TYPES.has(bidType) ? (bidType as "itb" | "rfp" | "rfq" | "small_works") : "other" },
    status: b.status === "cancelled" ? "canceled" : b.status === "open" || b.status === "closed" || b.status === "awarded" ? b.status : "unknown",
    statusBasis: null,
    description: b.description,
    summary: b.summary,
    summaryIsGenerated: b.extraction_method === "llm",
    workCategories: categories.map((id) => ({ id, provenance: "source" as const })),
    classificationCodes: (b.naics_codes ?? []).map((code) => ({ scheme: "NAICS", code, label: null, provenance: "source" as const })),
    publication: day(b.posted_date),
    amendment: null,
    deadline: instant(b.deadline),
    performanceStart: null,
    performanceEnd: null,
    locations,
    locationStatus: locations.length ? "approximate" : "unknown",
    requirements: (b.requirements ?? []).map((r) => ({ id: r, category: REQ_CATEGORY[r] ?? "other", text: r.replace(/_/g, " "), mandatory: null, evidenceRef: null, extractionStatus: "extracted" as const })),
    requirementsCompleteness: "partial",
    documentLinks: (b.documents ?? []).filter((d) => d.url).map((d) => ({ label: d.name ?? "Document", url: d.url!, access: "public" as const })),
    publicContact:
      b.contact_name || b.contact_email || b.contact_phone
        ? { name: b.contact_name, role: b.contact_title ?? null, email: b.contact_email, phone: b.contact_phone, evidenceRef: null }
        : null,
    publishedValue: b.estimated_value_text ? { amount: null, min: null, max: null, currency: "USD", rawText: b.estimated_value_text, evidenceRef: null } : null,
    firstSeenAt: b.created_at,
    lastVerifiedAt: b.last_checked,
    extractedAt: b.updated_at,
    sourceSnapshotAt: b.last_checked,
    completeness: locations.length ? ["Location is the issuing agency's, not a confirmed work site."] : [],
  };
}

/** Maps open_bids rows and their sources to the frontend contract. Non-Washington rows are left out (SRS: Washington only). */
export function mapCatalog(bids: BidRow[], sources: SourceRow[]): { opportunities: Opportunity[]; agencies: Agency[]; skippedOutOfState: number } {
  const agencies = new Map(sources.map((s) => [s.id, toAgency(s)]));
  const opportunities: Opportunity[] = [];
  let skippedOutOfState = 0;
  for (const b of bids) {
    if (b.state && b.state !== "WA") {
      skippedOutOfState++;
      continue;
    }
    let agencyId = b.source_id && agencies.has(b.source_id) ? b.source_id : null;
    if (!agencyId) {
      const a = syntheticAgency(b.agency);
      if (!agencies.has(a.id)) agencies.set(a.id, a);
      agencyId = a.id;
    }
    opportunities.push(toOpportunity(b, agencyId));
  }
  const used = new Set(opportunities.map((o) => o.agencyId));
  return { opportunities, agencies: [...agencies.values()].filter((a) => used.has(a.id)), skippedOutOfState };
}

export function createSupabaseCatalogLoader(url: string, key: string): () => Promise<CatalogSnapshot> {
  const base = url.replace(/\/$/, "");
  const get = async <T,>(path: string): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key, Accept: "application/json" } });
    } catch {
      throw new ServiceError({ code: "source_unavailable", message: "The listings database couldn't be reached.", retryable: true });
    }
    if (!res.ok) throw new ServiceError({ code: "source_unavailable", message: `The listings database answered ${res.status}.`, retryable: res.status >= 500 });
    return res.json() as Promise<T>;
  };
  return async () => {
    const bids = await get<BidRow[]>("open_bids?select=*&order=deadline.asc.nullslast&limit=1000");
    const ids = [...new Set(bids.map((b) => b.source_id).filter((x): x is string => !!x))];
    const sources = ids.length ? await get<SourceRow[]>(`sources?select=id,name,agency_type,county,city,state,homepage_url,procurement_url,status&id=in.(${ids.map((i) => `"${i.replace(/"/g, "")}"`).join(",")})`) : [];
    const { opportunities, agencies, skippedOutOfState } = mapCatalog(bids, sources);
    const latest = bids.reduce<string | null>((m, b) => (b.last_checked && (!m || b.last_checked > m) ? b.last_checked : m), null);
    return {
      opportunities,
      agencies,
      snapshotAt: latest ?? new Date().toISOString(),
      catalogVersion: `supabase-${latest ?? "unknown"}`,
      lastSuccessfulCheckAt: latest,
      limitations: [
        `${opportunities.length} real open listings from the data team's Supabase catalog.`,
        "Map pins and counties are each issuing agency's location, not a confirmed work site.",
        ...(skippedOutOfState ? [`${skippedOutOfState} listings outside Washington are not shown.`] : []),
        "Accounts, profile reading and fit labels are still simulated for development.",
      ],
    };
  };
}
