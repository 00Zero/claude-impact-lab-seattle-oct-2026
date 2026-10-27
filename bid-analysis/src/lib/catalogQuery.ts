import type { Agency, CatalogFilter, Facets, Opportunity, ViewportBounds, WorkCategoryId } from "./contracts";
import { dateSortKey, daysUntil, isDeadlinePassed } from "./dates";

// Reference implementation of the shared filter semantics (SRS 8.2, 8.3, 13.2).
// The fixture service uses it in the browser. Workstream C can mirror it server
// side so list, map, and counts agree in both modes.

export const DEFAULT_FILTER: CatalogFilter = {
  query: "",
  workCategories: [],
  agencyIds: [],
  agencyTypes: [],
  countyNames: [],
  publishedWithinDays: null,
  deadlineWithinDays: null,
  includeUnknownDates: true,
  includeStatewide: true,
  includeUnknownLocations: true,
  viewportBounds: null,
  fitTiers: [],
  sort: "closing_soonest",
};

/** Default discovery shows only open work: no closed/awarded/canceled, no elapsed deadline. */
export function isOpenForDiscovery(o: Opportunity, now = new Date()): boolean {
  return o.status === "open" && !isDeadlinePassed(o.deadline, now);
}

export const hasMapPoint = (o: Opportunity) => o.locations.some((l) => l.displayPoint);
const isUnpinnedStatewide = (o: Opportunity) => !hasMapPoint(o) && (o.locationStatus === "statewide" || o.locationStatus === "remote");
const isUnpinnedUnknown = (o: Opportunity) => !hasMapPoint(o) && o.locationStatus === "unknown";

const inBounds = (b: ViewportBounds, [lng, lat]: [number, number]) => lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;

type Dim = "query" | "categories" | "agencies" | "counties" | "published" | "deadline" | "area";

function passes(o: Opportunity, f: CatalogFilter, agencies: Map<string, Agency>, now: Date, skip?: Dim): boolean {
  if (skip !== "query" && f.query.trim()) {
    const q = f.query.trim().toLowerCase();
    const a = agencies.get(o.agencyId);
    const hay = [o.title, o.summary, o.description, a?.name, o.sourceReferences[0]?.sourceNativeId, ...o.locations.map((l) => l.label)].join(" ").toLowerCase();
    if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
  }
  if (skip !== "categories" && f.workCategories.length && !o.workCategories.some((c) => f.workCategories.includes(c.id))) return false;
  if (skip !== "agencies") {
    if (f.agencyIds.length && !f.agencyIds.includes(o.agencyId)) return false;
    if (f.agencyTypes.length && !f.agencyTypes.includes(agencies.get(o.agencyId)?.agencyType ?? "unknown")) return false;
  }
  if (isUnpinnedStatewide(o) && !f.includeStatewide) return false;
  if (isUnpinnedUnknown(o) && !f.includeUnknownLocations) return false;
  if (skip !== "counties" && f.countyNames.length) {
    // Statewide work covers every county; unknown locations pass only when explicitly included.
    const any = o.locations.some((l) => l.countyNames.some((c) => f.countyNames.includes(c)));
    if (!any && !isUnpinnedStatewide(o) && !isUnpinnedUnknown(o)) return false;
  }
  if (skip !== "area" && f.viewportBounds) {
    const any = o.locations.some((l) => l.displayPoint && inBounds(f.viewportBounds!, l.displayPoint));
    if (!any && hasMapPoint(o)) return false;
  }
  if (skip !== "published" && f.publishedWithinDays != null) {
    if (!o.publication) {
      if (!f.includeUnknownDates) return false;
    } else if (-daysUntil(o.publication, now) > f.publishedWithinDays) return false;
  }
  if (skip !== "deadline" && f.deadlineWithinDays != null) {
    if (f.deadlineWithinDays === "unknown") {
      if (o.deadline) return false;
    } else if (!o.deadline) {
      if (!f.includeUnknownDates) return false;
    } else if (daysUntil(o.deadline, now) > f.deadlineWithinDays) return false;
  }
  return true;
}

export function sortOpportunities(list: Opportunity[], sort: CatalogFilter["sort"]): Opportunity[] {
  const key = (o: Opportunity) => (sort === "newly_posted" ? dateSortKey(o.publication) : dateSortKey(o.deadline));
  const dir = sort === "newly_posted" ? -1 : 1;
  return [...list].sort((a, b) => {
    const ka = key(a), kb = key(b);
    if (ka == null && kb == null) return a.title.localeCompare(b.title);
    if (ka == null) return 1; // unknown dates last
    if (kb == null) return -1;
    return (ka - kb) * dir || a.title.localeCompare(b.title);
  });
}

export function queryCatalog(all: Opportunity[], agencyList: Agency[], f: CatalogFilter, now = new Date()) {
  const agencies = new Map(agencyList.map((a) => [a.id, a]));
  const open = all.filter((o) => isOpenForDiscovery(o, now));
  const filtered = sortOpportunities(open.filter((o) => passes(o, f, agencies, now)), f.sort);

  const facets: Facets = { workCategories: {}, counties: {}, agencies: {} };
  for (const o of open) {
    if (passes(o, f, agencies, now, "categories")) for (const c of new Set(o.workCategories.map((c) => c.id))) facets.workCategories[c as WorkCategoryId] = (facets.workCategories[c as WorkCategoryId] ?? 0) + 1;
    if (passes(o, f, agencies, now, "counties")) for (const c of new Set(o.locations.flatMap((l) => l.countyNames))) facets.counties[c] = (facets.counties[c] ?? 0) + 1;
    if (passes(o, f, agencies, now, "agencies")) facets.agencies[o.agencyId] = (facets.agencies[o.agencyId] ?? 0) + 1;
  }
  const mappedCount = filtered.filter(hasMapPoint).length;
  return { data: filtered, facets, totalFiltered: filtered.length, mappedCount, unmappedCount: filtered.length - mappedCount, openCount: open.length };
}
