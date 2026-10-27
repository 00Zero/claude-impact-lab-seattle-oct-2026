"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  Agency,
  CatalogFilter,
  CatalogMeta,
  Facets,
  FitAssessment,
  MatchResponse,
  Opportunity,
  Session,
  VendorProfile,
  VendorProfileFields,
} from "@/lib/contracts";
import { DEFAULT_FILTER, hasMapPoint } from "@/lib/catalogQuery";
import type { ExplorerServices } from "@/lib/services/types";
import { isServiceError, ServiceError } from "@/lib/services/types";

type Status = "idle" | "loading" | "ready" | "error";

export interface ExplorerState {
  authChecked: boolean;
  session: Session | null;
  /** Session expired mid-use: keep everything on screen and ask to sign in again. */
  reauthRequired: boolean;
  filter: CatalogFilter;
  catalog: { status: Status; data: Opportunity[]; agencies: Agency[]; facets: Facets | null; meta: CatalogMeta | null; error: ServiceError | null };
  selectedId: string | null;
  hoveredId: string | null;
  detail: { id: string | null; status: Status; opportunity: Opportunity | null; agency: Agency | null; error: ServiceError | null };
  profile: VendorProfile | null;
  /** Description kept for editing; never put in URLs or analytics (SRS 13.6). */
  matching: { status: "idle" | "pending" | "ready" | "error"; forRevision: number | null; byId: Record<string, FitAssessment>; meta: MatchResponse["meta"] | null; error: ServiceError | null };
  saved: string[];
  savedOnly: boolean;
  listMode: "all" | "mapped" | "unmapped";
  areaDirty: boolean;
  onboarding: null | { mode: "new" | "edit" };
  sheet: null | "coverage" | "account";
  toast: { id: number; text: string; tone: "info" | "error" } | null;
}

export const initial: ExplorerState = {
  authChecked: false,
  session: null,
  reauthRequired: false,
  filter: DEFAULT_FILTER,
  catalog: { status: "idle", data: [], agencies: [], facets: null, meta: null, error: null },
  selectedId: null,
  hoveredId: null,
  detail: { id: null, status: "idle", opportunity: null, agency: null, error: null },
  profile: null,
  matching: { status: "idle", forRevision: null, byId: {}, meta: null, error: null },
  saved: [],
  savedOnly: false,
  listMode: "all",
  areaDirty: false,
  onboarding: null,
  sheet: null,
  toast: null,
};

export type Action =
  | { type: "auth/checked"; session: Session | null }
  | { type: "auth/signedIn"; session: Session }
  | { type: "auth/signedOut" }
  | { type: "auth/expired" }
  | { type: "filter/set"; patch: Partial<CatalogFilter> }
  | { type: "filter/reset" }
  | { type: "catalog/loading" }
  | { type: "catalog/loaded"; data: Opportunity[]; agencies: Agency[]; facets: Facets; meta: CatalogMeta }
  | { type: "catalog/failed"; error: ServiceError }
  | { type: "select"; id: string | null }
  | { type: "hover"; id: string | null }
  | { type: "detail/loading"; id: string }
  | { type: "detail/loaded"; id: string; opportunity: Opportunity; agency: Agency | null }
  | { type: "detail/failed"; id: string; error: ServiceError }
  | { type: "profile/set"; profile: VendorProfile | null }
  | { type: "match/pending"; revision: number }
  | { type: "match/loaded"; response: MatchResponse }
  | { type: "match/failed"; revision: number; error: ServiceError }
  | { type: "saved/set"; ids: string[] }
  | { type: "savedOnly"; value: boolean }
  | { type: "listMode"; value: ExplorerState["listMode"] }
  | { type: "area/dirty"; value: boolean }
  | { type: "onboarding"; value: ExplorerState["onboarding"] }
  | { type: "sheet"; value: ExplorerState["sheet"] }
  | { type: "toast"; text: string | null; tone?: "info" | "error" };

