import type { Agency, CatalogFilter, Opportunity, Session, VendorProfile, VendorProfileFields } from "../contracts";
import { queryCatalog, isOpenForDiscovery, hasMapPoint } from "../catalogQuery";
import { interpretDescription } from "../sim/interpret";
import { assess, SIM_RANKING_VERSION } from "../sim/match";
import { FIXTURE_AGENCIES } from "@/fixtures/dev/agencies";
import { FIXTURE_OPPORTUNITIES, FIXTURE_SNAPSHOT_AT } from "@/fixtures/dev/opportunities";
import { CapabilityMode, ExplorerServices, ServiceError } from "./types";

/** A whole catalog loaded at once and queried client-side with queryCatalog. */
export interface CatalogSnapshot {
  opportunities: Opportunity[];
  agencies: Agency[];
  snapshotAt: string;
  catalogVersion: string;
  lastSuccessfulCheckAt: string | null;
  limitations: string[];
}

export interface CatalogSource {
  mode: CapabilityMode;
  load(): Promise<CatalogSnapshot>;
}

const FIXTURE_SOURCE: CatalogSource = {
  mode: "fixture",
  load: async () => ({
    opportunities: FIXTURE_OPPORTUNITIES,
    agencies: FIXTURE_AGENCIES,
    snapshotAt: FIXTURE_SNAPSHOT_AT,
    catalogVersion: "dev-fixtures-2026-10-25",
    lastSuccessfulCheckAt: null,
    limitations: ["Development fixtures. These are sample listings, not real open solicitations."],
  }),
};

/** Toggles for exercising failure states from the Data and coverage sheet. */
export const devFaults = { catalog: false, interpretation: false, matching: false, profileSave: false, profileConflict: false };

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

async function sha256(text: string) {
  if (!globalThis.crypto?.subtle) {
    // Insecure-context fallback for local previews. Development stand-in only.
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16);
  }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Development stand-in for every backend capability. Nothing leaves the browser
 * and nothing persists past a reload. Its `integration` block is shown in the UI
 * so simulated behavior is never mistaken for a connected service.
 */
