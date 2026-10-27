import type { LocationPrecision } from "@/lib/contracts";
import { normalizeCountyName, sortCounties } from "./counties";
import { isEmptySelection } from "./serviceArea";
import type { ServiceAreaSelection } from "./serviceArea";
import { AGENCY_RECORD_METHOD } from "./types";
import type { ExplorerOpportunity } from "./types";

export type UnknownLocationReason = "no_location" | "precision_unknown" | "county_not_resolved" | "not_a_washington_county";

/** Where an opportunity's work happens, independent of any service area. */
export type OpportunityScope =
  | {
      kind: "counties";
      /** Counties with work-location evidence. Never includes agency-record counties. */
      counties: readonly string[];
      /** More than one performance location; still counted once. */
      multiSite: boolean;
      /** Some sites have no confirmed county and may lie anywhere. */
      hasUnresolvedSites: boolean;
      /** Precision of the single confirmed site, or "multiple". */
      precision: LocationPrecision | "multiple";
    }
  | { kind: "statewide" }
  | { kind: "remote" }
  /** Only the issuing agency's own location is known. Kept apart from every count. */
  | { kind: "unconfirmed"; agencyCounties: readonly string[] }
  | { kind: "unknown"; reason: UnknownLocationReason };

/**
 * Resolves work location from county evidence on each performance location.
 * Display points are never used: they can be disclosed approximations or an
 * agency's address (SRS 4.4). Values copied from the agency record are set
 * aside the same way, so an agency's county can't make work look reachable.
 */
export function resolveScope(opportunity: ExplorerOpportunity): OpportunityScope {
  const { locations } = opportunity;
  if (locations.length === 0) {
    if (opportunity.locationStatus === "statewide") return { kind: "statewide" };
    if (opportunity.locationStatus === "remote") return { kind: "remote" };
    return { kind: "unknown", reason: "no_location" };
  }

  const counties: string[] = [];
  const agencyCounties: string[] = [];
  const confirmedPrecisions: LocationPrecision[] = [];
  let unresolvedReason: UnknownLocationReason | null = null;
  let unresolvedSites = 0;
  let agencySites = 0;
  let remoteSites = 0;

  for (const location of locations) {
    if (location.resolutionMethod === AGENCY_RECORD_METHOD) {
      agencySites += 1;
      agencyCounties.push(...location.countyNames.map(normalizeCountyName).filter((c): c is string => c !== null));
      continue;
    }
    if (location.precision === "statewide") return { kind: "statewide" };
    if (location.precision === "remote") {
      remoteSites += 1;
      continue;
    }
    if (location.precision === "unknown") {
      unresolvedSites += 1;
      unresolvedReason ??= "precision_unknown";
      continue;
    }
    const resolved = location.countyNames.map(normalizeCountyName).filter((c): c is string => c !== null);
    if (resolved.length === 0) {
      unresolvedSites += 1;
      unresolvedReason ??= location.countyNames.length > 0 ? "not_a_washington_county" : "county_not_resolved";
      continue;
    }
    counties.push(...resolved);
    confirmedPrecisions.push(location.precision);
  }

  if (counties.length > 0) {
    return {
      kind: "counties",
      counties: sortCounties(counties),
      multiSite: locations.length > 1 || opportunity.locationStatus === "multiple",
      hasUnresolvedSites: unresolvedSites + agencySites > 0,
      precision: confirmedPrecisions.length === 1 ? confirmedPrecisions[0] : "multiple",
    };
  }
  if (agencySites > 0) return { kind: "unconfirmed", agencyCounties: sortCounties(agencyCounties) };
  if (remoteSites === locations.length) return { kind: "remote" };
  return { kind: "unknown", reason: unresolvedReason ?? "county_not_resolved" };
}

export interface InclusionPolicy {
  /** Statewide work counts inside any non-empty Washington area. Mirrors the shared filter's includeStatewide. */
  includeStatewide: boolean;
}

/**
 * Geographic inclusion only, never capability fit. Multi-site work is in when
 * any confirmed county is selected (SRS 8.3). Remote, unconfirmed and unknown
 * locations are neither inside nor outside a county area.
 */
export function isIncluded(scope: OpportunityScope, selection: ServiceAreaSelection, policy: InclusionPolicy): boolean {
  switch (scope.kind) {
    case "counties":
      return selection.kind === "statewide" || scope.counties.some((c) => selection.counties.includes(c));
    case "statewide":
      return policy.includeStatewide && !isEmptySelection(selection);
    default:
      return false;
  }
}