export function reducer(s: ExplorerState, a: Action): ExplorerState {
  switch (a.type) {
    case "auth/checked":
      return { ...s, authChecked: true, session: a.session };
    case "auth/signedIn":
      return { ...s, session: a.session, reauthRequired: false };
    case "auth/expired":
      return { ...s, reauthRequired: true };
    case "auth/signedOut":
      // ACC-06: nothing from the previous account stays in memory.
      return { ...initial, authChecked: true };
    case "filter/set":
      return { ...s, filter: { ...s.filter, ...a.patch }, areaDirty: a.patch.viewportBounds !== undefined ? false : s.areaDirty };
    case "filter/reset":
      return { ...s, filter: { ...DEFAULT_FILTER, sort: s.profile ? "recommended" : DEFAULT_FILTER.sort }, savedOnly: false, areaDirty: false };
    case "catalog/loading":
      return { ...s, catalog: { ...s.catalog, status: "loading", error: null } };
    case "catalog/loaded":
      return { ...s, catalog: { status: "ready", data: a.data, agencies: a.agencies, facets: a.facets, meta: a.meta, error: null } };
    case "catalog/failed":
      return { ...s, catalog: { ...s.catalog, status: "error", error: a.error } };
    case "select":
      return { ...s, selectedId: a.id, detail: a.id === s.detail.id ? s.detail : { id: a.id, status: "idle", opportunity: null, agency: null, error: null } };
    case "hover":
      return s.hoveredId === a.id ? s : { ...s, hoveredId: a.id };
    case "detail/loading":
      return a.id === s.selectedId ? { ...s, detail: { ...s.detail, id: a.id, status: "loading", error: null } } : s;
    case "detail/loaded":
      return a.id === s.selectedId ? { ...s, detail: { id: a.id, status: "ready", opportunity: a.opportunity, agency: a.agency, error: null } } : s;
    case "detail/failed":
      return a.id === s.selectedId ? { ...s, detail: { ...s.detail, status: "error", error: a.error } } : s;
    case "profile/set":
      // REC-07: a slower save of an older revision never replaces a newer confirmed profile.
      if (a.profile && s.profile && a.profile.id === s.profile.id && a.profile.revision < s.profile.revision) return s;
      return {
        ...s,
        profile: a.profile,
        filter: a.profile && !s.profile ? { ...s.filter, sort: "recommended" } : s.filter,
      };
    case "match/pending":
      return { ...s, matching: { ...s.matching, status: "pending", error: null } };
    case "match/loaded":
      // REC-07: a response for an older revision never overwrites a newer one.
      if (!s.profile || a.response.meta.profileRevision !== s.profile.revision) return s;
      return {
        ...s,
        matching: { status: "ready", forRevision: a.response.meta.profileRevision, byId: Object.fromEntries(a.response.data.map((x) => [x.opportunityId, x])), meta: a.response.meta, error: null },
      };
    case "match/failed":
      if (!s.profile || a.revision !== s.profile.revision) return s;
      return { ...s, matching: { ...s.matching, status: "error", error: a.error } };
    case "saved/set":
      return { ...s, saved: a.ids };
    case "savedOnly":
      return { ...s, savedOnly: a.value };
    case "listMode":
      return { ...s, listMode: a.value };
    case "area/dirty":
      return { ...s, areaDirty: a.value };
    case "onboarding":
      return { ...s, onboarding: a.value };
    case "sheet":
      return { ...s, sheet: a.value };
    case "toast":
      return { ...s, toast: a.text ? { id: Date.now(), text: a.text, tone: a.tone ?? "info" } : null };
  }
}

/* ---------- derived results ---------- */

const TIER_ORDER = { good_fit: 0, possible_fit: 1, needs_review: 2, not_a_fit: 3 } as const;

export function selectResults(s: ExplorerState) {
  const personalized = !!s.profile && s.matching.forRevision === s.profile.revision;
  let list = s.catalog.data;
  if (s.savedOnly) list = list.filter((o) => s.saved.includes(o.id));
  if (personalized && s.filter.fitTiers.length) list = list.filter((o) => {
    const a = s.matching.byId[o.id];
    return a?.tier ? s.filter.fitTiers.includes(a.tier) : false;
  });
  if (s.filter.sort === "recommended" && personalized) {
    list = [...list].sort((a, b) => {
      const x = s.matching.byId[a.id], y = s.matching.byId[b.id];
      const tx = x?.tier ? TIER_ORDER[x.tier] : 9, ty = y?.tier ? TIER_ORDER[y.tier] : 9;
      return tx - ty || (y?.rankingScore ?? 0) - (x?.rankingScore ?? 0) || a.title.localeCompare(b.title);
    });
  }
  const mapped = list.filter(hasMapPoint);
  const unmapped = list.filter((o) => !hasMapPoint(o));
  const shown = s.listMode === "mapped" ? mapped : s.listMode === "unmapped" ? unmapped : list;
  return { all: list, shown, mapped, unmapped, personalized };
}

/* ---------- provider ---------- */

interface Ctx {
  state: ExplorerState;
  services: ExplorerServices;
  dispatch: React.Dispatch<Action>;
  actions: {
    signIn(mode: "signin" | "signup", username: string, password: string): Promise<void>;
    signOut(): Promise<void>;
    setFilter(patch: Partial<CatalogFilter>): void;
    retryCatalog(): void;
    select(id: string | null): void;
    confirmProfile(fields: VendorProfileFields, originalDescription: string): Promise<VendorProfile>;
    retryMatching(): void;
    toggleSaved(id: string): Promise<void>;
  };
}

const ExplorerContext = createContext<Ctx | null>(null);

export function useExplorer() {
  const c = useContext(ExplorerContext);
  if (!c) throw new Error("useExplorer outside ExplorerProvider");
  return c;
}

