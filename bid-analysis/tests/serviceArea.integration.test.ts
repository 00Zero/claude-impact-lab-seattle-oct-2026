import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CatalogFilter, MatchResponse, Session, VendorProfile, VendorProfileFields } from "@/lib/contracts";
import { DEFAULT_FILTER, queryCatalog } from "@/lib/catalogQuery";
import { interpretDescription } from "@/lib/sim/interpret";
import { createHttpServices } from "@/lib/services/httpServices";
import { ServiceError, type ExplorerServices } from "@/lib/services/types";
import { FIXTURE_AGENCIES } from "@/fixtures/dev/agencies";
import { FIXTURE_OPPORTUNITIES } from "@/fixtures/dev/opportunities";
import { ExplorerProvider, initial, reducer, useExplorer } from "@/explorer/store";
import { compareServiceAreas } from "@/serviceArea/core/comparison";
import { fromProfileField } from "@/serviceArea/core/serviceArea";
import { fieldsWithServiceArea, fitRefreshFor, geographyFreeFilter, isGeographyFree, saveServiceAreaSelection } from "@/serviceArea/integration";

const NOW = new Date("2026-10-25T17:00:00Z");

function profileAt(revision: number, counties: string[] = ["Pierce"]): VendorProfile {
  const draft = interpretDescription("Asphalt paving and pothole patching, licensed and bonded, in Pierce County.").draft;
  return {
    ...draft,
    businessName: { value: "Example Paving", provenance: "confirmed" },
    serviceArea: { value: { kind: "counties", counties }, provenance: "confirmed" },
    id: "p1",
    revision,
    ownerUserId: "u1",
    originalDescription: "Asphalt paving and pothole patching.",
    confirmedAt: NOW.toISOString(),
  };
}

describe("profile payload and revision compatibility", () => {
  test("only the service area changes; every other field and its provenance is preserved", () => {
    const p = profileAt(3);
    const fields = fieldsWithServiceArea(p, { kind: "counties", counties: ["Pierce", "Thurston"] });
    assert.deepEqual(fields.serviceArea, { value: { kind: "counties", counties: ["Pierce", "Thurston"] }, provenance: "confirmed" });
    for (const key of Object.keys(fields) as (keyof VendorProfileFields)[]) {
      if (key !== "serviceArea") assert.deepEqual(fields[key], p[key], key);
    }
    assert.ok(!("revision" in fields) && !("id" in fields) && !("ownerUserId" in fields));
    assert.deepEqual(fieldsWithServiceArea(p, { kind: "statewide" }).serviceArea.value, { kind: "statewide" });
  });

  test("reads the app's provenance-wrapped shape without changing it", () => {
    assert.deepEqual(fromProfileField({ value: { kind: "counties", counties: ["pierce county", "King"] }, provenance: "user" }), { kind: "counties", counties: ["King", "Pierce"] });
    assert.deepEqual(fromProfileField({ value: { kind: "statewide" }, provenance: "confirmed" }), { kind: "statewide" });
    assert.deepEqual(fromProfileField({ value: null, provenance: "unknown" }), { kind: "unset" });
    assert.equal(fromProfileField({ value: { kind: "counties", counties: ["Multnomah"] }, provenance: "user" }).kind, "unsupported");
  });

  test("saving goes through confirmProfile once and requests no matching of its own", async () => {
    const calls: [VendorProfileFields, string][] = [];
    const confirm = async (fields: VendorProfileFields, description: string) => {
      calls.push([fields, description]);
      return { ...profileAt(4, ["Pierce", "Thurston"]) };
    };
    const out = await saveServiceAreaSelection(confirm, profileAt(3), { kind: "counties", counties: ["Pierce", "Thurston"] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1], "Asphalt paving and pothole patching.");
    assert.deepEqual(out, { revision: 4, serviceArea: { kind: "counties", counties: ["Pierce", "Thurston"] } });
  });

  describe("over the existing HTTP adapter", () => {
    const realFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = realFetch;
    });
    function stub(status: number, body: unknown) {
      const seen: { url: string; init: RequestInit }[] = [];
      globalThis.fetch = (async (url: string, init: RequestInit) => {
        seen.push({ url, init });
        return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      }) as typeof fetch;
      return seen;
    }

    test("PUT /me/profile carries fields and expectedRevision with cookie credentials", async () => {
      const seen = stub(200, { data: profileAt(4, ["Pierce", "Thurston"]) });
      const http = createHttpServices("https://api.example.test");
      const fields = fieldsWithServiceArea(profileAt(3), { kind: "counties", counties: ["Pierce", "Thurston"] });
      const saved = await http.profile.saveMine(fields, "desc", 3);
      assert.equal(saved.revision, 4);
      assert.equal(seen[0].url, "https://api.example.test/api/v1/me/profile");
      assert.equal(seen[0].init.method, "PUT");
      assert.equal(seen[0].init.credentials, "include");
      const body = JSON.parse(String(seen[0].init.body));
      assert.deepEqual(Object.keys(body).sort(), ["expectedRevision", "fields", "originalDescription"]);
      assert.equal(body.expectedRevision, 3);
      assert.deepEqual(body.fields.serviceArea, { value: { kind: "counties", counties: ["Pierce", "Thurston"] }, provenance: "confirmed" });
      assert.equal("baseRevision" in body, false);
    });

    test("a 409 surfaces as revision_conflict", async () => {
      stub(409, { error: { code: "revision_conflict", message: "Stale revision.", retryable: false } });
      const http = createHttpServices("");
      await assert.rejects(http.profile.saveMine(fieldsWithServiceArea(profileAt(3), { kind: "statewide" }), "d", 2), (e: unknown) => e instanceof ServiceError && e.code === "revision_conflict");
    });

    test("POST /matches sends profileId, profileRevision and filter", async () => {
      const meta: MatchResponse["meta"] = { profileRevision: 4, rankingVersion: "r", assessedCount: 0, unassessedCount: 0, assessmentState: "complete", mode: "live" };
      const seen = stub(200, { data: [], meta });
      const http = createHttpServices("");
      const r = await http.matching.match(profileAt(4), DEFAULT_FILTER);
      assert.equal(r.meta.profileRevision, 4);
      const body = JSON.parse(String(seen[0].init.body));
      assert.deepEqual(Object.keys(body).sort(), ["filter", "profileId", "profileRevision"]);
      assert.equal(seen[0].init.credentials, "include");
    });
  });
});

