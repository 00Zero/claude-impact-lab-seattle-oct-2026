import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FILTER, queryCatalog } from "@/lib/catalogQuery";
import { WA_COUNTIES } from "@/lib/taxonomy";
import { FIXTURE_AGENCIES } from "@/fixtures/dev/agencies";
import { FIXTURE_OPPORTUNITIES } from "@/fixtures/dev/opportunities";
import waGeo from "@/map/assets/wa-geo.json";
import { compareServiceAreas, type ServiceAreaComparison } from "@/serviceArea/core/comparison";
import { WASHINGTON_COUNTIES, countyFips, countyNameForFips, normalizeCountyName } from "@/serviceArea/core/counties";
import { resolveScope } from "@/serviceArea/core/geography";
import { buildMapHighlight } from "@/serviceArea/core/highlight";
import type { ProfileServiceArea, ServiceAreaSelection } from "@/serviceArea/core/serviceArea";
import { AGENCY_RECORD_METHOD } from "@/serviceArea/core/types";
import type { ExplorerLocation, ExplorerOpportunity } from "@/serviceArea/core/types";

const NOW = new Date("2026-10-25T17:00:00Z");
/** The fixture catalog as the explorer receives it: open work, no geographic filter. */
const CATALOG = queryCatalog(FIXTURE_OPPORTUNITIES, FIXTURE_AGENCIES, DEFAULT_FILTER, NOW).data;
const PIERCE: ProfileServiceArea = { kind: "counties", counties: ["Pierce"] };
const counties = (...names: string[]): ServiceAreaSelection => ({ kind: "counties", counties: names });
const ids = (changes: readonly { opportunity: { id: string } }[]) => changes.map((c) => c.opportunity.id).sort();

function loc(p: Partial<ExplorerLocation> & Pick<ExplorerLocation, "precision">): ExplorerLocation {
  return { id: `l-${Math.random()}`, label: "", countyNames: [], cityName: null, resolutionMethod: "deterministic_parsing", ...p };
}
function opp(id: string, locations: ExplorerLocation[], locationStatus: ExplorerOpportunity["locationStatus"] = "located"): ExplorerOpportunity {
  return { id, version: "1", title: id, agencyId: "a", deadline: null, locationStatus, locations };
}

describe("county name and FIPS translation", () => {
  test("covers the map's 39 counties with unique FIPS, matching the app's county list", () => {
    assert.equal(WASHINGTON_COUNTIES.length, 39);
    assert.equal(new Set(WASHINGTON_COUNTIES.map((c) => c.fips)).size, 39);
    assert.deepEqual([...WASHINGTON_COUNTIES.map((c) => c.name)].sort(), [...WA_COUNTIES].sort());
  });

  test("round-trips every map shape name through its FIPS code", () => {
    for (const shape of (waGeo as { counties: { name: string; fips: string }[] }).counties) {
      assert.equal(countyFips(shape.name), shape.fips);
      assert.equal(countyNameForFips(shape.fips), shape.name);
    }
    assert.equal(countyFips("Multnomah"), null);
  });

  test("normalizes source spellings and rejects anything else", () => {
    assert.equal(normalizeCountyName("king county"), "King");
    assert.equal(normalizeCountyName("  Walla  Walla County, WA "), "Walla Walla");
    assert.equal(normalizeCountyName("53053"), "Pierce");
    assert.equal(normalizeCountyName("Multnomah"), null);
    assert.equal(normalizeCountyName("Kin"), null);
  });

  test("map highlight carries both the name MapView uses and the FIPS code", () => {
    const h = buildMapHighlight({ baseline: { kind: "counties", counties: ["King", "Pierce"] }, draft: counties("King", "Thurston"), exploring: true, comparison: null });
    assert.deepEqual(h.counties, [
      { name: "King", fips: "53033", state: "kept" },
      { name: "Pierce", fips: "53053", state: "removed" },
      { name: "Thurston", fips: "53067", state: "added" },
    ]);
    assert.deepEqual(h.byName, { King: "kept", Pierce: "removed", Thurston: "added" });
    const idle = buildMapHighlight({ baseline: PIERCE, draft: counties("Pierce"), exploring: false, comparison: null });
    assert.deepEqual(idle.byName, { Pierce: "current" });
  });
});

