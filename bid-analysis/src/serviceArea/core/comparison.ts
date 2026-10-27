import { dateSortKey } from "@/lib/dates";
import { WASHINGTON_COUNTY_NAMES } from "./counties";
import { isIncluded, resolveScope } from "./geography";
import type { InclusionPolicy, OpportunityScope, UnknownLocationReason } from "./geography";
import { isEmptySelection, isSelection, selectedCounties, selectionFromProfile } from "./serviceArea";
import type { ProfileServiceArea, ServiceAreaSelection } from "./serviceArea";
import type { ExplorerOpportunity } from "./types";

/**
 * How one service area partitions the catalog. included + outside +
 * statewideNotIncluded + remote + unconfirmed + unknown = catalogSize.
 */
export interface AreaTally {
  included: number;
  includedByCounty: number;
  includedStatewide: number;
  outside: number;
  /** Outside on every confirmed site, but other sites have no confirmed county. */
  outsideWithUnresolvedSites: number;
  statewideNotIncluded: number;
  remote: number;
  unconfirmed: number;
  unknown: number;
}

export interface OpportunityChange<O extends ExplorerOpportunity> {
  opportunity: O;
  scope: OpportunityScope;
  /** Counties whose addition or removal causes the change; empty for statewide work. */
  viaCounties: readonly string[];
}

export interface CountyStat {
  /** Unique opportunities with a confirmed site in this county. */
  total: number;
  /** What adding this county would bring in (0 if already selected). */
  gainIfAdded: number;
  /** What removing it would drop (0 if not selected). */
  lossIfRemoved: number;
}

export interface ServiceAreaComparison<O extends ExplorerOpportunity> {
  /** Unique opportunities considered, after removing repeated IDs. */
  catalogSize: number;
  duplicateIdsIgnored: number;
  /** False when the confirmed area can't be read as counties; `before` then counts as empty. */
  baselineComparable: boolean;
  before: AreaTally;
  after: AreaTally;
  added: readonly OpportunityChange<O>[];
  removed: readonly OpportunityChange<O>[];
  /** Not tied to a county, so county changes never move them. */
  remote: readonly O[];
  unconfirmed: ReadonlyArray<{ opportunity: O; agencyCounties: readonly string[] }>;
  unknown: ReadonlyArray<{ opportunity: O; reason: UnknownLocationReason }>;
  addedCounties: readonly string[];
  removedCounties: readonly string[];
  countyStats: Readonly<Record<string, CountyStat>>;
}

export interface CompareInput<O extends ExplorerOpportunity> {
  /** The catalog under the user's other filters, with no county, service-area or viewport filter. */
  opportunities: readonly O[];
  baseline: ProfileServiceArea;
  draft: ServiceAreaSelection;
  policy?: Partial<InclusionPolicy>;
}

interface Entry<O> {
  opportunity: O;
  scope: OpportunityScope;
}

export function compareServiceAreas<O extends ExplorerOpportunity>({ opportunities, baseline, draft, policy }: CompareInput<O>): ServiceAreaComparison<O> {
  const inclusion: InclusionPolicy = { includeStatewide: policy?.includeStatewide ?? true };
  const { entries, duplicates } = uniqueEntries(opportunities);
  const before = selectionFromProfile(baseline);

  const beforeCounties = new Set(selectedCounties(before));
  const afterCounties = new Set(selectedCounties(draft));
  const addedCounties = WASHINGTON_COUNTY_NAMES.filter((c) => afterCounties.has(c) && !beforeCounties.has(c));
  const removedCounties = WASHINGTON_COUNTY_NAMES.filter((c) => beforeCounties.has(c) && !afterCounties.has(c));

  const added: OpportunityChange<O>[] = [];
  const removed: OpportunityChange<O>[] = [];
  const remote: O[] = [];
  const unconfirmed: Array<{ opportunity: O; agencyCounties: readonly string[] }> = [];
  const unknown: Array<{ opportunity: O; reason: UnknownLocationReason }> = [];

  for (const { scope, opportunity } of entries) {
    if (scope.kind === "remote") remote.push(opportunity);
    if (scope.kind === "unconfirmed") unconfirmed.push({ opportunity, agencyCounties: scope.agencyCounties });
    if (scope.kind === "unknown") unknown.push({ opportunity, reason: scope.reason });

    const wasIn = isIncluded(scope, before, inclusion);
    const isIn = isIncluded(scope, draft, inclusion);
    if (wasIn === isIn) continue;
    const changed = isIn ? addedCounties : removedCounties;
    const viaCounties = scope.kind === "counties" ? scope.counties.filter((c) => changed.includes(c)) : [];
    (isIn ? added : removed).push({ opportunity, scope, viaCounties });
  }

  added.sort(byDeadlineThenTitle);
  removed.sort(byDeadlineThenTitle);

  return {
    catalogSize: entries.length,
    duplicateIdsIgnored: duplicates,
    baselineComparable: isSelection(baseline) || baseline.kind === "unset",
    before: tally(entries, before, inclusion),
    after: tally(entries, draft, inclusion),
    added,
    removed,
    remote,
    unconfirmed,
    unknown,
    addedCounties,
    removedCounties,
    countyStats: countyStats(entries, draft, inclusion),
  };
}