describe("comparison catalog without geographic filtering", () => {
  const userFilter: CatalogFilter = { ...DEFAULT_FILTER, countyNames: ["Pierce"], viewportBounds: { west: -122.6, south: 47.1, east: -122.3, north: 47.3 }, workCategories: ["paving"], fitTiers: ["good_fit"], query: "" };

  test("keeps keyword, work type, agency and date filters; drops county, map area and fit tiers", () => {
    const f = geographyFreeFilter(userFilter);
    assert.deepEqual(f.countyNames, []);
    assert.equal(f.viewportBounds, null);
    assert.deepEqual(f.fitTiers, []);
    assert.equal(f.includeStatewide && f.includeUnknownLocations, true);
    assert.deepEqual(f.workCategories, ["paving"]);
    assert.equal(isGeographyFree(f), true);
    assert.equal(isGeographyFree(userFilter), false);
    assert.equal(isGeographyFree(DEFAULT_FILTER), true);
  });

  test("work outside the county filter becomes visible as newly reachable", () => {
    const mapResults = queryCatalog(FIXTURE_OPPORTUNITIES, FIXTURE_AGENCIES, userFilter, NOW).data;
    const comparisonInput = queryCatalog(FIXTURE_OPPORTUNITIES, FIXTURE_AGENCIES, geographyFreeFilter(userFilter), NOW).data;
    assert.ok(!mapResults.some((o) => o.id === "dev-008"), "King paving is hidden by the Pierce filter on the map");
    assert.ok(comparisonInput.every((o) => o.workCategories.some((c) => c.id === "paving")), "work type filter still applies");
    const r = compareServiceAreas({ opportunities: comparisonInput, baseline: { kind: "counties", counties: ["Pierce"] }, draft: { kind: "counties", counties: ["Pierce", "King"] } });
    assert.ok(r.added.some((c) => c.opportunity.id === "dev-008"));
    // Feeding the county-filtered map results instead would hide it.
    const wrong = compareServiceAreas({ opportunities: mapResults, baseline: { kind: "counties", counties: ["Pierce"] }, draft: { kind: "counties", counties: ["Pierce", "King"] } });
    assert.ok(!wrong.added.some((c) => c.opportunity.id === "dev-008"));
  });
});

