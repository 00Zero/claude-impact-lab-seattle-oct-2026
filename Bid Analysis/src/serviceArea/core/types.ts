import type { FitAssessment, Opportunity, PerformanceLocation } from "@/lib/contracts";

// The slices of the shared contract (src/lib/contracts.ts) the explorer reads.
// Canonical records satisfy these as-is; tests can build them without every field.

/**
 * Proposed `PerformanceLocation.resolutionMethod` for county, city or point
 * values copied from the issuing agency's own record, which is what
 * scripts/pull_bids.py does today. Such values are not evidence of where the
 * work happens. Not yet in contracts.ts; pending agreement with workstream C.
 */
export const AGENCY_RECORD_METHOD = "agency_record";

export type ExplorerLocation = Pick<PerformanceLocation, "id" | "label" | "precision" | "countyNames" | "cityName"> & {
  /** Widened from the contract union so AGENCY_RECORD_METHOD is recognized at runtime. */
  resolutionMethod: string | null;
};

export interface ExplorerOpportunity extends Pick<Opportunity, "id" | "version" | "title" | "agencyId" | "deadline" | "locationStatus"> {
  locations: readonly ExplorerLocation[];
}

export type ExplorerAssessment = Pick<FitAssessment, "opportunityId" | "opportunityVersion" | "profileRevision" | "state" | "tier">;
