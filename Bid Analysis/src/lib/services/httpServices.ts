import type {
  Agency,
  CatalogFilter,
  CatalogResponse,
  CoverageSummary,
  InterpretResponse,
  MatchResponse,
  Opportunity,
  Session,
  VendorProfile,
  VendorProfileFields,
} from "../contracts";
import { ExplorerServices, ServiceError } from "./types";

/**
 * Adapter for the /api/v1 routes in SRS section 13.1 (owned by workstream C,
 * with B's interpretation and matching behind the facade).
 * Every route except signup/login needs the server-side session cookie.
 */
export function createHttpServices(baseUrl = ""): ExplorerServices {
  async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/v1${path}`, {
        method,
        credentials: "include",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      throw new ServiceError({ code: "source_unavailable", message: "Couldn't reach the server. Check your connection and try again.", retryable: true });
    }
    let payload: { data?: T; error?: { code: ServiceError["code"]; message: string; retryable: boolean } | null } & Record<string, unknown>;
    try {
      payload = await res.json();
    } catch {
      throw new ServiceError({ code: "internal_error", message: `The server sent an unreadable response (${res.status}).`, retryable: res.status >= 500 });
    }
    if (!res.ok || payload.error) {
      const err = payload.error ?? { code: res.status === 401 ? "unauthenticated" : "internal_error", message: `Request failed (${res.status}).`, retryable: res.status >= 500 };
      throw new ServiceError(err);
    }
    return payload as unknown as T;
  }

  const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

  return {
    integration: { catalog: "live", interpretation: "live", matching: "live", auth: "live", saving: "live" },
    auth: {
      getSession: () =>
        data(call<{ data: Session | null }>("GET", "/auth/session")).catch((e) => {
          if (e instanceof ServiceError && e.code === "unauthenticated") return null;
          throw e;
        }),
      signUp: (username, password) => data(call<{ data: Session }>("POST", "/auth/signup", { username, password })),
      signIn: (username, password) => data(call<{ data: Session }>("POST", "/auth/login", { username, password })),
      signOut: () => call<unknown>("POST", "/auth/logout").then(() => undefined),
    },
    catalog: {
      listOpportunities: (filter: CatalogFilter, signal) => {
        const q = encodeFilter(filter);
        return call<CatalogResponse>("GET", `/opportunities?${q}`, undefined, signal);
      },
      getOpportunity: (id, signal) =>
        data(call<{ data: { opportunity: Opportunity; agency: Agency | null } }>("GET", `/opportunities/${encodeURIComponent(id)}`, undefined, signal)),
      getCoverage: () => data(call<{ data: CoverageSummary }>("GET", "/coverage")),
    },
    profile: {
      interpret: (description, hints) => data(call<{ data: InterpretResponse }>("POST", "/profile/interpret", { description, ...hints })),
      getMine: () => data(call<{ data: VendorProfile | null }>("GET", "/me/profile")),
      saveMine: (fields: VendorProfileFields, originalDescription, expectedRevision) =>
        data(call<{ data: VendorProfile }>("PUT", "/me/profile", { fields, originalDescription, expectedRevision })),
    },
    matching: {
      match: (profile, filter, signal) => call<MatchResponse>("POST", "/matches", { profileId: profile.id, profileRevision: profile.revision, filter }, signal),
    },
    saved: {
      list: () => data(call<{ data: string[] }>("GET", "/me/saved-opportunities")),
      save: (id) => call<unknown>("PUT", `/me/saved-opportunities/${encodeURIComponent(id)}`).then(() => undefined),
      remove: (id) => call<unknown>("DELETE", `/me/saved-opportunities/${encodeURIComponent(id)}`).then(() => undefined),
    },
  };
}

/** Filter -> query string. Arrays are comma-joined; vendor descriptions never go in URLs (SRS 13.6). */
export function encodeFilter(f: CatalogFilter): string {
  const p = new URLSearchParams();
  if (f.query) p.set("query", f.query);
  if (f.workCategories.length) p.set("workCategories", f.workCategories.join(","));
  if (f.agencyIds.length) p.set("agencyIds", f.agencyIds.join(","));
  if (f.agencyTypes.length) p.set("agencyTypes", f.agencyTypes.join(","));
  if (f.countyNames.length) p.set("countyNames", f.countyNames.join(","));
  const now = Date.now();
  if (f.publishedWithinDays != null) p.set("publishedAfter", new Date(now - f.publishedWithinDays * 864e5).toISOString().slice(0, 10));
  if (f.deadlineWithinDays === "unknown") p.set("deadlineUnknown", "true");
  else if (f.deadlineWithinDays != null) p.set("deadlineBefore", new Date(now + f.deadlineWithinDays * 864e5).toISOString().slice(0, 10));
  p.set("includeUnknownDates", String(f.includeUnknownDates));
  p.set("includeStatewide", String(f.includeStatewide));
  p.set("includeUnknownLocations", String(f.includeUnknownLocations));
  if (f.viewportBounds) {
    const b = f.viewportBounds;
    p.set("viewportBounds", [b.west, b.south, b.east, b.north].map((n) => n.toFixed(4)).join(","));
  }
  p.set("sort", f.sort);
  return p.toString();
}