/* ---------- The real store, rendered headlessly ---------- */

// Enough of a browser for React DOM to run the store's effects; nothing here renders DOM.
// React reads `window.event` for update priority and checks iframes when restoring focus.
// Each test file runs in its own process, so these stubs don't leak into other suites.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { window?: unknown }).window ??= { HTMLIFrameElement: class {} };

function container() {
  const noop = () => {};
  const doc = { nodeType: 9, addEventListener: noop, removeEventListener: noop };
  return { nodeType: 1, nodeName: "DIV", tagName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener: noop, removeEventListener: noop } as unknown as Element;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

/** Services that record every call and let the test decide when matching answers. */
function fakeServices() {
  const session: Session = { user: { id: "u1", username: "tester" }, persistence: "account" };
  const server = { profile: profileAt(1) };
  const matchCalls: { revision: number; signal?: AbortSignal; reply: ReturnType<typeof deferred<MatchResponse>> }[] = [];
  const saves: { expectedRevision: number | null; fields: VendorProfileFields }[] = [];
  const catalog = queryCatalog(FIXTURE_OPPORTUNITIES, FIXTURE_AGENCIES, DEFAULT_FILTER, NOW);
  const services: ExplorerServices = {
    integration: { catalog: "fixture", interpretation: "simulated", matching: "simulated", auth: "session_only", saving: "session_only" },
    auth: { getSession: async () => session, signUp: async () => session, signIn: async () => session, signOut: async () => {} },
    catalog: {
      listOpportunities: async () => ({ data: catalog.data, agencies: FIXTURE_AGENCIES, facets: catalog.facets, meta: { schemaVersion: "1", catalogVersion: "v1", generatedAt: NOW.toISOString(), sourceSnapshotAt: null, isStale: false, totalFiltered: catalog.totalFiltered, mappedCount: catalog.mappedCount, unmappedCount: catalog.unmappedCount, limitations: [] } }),
      getOpportunity: async (id) => ({ opportunity: FIXTURE_OPPORTUNITIES.find((o) => o.id === id)!, agency: null }),
      getCoverage: async () => { throw new Error("unused"); },
    },
    profile: {
      interpret: async () => { throw new Error("unused"); },
      getMine: async () => server.profile,
      async saveMine(fields, originalDescription, expectedRevision) {
        saves.push({ expectedRevision, fields });
        if (expectedRevision !== server.profile.revision) throw new ServiceError({ code: "revision_conflict", message: "Stale revision.", retryable: false });
        server.profile = { ...server.profile, ...fields, revision: server.profile.revision + 1, originalDescription };
        return server.profile;
      },
    },
    matching: {
      match(profile, _filter, signal) {
        const reply = deferred<MatchResponse>();
        signal?.addEventListener("abort", () => reply.reject(new DOMException("Aborted", "AbortError")));
        matchCalls.push({ revision: profile.revision, signal, reply });
        return reply.promise;
      },
    },
    saved: { list: async () => [], save: async () => {}, remove: async () => {} },
  };
  const answer = (revision: number): MatchResponse => ({
    data: [{ opportunityId: "dev-001", opportunityVersion: "1", profileId: "p1", profileRevision: revision, state: "assessed", tier: "good_fit", rankingScore: 1, reasons: [], mismatches: [], unknowns: [], suggestedClarifications: [], assessedAt: null, rankingVersion: "r" }],
    meta: { profileRevision: revision, rankingVersion: "r", assessedCount: 1, unassessedCount: 0, assessmentState: "complete", mode: "simulated" },
  });
  return { services, server, matchCalls, saves, answer };
}

async function mount(services: ExplorerServices) {
  let ctx!: ReturnType<typeof useExplorer>;
  function Probe() {
    ctx = useExplorer();
    return null;
  }
  let root!: Root;
  await act(async () => {
    root = createRoot(container());
    root.render(createElement(ExplorerProvider, { services, children: createElement(Probe) }));
  });
  await settle();
  return { get: () => ctx, unmount: () => act(() => root.unmount()) };
}

const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); });

