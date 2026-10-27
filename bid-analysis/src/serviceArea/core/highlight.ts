import type { ServiceAreaComparison } from "./comparison";
import { WASHINGTON_COUNTIES } from "./counties";
import { selectedCounties, selectionFromProfile } from "./serviceArea";
import type { ProfileServiceArea, ServiceAreaSelection } from "./serviceArea";
import type { ExplorerOpportunity } from "./types";

/**
 * - current: in the confirmed area, nothing being previewed
 * - kept: in both the confirmed area and the preview
 * - added / removed: only in the preview / only in the confirmed area
 */
export type CountyHighlightState = "current" | "kept" | "added" | "removed";

/**
 * What the map draws for the explorer. Keyed by county name, which is what
 * MapView uses, with the FIPS code of the same shape for any future renderer
 * that keys features on it.
 */
export interface ServiceAreaMapHighlight {
  mode: "confirmed" | "exploring";
  counties: ReadonlyArray<{ name: string; fips: string; state: CountyHighlightState }>;
  /** Same states by name, for MapView's county layer. */
  byName: Readonly<Record<string, CountyHighlightState>>;
  addedOpportunityIds: readonly string[];
  removedOpportunityIds: readonly string[];
}

export function buildMapHighlight<O extends ExplorerOpportunity>(input: {
  baseline: ProfileServiceArea;
  draft: ServiceAreaSelection;
  exploring: boolean;
  comparison: ServiceAreaComparison<O> | null;
}): ServiceAreaMapHighlight {
  const before = new Set(selectedCounties(selectionFromProfile(input.baseline)));
  const after = new Set(selectedCounties(input.draft));
  const counties: Array<ServiceAreaMapHighlight["counties"][number]> = [];
  for (const { name, fips } of WASHINGTON_COUNTIES) {
    const state = countyState(before.has(name), after.has(name), input.exploring);
    if (state) counties.push({ name, fips, state });
  }
  return {
    mode: input.exploring ? "exploring" : "confirmed",
    counties,
    byName: Object.fromEntries(counties.map((c) => [c.name, c.state])),
    addedOpportunityIds: input.exploring ? (input.comparison?.added.map((c) => c.opportunity.id) ?? []) : [],
    removedOpportunityIds: input.exploring ? (input.comparison?.removed.map((c) => c.opportunity.id) ?? []) : [],
  };
}

function countyState(inBefore: boolean, inAfter: boolean, exploring: boolean): CountyHighlightState | null {
  if (!exploring) return inBefore ? "current" : null;
  if (inBefore && inAfter) return "kept";
  if (inAfter) return "added";
  if (inBefore) return "removed";
  return null;
}
