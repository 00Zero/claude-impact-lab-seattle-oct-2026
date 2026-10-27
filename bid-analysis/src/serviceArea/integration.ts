import type { CatalogFilter, FitAssessment, MatchResponse, VendorProfile, VendorProfileFields } from "@/lib/contracts";
import type { ServiceError } from "@/lib/services/types";
import { fromProfileField, toServiceAreaValue } from "./core/serviceArea";
import type { ExplorerProfile, ServiceAreaSelection } from "./core/serviceArea";

// Translation between the explorer and the app's store and contracts. Pure
// functions only, so the boundary is testable without rendering.

export function explorerProfileOf(profile: VendorProfile | null): ExplorerProfile | null {
  return profile ? { profileId: profile.id, revision: profile.revision, serviceArea: fromProfileField(profile.serviceArea) } : null;
}

/**
 * The confirmed profile's fields with only the service area replaced, in the
 * persisted ProfileField shape. Every other field and its provenance is kept.
 */
export function fieldsWithServiceArea(profile: VendorProfile, selection: ServiceAreaSelection): VendorProfileFields {
  const { id: _id, revision: _revision, ownerUserId: _owner, originalDescription: _description, confirmedAt: _confirmedAt, ...fields } = profile;
  return { ...fields, serviceArea: { value: toServiceAreaValue(selection), provenance: "confirmed" } };
}

/**
 * Confirms a service area through the store's own profile lifecycle
 * (`actions.confirmProfile`, which sends expectedRevision and adopts the
 * returned revision). Deliberately makes no matching request: the store's
 * matching effect runs once for the new revision.
 */
export async function saveServiceAreaSelection(
  confirmProfile: (fields: VendorProfileFields, originalDescription: string) => Promise<VendorProfile>,
  profile: VendorProfile,
  selection: ServiceAreaSelection,
) {
  const saved = await confirmProfile(fieldsWithServiceArea(profile, selection), profile.originalDescription);
  return { revision: saved.revision, serviceArea: fromProfileField(saved.serviceArea) };
}

/**
 * The comparison catalog's filter: the user's keyword, work type, agency and
 * date filters stay; county, map-area and fit-tier constraints go, so work
 * outside the current area (or labeled with an old revision's fit) can show up.
 */
export function geographyFreeFilter(filter: CatalogFilter): CatalogFilter {
  return { ...filter, countyNames: [], viewportBounds: null, includeStatewide: true, includeUnknownLocations: true, fitTiers: [] };
}

/** When the shared filter already has no geographic constraint, the store's catalog can be reused as-is. */
export function isGeographyFree(filter: CatalogFilter): boolean {
  return filter.countyNames.length === 0 && filter.viewportBounds === null && filter.includeStatewide && filter.includeUnknownLocations;
}

/** Non-geographic filters the comparison still honors, for the panel's footnote. */
export function activeNonGeographicFilters(filter: CatalogFilter): string[] {
  const out: string[] = [];
  if (filter.query.trim()) out.push("keyword");
  if (filter.workCategories.length) out.push("work type");
  if (filter.agencyIds.length || filter.agencyTypes.length) out.push("agency");
  if (filter.publishedWithinDays != null || filter.deadlineWithinDays != null) out.push("dates");
  return out;
}

/** Assessments for the active revision only; anything else is stale. */
export function currentAssessments(
  matching: { forRevision: number | null; byId: Record<string, FitAssessment> },
  profile: VendorProfile | null,
): FitAssessment[] {
  return profile && matching.forRevision === profile.revision ? Object.values(matching.byId) : [];
}

export type FitRefresh =
  | { status: "pending" }
  | { status: "ready"; mode: MatchResponse["meta"]["mode"] | null }
  | { status: "error"; message: string };

/**
 * Status of the store's own matching run for a just-saved revision. The store
 * reruns matching once per revision; the explorer only reports it. Returns
 * null once a newer revision has taken over.
 */
export function fitRefreshFor(
  matching: { status: "idle" | "pending" | "ready" | "error"; forRevision: number | null; meta: MatchResponse["meta"] | null; error: ServiceError | null },
  profile: VendorProfile | null,
  revision: number,
): FitRefresh | null {
  if (!profile || profile.revision !== revision) return null;
  if (matching.status === "ready" && matching.forRevision === revision) return { status: "ready", mode: matching.meta?.mode ?? null };
  if (matching.status === "error") return { status: "error", message: matching.error?.message ?? "Matching didn't finish." };
  return { status: "pending" };
}
