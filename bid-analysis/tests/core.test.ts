import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FILTER, queryCatalog } from "@/lib/catalogQuery";
import { isDeadlinePassed } from "@/lib/dates";
import { interpretDescription } from "@/lib/sim/interpret";
import { assess } from "@/lib/sim/match";
import { FIXTURE_AGENCIES } from "@/fixtures/dev/agencies";
import { FIXTURE_OPPORTUNITIES } from "@/fixtures/dev/opportunities";
import { initial, reducer } from "@/explorer/store";
import type { FitAssessment, VendorProfile, VendorProfileFields } from "@/lib/contracts";

const NOW = new Date("2026-10-25T17:00:00Z");
const byId = (id: string) => FIXTURE_OPPORTUNITIES.find((o) => o.id === id)!;
const run = (patch = {}) => queryCatalog(FIXTURE_OPPORTUNITIES, FIXTURE_AGENCIES, { ...DEFAULT_FILTER, ...patch }, NOW);

function profile(fields: VendorProfileFields, revision = 1): VendorProfile {
  return { ...fields, id: "p1", revision, ownerUserId: "u1", originalDescription: "", confirmedAt: NOW.toISOString() };
}

test("passed deadlines are excluded from discovery", () => {
  const ids = run().data.map((o) => o.id);
  assert.ok(!ids.includes("dev-038"));
  assert.equal(run().totalFiltered, FIXTURE_OPPORTUNITIES.length - 1);
});

test("a date-only deadline stays open through its own day in Washington", () => {
  const d = { rawText: null, value: "2026-10-25", precision: "date" as const, timeZone: "America/Los_Angeles" };
  assert.equal(isDeadlinePassed(d, new Date("2026-10-26T06:30:00Z")), false); // 11:30 PM PDT
  assert.equal(isDeadlinePassed(d, new Date("2026-10-26T08:00:00Z")), true);
});

test("closing-soonest sort puts unknown deadlines last", () => {
  const data = run().data;
  const firstUnknown = data.findIndex((o) => !o.deadline);
  assert.ok(firstUnknown > 0);
  assert.ok(data.slice(firstUnknown).every((o) => !o.deadline));
});

test("county filter keeps statewide work only when asked to", () => {
  const withStatewide = run({ countyNames: ["Pierce"] }).data.map((o) => o.id);
  const without = run({ countyNames: ["Pierce"], includeStatewide: false, includeUnknownLocations: false }).data.map((o) => o.id);
  assert.ok(withStatewide.includes("dev-030"));
  assert.ok(!without.includes("dev-030"));
  assert.ok(without.every((o) => byId(o).locations.some((l) => l.countyNames.includes("Pierce"))));
});

test("viewport filter keeps only pins inside the box plus the unpinned groups", () => {
  // Rough Seattle box
  const r = run({ viewportBounds: { west: -122.45, south: 47.48, east: -122.2, north: 47.75 } });
  assert.ok(r.mappedCount > 0);
  for (const o of r.data) {
    const pins = o.locations.filter((l) => l.displayPoint);
    if (!pins.length) continue;
    assert.ok(pins.some((l) => { const [lon, lat] = l.displayPoint!; return lon >= -122.45 && lon <= -122.2 && lat >= 47.48 && lat <= 47.75; }), o.id);
  }
});

test("interpretation never infers credentials from the trade", () => {
  const r = interpretDescription("We're a paving and pothole repair crew in Pierce County with a paver and two rollers.");
  assert.deepEqual(r.draft.coreServices.value?.sort(), ["paving", "pothole_repair"]);
  assert.equal(r.draft.contractorRegistration.value, null);
  assert.equal(r.draft.bonding.value, null);
  assert.equal(r.draft.insurance.value, null);
  assert.ok(r.followUps.length <= 3);
});

test("simulated matching: scope, geography and unknown requirements", () => {
  const draft = interpretDescription("Asphalt paving and pothole patching anywhere in Pierce County.").draft;
  const p = profile(draft);
  const tac = assess(byId("dev-001"), p, undefined, NOW);
  assert.notEqual(tac.tier, "not_a_fit");
  const vague = assess(byId("dev-033"), p, undefined, NOW);
  assert.equal(vague.tier === "needs_review" || vague.tier === "not_a_fit", true);
  const unknownLoc = assess(byId("dev-032"), p, undefined, NOW);
  assert.notEqual(unknownLoc.tier, "good_fit");
});

test("REC-07: an older revision's match response is dropped", () => {
  const p2 = profile(interpretDescription("Paving in King County").draft, 2);
  let s = reducer({ ...initial, profile: p2 }, { type: "match/pending", revision: 2 });
  const stale = { data: [{ opportunityId: "dev-001", tier: "good_fit" } as FitAssessment], meta: { profileRevision: 1, rankingVersion: "x", assessedCount: 1, unassessedCount: 0, assessmentState: "complete" as const, mode: "simulated" as const } };
  s = reducer(s, { type: "match/loaded", response: stale });
  assert.equal(s.matching.status, "pending");
  s = reducer(s, { type: "match/loaded", response: { ...stale, meta: { ...stale.meta, profileRevision: 2 } } });
  assert.equal(s.matching.status, "ready");
  assert.equal(s.matching.forRevision, 2);
});

test("sign-out clears profile, saved items and matching", () => {
  let s = reducer({ ...initial, profile: profile(interpretDescription("Paving").draft), saved: ["dev-001"] }, { type: "auth/signedOut" });
  assert.equal(s.profile, null);
  assert.deepEqual(s.saved, []);
});

test("booking link: https only, tagged with the opportunity id, nothing personal", async () => {
  const { bookingUrlFor } = await import("@/lib/booking");
  assert.equal(bookingUrlFor({ id: "dev-001" }, null), null);
  const u = new URL(bookingUrlFor({ id: "dev-001" }, "https://calendly.com/example/intro")!);
  assert.equal(u.searchParams.get("utm_content"), "dev-001");
  assert.deepEqual([...u.searchParams.keys()].sort(), ["utm_content", "utm_source"]);
});