describe("store integration", () => {
  test("applying a service area triggers exactly one matching refresh, for the new revision", async () => {
    const f = fakeServices();
    const app = await mount(f.services);
    assert.deepEqual(f.matchCalls.map((c) => c.revision), [1]);
    await act(async () => f.matchCalls[0].reply.resolve(f.answer(1)));

    await act(async () => {
      await saveServiceAreaSelection(app.get().actions.confirmProfile, app.get().state.profile!, { kind: "counties", counties: ["Pierce", "Thurston"] });
    });
    await settle();
    assert.equal(f.saves.length, 1);
    assert.equal(f.saves[0].expectedRevision, 1);
    assert.deepEqual(f.matchCalls.map((c) => c.revision), [1, 2], "one new request, for revision 2");
    assert.equal(app.get().state.profile?.revision, 2);
    assert.deepEqual(app.get().state.profile?.serviceArea.value, { kind: "counties", counties: ["Pierce", "Thurston"] });
    assert.equal(app.get().state.profile?.businessName.value, "Example Paving");
    assert.deepEqual(fitRefreshFor(app.get().state.matching, app.get().state.profile, 2), { status: "pending" });

    await act(async () => f.matchCalls[1].reply.resolve(f.answer(2)));
    await settle();
    assert.equal(f.matchCalls.length, 2, "no further requests");
    assert.deepEqual(fitRefreshFor(app.get().state.matching, app.get().state.profile, 2), { status: "ready", mode: "simulated" });
    await app.unmount();
  });

  test("a late response for an older revision is aborted and never applied", async () => {
    const f = fakeServices();
    const app = await mount(f.services);
    await act(async () => f.matchCalls[0].reply.resolve(f.answer(1)));
    const save = (counties: string[]) => act(async () => { await saveServiceAreaSelection(app.get().actions.confirmProfile, app.get().state.profile!, { kind: "counties", counties }); });
    await save(["Pierce", "Thurston"]);
    await settle();
    await save(["Pierce", "Thurston", "Mason"]);
    await settle();
    assert.deepEqual(f.matchCalls.map((c) => c.revision), [1, 2, 3]);
    assert.equal(f.matchCalls[1].signal?.aborted, true, "revision 2's request was cancelled");

    await act(async () => f.matchCalls[2].reply.resolve(f.answer(3)));
    await act(async () => f.matchCalls[1].reply.resolve(f.answer(2))); // arrives last
    await settle();
    assert.equal(app.get().state.matching.forRevision, 3);
    assert.equal(fitRefreshFor(app.get().state.matching, app.get().state.profile, 2), null, "revision 2's status is superseded");
    await app.unmount();
  });

  test("a revision conflict rejects without changing the profile or requesting matches", async () => {
    const f = fakeServices();
    const app = await mount(f.services);
    f.server.profile = { ...f.server.profile, revision: 5 }; // another tab saved meanwhile
    await act(async () => {
      await assert.rejects(
        saveServiceAreaSelection(app.get().actions.confirmProfile, app.get().state.profile!, { kind: "statewide" }),
        (e: unknown) => e instanceof ServiceError && e.code === "revision_conflict",
      );
    });
    await settle();
    assert.equal(app.get().state.profile?.revision, 1);
    assert.deepEqual(app.get().state.profile?.serviceArea.value, { kind: "counties", counties: ["Pierce"] });
    assert.deepEqual(f.matchCalls.map((c) => c.revision), [1]);
    await app.unmount();
  });

  test("an older profile revision never replaces a newer one", () => {
    const s = reducer({ ...initial, profile: profileAt(3) }, { type: "profile/set", profile: profileAt(2, ["King"]) });
    assert.equal(s.profile?.revision, 3);
    assert.deepEqual(s.profile?.serviceArea.value, { kind: "counties", counties: ["Pierce"] });
  });
});