describe("location scope", () => {
  test("statewide, remote and unknown fixtures stay explicit", () => {
    const scope = (id: string) => resolveScope(CATALOG.find((o) => o.id === id)!);
    assert.equal(scope("dev-030").kind, "statewide");
    assert.equal(scope("dev-034").kind, "remote");
    assert.deepEqual(scope("dev-032"), { kind: "unknown", reason: "precision_unknown" });
  });

  test("a city with no county and a non-Washington county are never guessed", () => {
    assert.deepEqual(resolveScope(opp("x", [loc({ precision: "city", cityName: "Bothell" })])), { kind: "unknown", reason: "county_not_resolved" });
    assert.deepEqual(resolveScope(opp("y", [loc({ precision: "county", countyNames: ["Multnomah"] })])), { kind: "unknown", reason: "not_a_washington_county" });
  });

  test("display points are never read, so an agency's coordinates can't place work", () => {
    const withPoint = { ...loc({ precision: "city", cityName: "Olympia" }), displayPoint: [-122.9, 47.04], displayPointBasis: "other" } as ExplorerLocation;
    assert.equal(resolveScope(opp("z", [withPoint])).kind, "unknown");
  });

  test("multi-site work resolves to the union of confirmed counties", () => {
    const scope = resolveScope(opp("m", [loc({ precision: "address", countyNames: ["King"] }), loc({ precision: "address", countyNames: ["Pierce"] }), loc({ precision: "unknown" })], "multiple"));
    assert.equal(scope.kind, "counties");
    if (scope.kind !== "counties") return;
    assert.deepEqual(scope.counties, ["King", "Pierce"]);
    assert.equal(scope.multiSite, true);
    assert.equal(scope.hasUnresolvedSites, true);
  });
});

describe("agency-derived locations", () => {
  const agencyOnly = opp("agency-only", [loc({ precision: "city", countyNames: ["Thurston"], cityName: "Olympia", resolutionMethod: AGENCY_RECORD_METHOD })], "approximate");

  test("regression: an agency's county alone cannot make an opportunity newly reachable", () => {
    const r = compareServiceAreas({ opportunities: [...CATALOG, agencyOnly], baseline: PIERCE, draft: counties("Pierce", "Thurston") });
    assert.ok(!ids(r.added).includes("agency-only"));
    assert.deepEqual(r.unconfirmed.map((u) => [u.opportunity.id, u.agencyCounties]), [["agency-only", ["Thurston"]]]);
    // Same before/after as without the record at all.
    const without = compareServiceAreas({ opportunities: CATALOG, baseline: PIERCE, draft: counties("Pierce", "Thurston") });
    assert.equal(r.before.included, without.before.included);
    assert.equal(r.after.included, without.after.included);
    assert.equal(r.countyStats.Thurston.gainIfAdded, without.countyStats.Thurston.gainIfAdded);
    assert.equal(r.countyStats.Thurston.total, without.countyStats.Thurston.total);
  });

  test("it is never counted as inside, even under all of Washington", () => {
    const r = compareServiceAreas({ opportunities: [agencyOnly], baseline: { kind: "unset" }, draft: { kind: "statewide" } });
    assert.equal(r.after.included, 0);
    assert.equal(r.after.unconfirmed, 1);
  });

  test("a confirmed site still counts; the agency-record site is set aside", () => {
    const mixed = opp("mixed", [loc({ precision: "address", countyNames: ["King"] }), loc({ precision: "county", countyNames: ["Pierce"], resolutionMethod: AGENCY_RECORD_METHOD })], "multiple");
    const scope = resolveScope(mixed);
    assert.equal(scope.kind === "counties" && scope.counties.join(), "King");
    const r = compareServiceAreas({ opportunities: [mixed], baseline: { kind: "unset" }, draft: counties("Pierce") });
    assert.equal(r.after.included, 0);
    assert.equal(r.after.outsideWithUnresolvedSites, 1);
  });
});

