import type { ProfileField, ServiceArea } from "@/lib/contracts";
import { WASHINGTON_COUNTY_NAMES, normalizeCountyName, sortCounties } from "./counties";

/** An editable service area: the app's ServiceArea shape, with canonical county names. */
export type ServiceAreaSelection = { kind: "counties"; counties: readonly string[] } | { kind: "statewide" };

/**
 * The confirmed profile's area as the explorer sees it. `unset` means the
 * profile has none; `unsupported` means stored county names the map can't
 * place, which are reported instead of guessed.
 */
export type ProfileServiceArea = ServiceAreaSelection | { kind: "unset" } | { kind: "unsupported"; description: string };

export interface ExplorerProfile {
  profileId: string;
  revision: number;
  serviceArea: ProfileServiceArea;
}

export const EMPTY_SELECTION: ServiceAreaSelection = { kind: "counties", counties: [] };

export function isSelection(area: ProfileServiceArea): area is ServiceAreaSelection {
  return area.kind === "counties" || area.kind === "statewide";
}

/** Reads `VendorProfile.serviceArea` without changing the stored shape. */
export function fromProfileField(field: ProfileField<ServiceArea> | null | undefined): ProfileServiceArea {
  const value = field?.value;
  if (!value) return { kind: "unset" };
  if (value.kind === "statewide") return { kind: "statewide" };
  const names = value.counties.map(normalizeCountyName);
  if (names.some((n) => n === null)) {
    return { kind: "unsupported", description: `Counties the map can't place: ${value.counties.join(", ")}` };
  }
  return { kind: "counties", counties: sortCounties(names as string[]) };
}

/** Back to the persisted shape. County names only; FIPS stays a map concern. */
export function toServiceAreaValue(selection: ServiceAreaSelection): ServiceArea {
  return selection.kind === "statewide" ? { kind: "statewide" } : { kind: "counties", counties: [...selection.counties] };
}

export function selectionFromProfile(area: ProfileServiceArea): ServiceAreaSelection {
  return isSelection(area) ? area : EMPTY_SELECTION;
}

export function selectedCounties(selection: ServiceAreaSelection): readonly string[] {
  return selection.kind === "statewide" ? WASHINGTON_COUNTY_NAMES : selection.counties;
}

export function isEmptySelection(selection: ServiceAreaSelection): boolean {
  return selection.kind === "counties" && selection.counties.length === 0;
}

export function sameSelection(a: ServiceAreaSelection, b: ServiceAreaSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "statewide" || b.kind === "statewide") return true;
  const left = sortCounties(a.counties);
  const right = sortCounties(b.counties);
  return left.length === right.length && left.every((name, i) => name === right[i]);
}

/** True when a draft makes no change to the confirmed area. */
export function matchesProfileArea(draft: ServiceAreaSelection, area: ProfileServiceArea): boolean {
  return isSelection(area) ? sameSelection(draft, area) : isEmptySelection(draft);
}

export function withCountyToggled(selection: ServiceAreaSelection, county: string): ServiceAreaSelection {
  // Removing one county from "all of Washington" keeps every other county.
  if (selection.kind === "statewide") {
    return { kind: "counties", counties: WASHINGTON_COUNTY_NAMES.filter((name) => name !== county) };
  }
  const has = selection.counties.includes(county);
  return {
    kind: "counties",
    counties: has ? selection.counties.filter((name) => name !== county) : sortCounties([...selection.counties, county]),
  };
}

export function selectionLabel(selection: ServiceAreaSelection): string {
  if (selection.kind === "statewide") return "All of Washington";
  const { counties } = selection;
  if (counties.length === 0) return "No counties";
  if (counties.length <= 3) return counties.join(", ");
  return `${counties.slice(0, 2).join(", ")} and ${counties.length - 2} more`;
}

export function profileAreaLabel(area: ProfileServiceArea): string {
  if (area.kind === "unset") return "Not set";
  if (area.kind === "unsupported") return area.description;
  return selectionLabel(area);
}