export function ExplorerProvider({ services, children }: { services: ExplorerServices; children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [catalogNonce, bumpCatalog] = useReducer((n: number) => n + 1, 0);
  const [matchNonce, bumpMatch] = useReducer((n: number) => n + 1, 0);

  const handleError = useCallback((e: unknown): ServiceError | null => {
    if ((e as Error)?.name === "AbortError") return null;
    const err = isServiceError(e) ? e : new ServiceError({ code: "internal_error", message: "Something went wrong.", retryable: true });
    if (err.code === "unauthenticated" && stateRef.current.session) dispatch({ type: "auth/expired" });
    return err;
  }, []);

  useEffect(() => {
    services.auth.getSession().then((session) => dispatch({ type: "auth/checked", session }), () => dispatch({ type: "auth/checked", session: null }));
  }, [services]);

  // Restore account data after sign-in.
  const userId = state.session?.user.id;
  useEffect(() => {
    if (!userId) return;
    services.profile.getMine().then((p) => p && dispatch({ type: "profile/set", profile: p }), () => {});
    services.saved.list().then((ids) => dispatch({ type: "saved/set", ids }), () => {});
  }, [userId, services]);

  // Catalog follows the shared filter. Fit tiers apply after matching, client side.
  const { fitTiers: _ignored, ...catalogFilter } = state.filter;
  const catalogKey = JSON.stringify(catalogFilter);
  useEffect(() => {
    if (!userId || state.reauthRequired) return;
    const ac = new AbortController();
    dispatch({ type: "catalog/loading" });
    services.catalog
      .listOpportunities(stateRef.current.filter, ac.signal)
      .then((r) => dispatch({ type: "catalog/loaded", data: r.data, agencies: r.agencies, facets: r.facets, meta: r.meta }))
      .catch((e) => {
        const err = handleError(e);
        if (err) dispatch({ type: "catalog/failed", error: err });
      });
    return () => ac.abort();
  }, [userId, catalogKey, catalogNonce, services, handleError, state.reauthRequired]);

  // Matching follows the confirmed profile revision. Older responses are dropped in the reducer too.
  const revision = state.profile?.revision ?? null;
  useEffect(() => {
    const profile = stateRef.current.profile;
    if (!userId || !profile) return;
    const ac = new AbortController();
    dispatch({ type: "match/pending", revision: profile.revision });
    services.matching
      .match(profile, { ...DEFAULT_FILTER }, ac.signal)
      .then((response) => dispatch({ type: "match/loaded", response }))
      .catch((e) => {
        const err = handleError(e);
        if (err) dispatch({ type: "match/failed", revision: profile.revision, error: err });
      });
    return () => ac.abort();
  }, [userId, revision, matchNonce, services, handleError]);

  // Detail enrichment for the selected opportunity.
  useEffect(() => {
    const id = state.selectedId;
    if (!id || !userId) return;
    const ac = new AbortController();
    dispatch({ type: "detail/loading", id });
    services.catalog
      .getOpportunity(id, ac.signal)
      .then((r) => dispatch({ type: "detail/loaded", id, opportunity: r.opportunity, agency: r.agency }))
      .catch((e) => {
        const err = handleError(e);
        if (err) dispatch({ type: "detail/failed", id, error: err });
      });
    return () => ac.abort();
  }, [state.selectedId, userId, services, handleError]);

  const actions = useMemo<Ctx["actions"]>(() => ({
    async signIn(mode, username, password) {
      const session = mode === "signup" ? await services.auth.signUp(username, password) : await services.auth.signIn(username, password);
      dispatch({ type: "auth/signedIn", session });
      if (!stateRef.current.authChecked) dispatch({ type: "auth/checked", session });
    },
    async signOut() {
      await services.auth.signOut().catch(() => {});
      dispatch({ type: "auth/signedOut" });
    },
    setFilter(patch) {
      dispatch({ type: "filter/set", patch });
    },
    retryCatalog() {
      bumpCatalog();
    },
    select(id) {
      dispatch({ type: "select", id });
    },
    async confirmProfile(fields, originalDescription) {
      const prev = stateRef.current.profile;
      const profile = await services.profile.saveMine(fields, originalDescription, prev?.revision ?? null);
      dispatch({ type: "profile/set", profile });
      return profile;
    },
    retryMatching() {
      bumpMatch();
    },
    async toggleSaved(id) {
      const was = stateRef.current.saved.includes(id);
      const next = was ? stateRef.current.saved.filter((x) => x !== id) : [...stateRef.current.saved, id];
      dispatch({ type: "saved/set", ids: next });
      try {
        await (was ? services.saved.remove(id) : services.saved.save(id));
        dispatch({ type: "toast", text: was ? "Removed from saved" : services.integration.saving === "session_only" ? "Saved for this session" : "Saved to your account" });
      } catch (e) {
        dispatch({ type: "saved/set", ids: stateRef.current.saved.includes(id) === !was ? (was ? [...stateRef.current.saved, id] : stateRef.current.saved.filter((x) => x !== id)) : stateRef.current.saved });
        const err = handleError(e);
        if (err) dispatch({ type: "toast", text: `Couldn't update saved items. ${err.message}`, tone: "error" });
      }
    },
  }), [services, handleError]);

  const value = useMemo(() => ({ state, services, dispatch, actions }), [state, services, actions]);
  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}