describe("before and after comparison", () => {
  test("adding Thurston reaches exactly the Thurston fixtures", () => {
    const r = compareServiceAreas({ opportunities: CATALOG, baseline: PIERCE, draft: counties("Pierce", "Thurston") });
    assert.deepEqual(ids(r.added), ["dev-020", "dev-021"]);
    assert.deepEqual(r.removed, []);
    assert.equal(r.after.included - r.before.included, 2);
    assert.deepEqual(r.addedCounties, ["Thurston"]);
  });

  test("multi-site work already reachable through another county is not newly reachable, and is counted once", () => {
    const kp = opp("kp", [loc({ precision: "road_segment", countyNames: ["King"] }), loc({ precision: "road_segment", countyNames: ["Pierce"] })], "multiple");
    const added = compareServiceAreas({ opportunities: [kp], baseline: PIERCE, draft: counties("Pierce", "King") });
    assert.equal(added.added.length, 0);
    assert.equal(added.after.included, 1);
    const removed = compareServiceAreas({ opportunities: [kp], baseline: { kind: "counties", counties: ["King", "Pierce"] }, draft: counties("King") });
    assert.equal(removed.removed.length, 0);
    const doubled = compareServiceAreas({ opportunities: [kp, kp, kp], baseline: PIERCE, draft: counties("Pierce") });
    assert.equal(doubled.catalogSize, 1);
    assert.equal(doubled.duplicateIdsIgnored, 2);
    assert.equal(doubled.after.included, 1);
  });

  test("the catalog partitions exactly into reachable, outside and unplaced buckets", () => {
    const catalog: ExplorerOpportunity[] = [...CATALOG, opp("ag", [loc({ precision: "county", countyNames: ["Lewis"], resolutionMethod: AGENCY_RECORD_METHOD })])];
    const drafts: ServiceAreaSelection[] = [counties(), counties("King"), counties("Thurston", "Mason"), { kind: "statewide" }];
    for (const draft of drafts) {
      // Annotated: assertion functions inside a loop otherwise trip TS7022.
      const r: ServiceAreaComparison<ExplorerOpportunity> = compareServiceAreas({ opportunities: catalog, baseline: PIERCE, draft });
      const t = r.after;
      assert.equal(t.included + t.outside + t.statewideNotIncluded + t.remote + t.unconfirmed + t.unknown, r.catalogSize, JSON.stringify(draft));
    }
  });

  test("unknown, remote and statewide work never moves with county changes", () => {
    const r = compareServiceAreas({ opportunities: CATALOG, baseline: PIERCE, draft: counties("King", "Spokane") });
    const moved = new Set([...ids(r.added), ...ids(r.removed)]);
    for (const id of ["dev-030", "dev-031", "dev-032", "dev-034", "dev-036"]) assert.ok(!moved.has(id), id);
    assert.equal(r.after.includedStatewide, 2);
  });

  test("statewide work joins with the first county and honors includeStatewide", () => {
    const statewide = CATALOG.filter((o) => o.locationStatus === "statewide");
    const r = compareServiceAreas({ opportunities: statewide, baseline: { kind: "unset" }, draft: counties("Spokane") });
    assert.deepEqual(ids(r.added), ["dev-030", "dev-031"]);
    const off = compareServiceAreas({ opportunities: statewide, baseline: { kind: "unset" }, draft: counties("Spokane"), policy: { includeStatewide: false } });
    assert.equal(off.added.length, 0);
    assert.equal(off.after.statewideNotIncluded, 2);
  });

  test("a stored area the map can't place is reported as not comparable", () => {
    const r = compareServiceAreas({ opportunities: CATALOG, baseline: { kind: "unsupported", description: "x" }, draft: counties("Pierce") });
    assert.equal(r.baselineComparable, false);
  });

  test("changes sort by the app's deadline rules, unknown deadlines last", () => {
    const r = compareServiceAreas({ opportunities: CATALOG, baseline: { kind: "unset" }, draft: { kind: "statewide" } });
    const keys = r.added.map((c) => c.opportunity.deadline?.value ?? null);
    const firstUnknown = keys.indexOf(null);
    if (firstUnknown >= 0) assert.ok(keys.slice(firstUnknown).every((k) => k === null));
  });

  test("per-county gains and losses for the picker", () => {
    const { countyStats } = compareServiceAreas({ opportunities: CATALOG, baseline: PIERCE, draft: counties("Pierce") });
    assert.equal(countyStats.Thurston.gainIfAdded, 2);
    assert.equal(countyStats.Pierce.lossIfRemoved, 5 + 2); // five Pierce fixtures plus the two statewide ones
    assert.equal(countyStats.Pierce.gainIfAdded, 0);
  });
});
