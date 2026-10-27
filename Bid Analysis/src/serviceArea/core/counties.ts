import waGeo from "@/map/assets/wa-geo.json";

/**
 * Washington's counties as the map draws them (src/map/assets/wa-geo.json),
 * so a name the map passes to onCountyClick and the FIPS code of the same shape
 * always translate deterministically.
 */
export const WASHINGTON_COUNTIES: readonly { name: string; fips: string }[] = (waGeo as { counties: { name: string; fips: string }[] }).counties
  .map(({ name, fips }) => ({ name, fips }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const WASHINGTON_COUNTY_NAMES: readonly string[] = WASHINGTON_COUNTIES.map((c) => c.name);

const byKey = new Map<string, string>();
const fipsByName = new Map<string, string>();
const nameByFips = new Map<string, string>();
for (const { name, fips } of WASHINGTON_COUNTIES) {
  byKey.set(name.toLowerCase(), name);
  byKey.set(fips, name);
  fipsByName.set(name, fips);
  nameByFips.set(fips, name);
}

/**
 * Maps "King", "king county", "Pierce County, WA" or "53053" to the canonical
 * county name, or null when it isn't a Washington county. Never guesses from
 * partial or misspelled names.
 */
export function normalizeCountyName(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const key = input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/,\s*(wa|washington)\.?\s*$/, "")
    .replace(/\s+(county|co\.?)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return byKey.get(key) ?? null;
}

export const countyFips = (name: string): string | null => fipsByName.get(name) ?? null;
export const countyNameForFips = (fips: string): string | null => nameByFips.get(fips) ?? null;

const order = new Map(WASHINGTON_COUNTY_NAMES.map((name, i) => [name, i]));

/** Deduplicates and returns counties in canonical alphabetical order. */
export function sortCounties(names: Iterable<string>): string[] {
  return [...new Set(names)].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}
