import { test } from "node:test";
import assert from "node:assert/strict";
import { mapCatalog, type BidRow, type SourceRow } from "@/lib/services/supabaseCatalog";
import { createFixtureServices } from "@/lib/services/fixtureServices";
import { DEFAULT_FILTER } from "@/lib/catalogQuery";
import { AGENCY_RECORD_METHOD } from "@/serviceArea/core/types";

const bid = (p: Partial<BidRow>): BidRow => ({
  id: "b1", source_id: "wa-city-tacoma", agency: "City of Tacoma", title: "Pothole repair", description: null, summary: null,
  location_text: "Tacoma, WA", lat: 47.25, lng: -122.44, state: "WA", county: "Pierce", city: "Tacoma", posted_date: "2026-10-20",
  deadline: "2099-11-05T22:00:00Z", solicitation_number: "SW-1", bid_type: "small_works", status: "open", categories: ["paving", "snow_removal"],
  naics_codes: ["237310"], requirements: ["bonded", "licensed"], contact_name: "A", contact_email: null, contact_phone: null,
  estimated_value_text: null, source_url: "https://example.org/1", documents: [{ name: "Specs", url: "https://example.org/1.pdf" }],
  extraction_method: "html", last_checked: "2026-10-25T21:00:00Z", created_at: null, updated_at: "2026-10-25T21:00:00Z", ...p,
});
const src: SourceRow = { id: "wa-city-tacoma", name: "City of Tacoma", agency_type: "city", county: "Pierce", city: "Tacoma", state: "WA", homepage_url: "https://tacoma.gov", procurement_url: null, status: "verified" };

test("open_bids rows map to the contract with agency-record locations", () => {
  const { opportunities, agencies } = mapCatalog([bid({})], [src]);
  const o = opportunities[0];
  assert.equal(o.agencyId, "wa-city-tacoma");
  assert.deepEqual(o.workCategories.map((c) => c.id), ["paving", "other"]);
  assert.equal(o.solicitationType.normalized, "small_works");
  assert.deepEqual(o.requirements.map((r) => r.category), ["bonding", "license"]);
  assert.equal(o.locations[0].resolutionMethod, AGENCY_RECORD_METHOD);
  assert.match(o.locations[0].label, /work site not confirmed/);
  assert.deepEqual(o.locations[0].countyNames, ["Pierce"]);
  assert.equal(o.locationStatus, "approximate");
  assert.equal(agencies[0].procurementCoverage, "checked");
});

test("bids without a known source get a synthetic agency; other states and missing places are handled", () => {
  const r = mapCatalog([bid({ id: "b2", source_id: null, agency: "Port of Nowhere", lat: null, lng: null, county: null, city: null }), bid({ id: "b3", state: "OR" })], []);
  assert.equal(r.skippedOutOfState, 1);
  assert.equal(r.opportunities.length, 1);
  assert.equal(r.opportunities[0].locationStatus, "unknown");
  assert.equal(r.agencies[0].name, "Port of Nowhere");
});

test("hybrid services serve the loaded catalog and keep matching simulated", async () => {
  const { opportunities, agencies } = mapCatalog([bid({})], [src]);
  const s = createFixtureServices({ mode: "live", load: async () => ({ opportunities, agencies, snapshotAt: "2026-10-25T21:00:00Z", catalogVersion: "t", lastSuccessfulCheckAt: null, limitations: [] }) });
  assert.equal(s.integration.catalog, "live");
  assert.equal(s.integration.matching, "simulated");
  await s.auth.signUp("tester", "long-enough-pw");
  const r = await s.catalog.listOpportunities(DEFAULT_FILTER);
  assert.equal(r.meta.totalFiltered, 1);
  assert.equal((await s.catalog.getOpportunity("b1")).agency?.name, "City of Tacoma");
});