function uniqueEntries<O extends ExplorerOpportunity>(opportunities: readonly O[]) {
  const seen = new Set<string>();
  const entries: Entry<O>[] = [];
  let duplicates = 0;
  for (const opportunity of opportunities) {
    if (seen.has(opportunity.id)) {
      duplicates += 1;
      continue;
    }
    seen.add(opportunity.id);
    entries.push({ opportunity, scope: resolveScope(opportunity) });
  }
  return { entries, duplicates };
}

function tally(entries: readonly Entry<unknown>[], selection: ServiceAreaSelection, policy: InclusionPolicy): AreaTally {
  const t: AreaTally = {
    included: 0,
    includedByCounty: 0,
    includedStatewide: 0,
    outside: 0,
    outsideWithUnresolvedSites: 0,
    statewideNotIncluded: 0,
    remote: 0,
    unconfirmed: 0,
    unknown: 0,
  };
  for (const { scope } of entries) {
    if (scope.kind === "remote" || scope.kind === "unconfirmed" || scope.kind === "unknown") {
      t[scope.kind] += 1;
    } else if (isIncluded(scope, selection, policy)) {
      t.included += 1;
      if (scope.kind === "statewide") t.includedStatewide += 1;
      else t.includedByCounty += 1;
    } else if (scope.kind === "statewide") {
      t.statewideNotIncluded += 1;
    } else {
      t.outside += 1;
      if (scope.hasUnresolvedSites) t.outsideWithUnresolvedSites += 1;
    }
  }
  return t;
}

function countyStats(entries: readonly Entry<unknown>[], draft: ServiceAreaSelection, policy: InclusionPolicy) {
  const stats: Record<string, CountyStat> = Object.fromEntries(WASHINGTON_COUNTY_NAMES.map((n) => [n, { total: 0, gainIfAdded: 0, lossIfRemoved: 0 }]));
  const selected = new Set(selectedCounties(draft));
  const statewideWork = entries.filter((e) => e.scope.kind === "statewide").length;

  for (const { scope } of entries) {
    if (scope.kind !== "counties") continue;
    const inside = scope.counties.filter((c) => selected.has(c));
    for (const county of scope.counties) {
      stats[county].total += 1;
      if (inside.length === 0) stats[county].gainIfAdded += 1;
    }
    // Work reachable through exactly one selected county leaves with that county.
    if (inside.length === 1) stats[inside[0]].lossIfRemoved += 1;
  }

  // Statewide work joins with the first county and leaves with the last one.
  if (policy.includeStatewide && statewideWork > 0) {
    if (isEmptySelection(draft)) for (const name of WASHINGTON_COUNTY_NAMES) stats[name].gainIfAdded += statewideWork;
    else if (selected.size === 1) stats[[...selected][0]].lossIfRemoved += statewideWork;
  }
  return stats;
}

/** Closing soonest first, unknown deadlines last (SRS 8.2), using the app's date rules. */
function byDeadlineThenTitle<O extends ExplorerOpportunity>(a: OpportunityChange<O>, b: OpportunityChange<O>): number {
  const ka = dateSortKey(a.opportunity.deadline);
  const kb = dateSortKey(b.opportunity.deadline);
  if (ka !== kb) {
    if (ka == null) return 1;
    if (kb == null) return -1;
    return ka - kb;
  }
  return a.opportunity.title.localeCompare(b.opportunity.title) || a.opportunity.id.localeCompare(b.opportunity.id);
}