export function createFixtureServices(source: CatalogSource = FIXTURE_SOURCE): ExplorerServices {
  let pending: Promise<CatalogSnapshot> | null = null;
  const snapshot = () => {
    // Retry after a failed load instead of caching the failure.
    pending ??= source.load().catch((e) => {
      pending = null;
      throw e;
    });
    return pending;
  };
  const users = new Map<string, { id: string; hash: string }>();
  let session: Session | null = null;
  const profiles = new Map<string, VendorProfile>();
  const saved = new Map<string, Set<string>>();
  const requireSession = () => {
    if (!session) throw new ServiceError({ code: "unauthenticated", message: "Sign in to continue.", retryable: false });
    return session;
  };

  return {
    integration: { catalog: source.mode, interpretation: "simulated", matching: "simulated", auth: "session_only", saving: "session_only" },
    auth: {
      async getSession() {
        return session;
      },
      async signUp(username, password) {
        await wait(350);
        const u = username.trim().toLowerCase();
        if (!/^[a-z0-9._-]{3,32}$/.test(u)) throw new ServiceError({ code: "invalid_input", message: "Usernames use 3 to 32 letters, numbers, dots, dashes, or underscores.", retryable: false });
        if (password.length < 10) throw new ServiceError({ code: "invalid_input", message: "Use at least 10 characters for your password.", retryable: false });
        if (users.has(u)) throw new ServiceError({ code: "invalid_input", message: "That username is taken. Try another, or sign in.", retryable: false });
        const id = `dev-user-${users.size + 1}`;
        users.set(u, { id, hash: await sha256(`${u}:${password}`) });
        session = { user: { id, username: u }, persistence: "session_only" };
        return session;
      },
      async signIn(username, password) {
        await wait(300);
        const u = username.trim().toLowerCase();
        const rec = users.get(u);
        if (!rec || rec.hash !== (await sha256(`${u}:${password}`)))
          throw new ServiceError({ code: "unauthenticated", message: "That username and password don't match an account created in this session.", retryable: false });
        session = { user: { id: rec.id, username: u }, persistence: "session_only" };
        return session;
      },
      async signOut() {
        session = null;
      },
    },
    catalog: {
      async listOpportunities(filter: CatalogFilter, signal) {
        requireSession();
        await wait(180, signal);
        if (devFaults.catalog) throw new ServiceError({ code: "source_unavailable", message: "The opportunity service didn't respond.", retryable: true });
        const c = await snapshot();
        const r = queryCatalog(c.opportunities, c.agencies, filter);
        return {
          data: r.data,
          agencies: c.agencies,
          facets: r.facets,
          meta: {
            schemaVersion: "1.0",
            catalogVersion: c.catalogVersion,
            generatedAt: new Date().toISOString(),
            sourceSnapshotAt: c.snapshotAt,
            isStale: false,
            totalFiltered: r.totalFiltered,
            mappedCount: r.mappedCount,
            unmappedCount: r.unmappedCount,
            limitations: c.limitations,
          },
        };
      },
      async getOpportunity(id, signal) {
        requireSession();
        await wait(60, signal);
        const c = await snapshot();
        const opportunity = c.opportunities.find((o) => o.id === id);
        if (!opportunity) throw new ServiceError({ code: "not_found", message: "This opportunity is no longer in the catalog.", retryable: false });
        return { opportunity, agency: c.agencies.find((a) => a.id === opportunity.agencyId) ?? null };
      },
      async getCoverage() {
        const c = await snapshot();
        const open = c.opportunities.filter((o) => isOpenForDiscovery(o));
        const fixtures = source.mode === "fixture";
        const count = (k: string) => open.filter((o) => o.locationStatus === k).length;
        return {
          agenciesInInventory: null,
          agenciesChecked: fixtures ? 0 : null,
          agenciesWithOpenWork: fixtures ? 0 : new Set(open.map((o) => o.agencyId)).size,
          uniqueOpenOpportunities: fixtures ? 0 : open.length,
          locationBreakdown: {
            located: open.filter((o) => hasMapPoint(o) && o.locationStatus !== "approximate").length,
            approximate: count("approximate"),
            statewide: count("statewide") + count("remote"),
            unknown: count("unknown"),
          },
          lastSuccessfulCheckAt: c.lastSuccessfulCheckAt,
          catalogVersion: c.catalogVersion,
          isStale: false,
          limitations: fixtures ? [
            "No real sources are connected yet. Workstream C's collected catalog will replace these fixtures.",
            `${open.length} open sample listings across ${new Set(open.map((o) => o.agencyId)).size} agencies are loaded for development only.`,
          ] : c.limitations,
        };
      },
    },
    profile: {
      async interpret(description, hints) {
        requireSession();
        await wait(900);
        if (devFaults.interpretation) throw new ServiceError({ code: "ai_unavailable", message: "Profile interpretation is unavailable right now.", retryable: true });
        return interpretDescription(description, hints);
      },
      async getMine() {
        return profiles.get(requireSession().user.id) ?? null;
      },
      async saveMine(fields: VendorProfileFields, originalDescription, expectedRevision) {
        const { user } = requireSession();
        await wait(250);
        const prev = profiles.get(user.id);
        if (devFaults.profileSave) throw new ServiceError({ code: "internal_error", message: "The profile service didn't respond.", retryable: true });
        if (devFaults.profileConflict || (prev?.revision ?? null) !== expectedRevision) throw new ServiceError({ code: "revision_conflict", message: "Your profile changed in another tab. Reload it and try again.", retryable: false });
        const confirmed = Object.fromEntries(
          Object.entries(fields).map(([k, f]) => [k, { value: f.value, provenance: f.value == null ? "unknown" : "confirmed" }]),
        ) as unknown as VendorProfileFields;
        const next: VendorProfile = { ...confirmed, id: prev?.id ?? `dev-profile-${user.id}`, revision: (prev?.revision ?? 0) + 1, ownerUserId: user.id, originalDescription, confirmedAt: new Date().toISOString() };
        profiles.set(user.id, next);
        return next;
      },
    },
    matching: {
      async match(profile, filter, signal) {
        requireSession();
        // Variable latency so out-of-order responses can happen, as they can live.
        await wait(700 + ((profile.revision * 397) % 900), signal);
        if (devFaults.matching) throw new ServiceError({ code: "ai_unavailable", message: "Matching is unavailable right now.", retryable: true });
        const c = await snapshot();
        const { data } = queryCatalog(c.opportunities, c.agencies, { ...filter, viewportBounds: null });
        const assessments = data.map((o) => assess(o, profile, c.agencies.find((a) => a.id === o.agencyId)));
        return {
          data: assessments,
          meta: { profileRevision: profile.revision, rankingVersion: SIM_RANKING_VERSION, assessedCount: assessments.length, unassessedCount: 0, assessmentState: "complete", mode: "simulated" },
        };
      },
    },
    saved: {
      async list() {
        return [...(saved.get(requireSession().user.id) ?? [])];
      },
      async save(id) {
        const u = requireSession().user.id;
        await wait(120);
        saved.set(u, new Set([...(saved.get(u) ?? []), id]));
      },
      async remove(id) {
        const u = requireSession().user.id;
        await wait(120);
        saved.get(u)?.delete(id);
      },
    },
  };
}
