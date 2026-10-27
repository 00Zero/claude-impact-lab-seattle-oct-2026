"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Agency, CatalogMeta, Opportunity } from "@/lib/contracts";
import { isServiceError, ServiceError } from "@/lib/services/types";
import { useExplorer } from "@/explorer/store";
import type { ServiceAreaSelection } from "./core/serviceArea";
import {
  activeNonGeographicFilters,
  currentAssessments,
  explorerProfileOf,
  fitRefreshFor,
  geographyFreeFilter,
  isGeographyFree,
  saveServiceAreaSelection,
} from "./integration";
import { useServiceAreaExplorer } from "./useServiceAreaExplorer";
import type { ExplorerCatalog } from "./useServiceAreaExplorer";

interface OwnCatalog {
  status: "idle" | "loading" | "ready" | "error";
  data: Opportunity[];
  agencies: Agency[];
  meta: CatalogMeta | null;
  error: string | null;
}

const IDLE_CATALOG: OwnCatalog = { status: "idle", data: [], agencies: [], meta: null, error: null };

/**
 * The Service Area Explorer wired to the explorer store: profile and fit come
 * from the store, saving goes through `actions.confirmProfile` (expectedRevision
 * and all), and the store's own matching effect recalculates fit once for the
 * new revision. Nothing here adds a store or an API client.
 */
export function useServiceAreaInApp(open: boolean) {
  const { state, services, actions, dispatch } = useExplorer();

  // Comparison catalog: same non-geographic filters as the map, no geography.
  const reuse = isGeographyFree(state.filter);
  const filter = useMemo(() => geographyFreeFilter(state.filter), [state.filter]);
  const { sort: _sort, ...filterForKey } = filter;
  const filterKey = JSON.stringify(filterForKey);
  const mainVersion = state.catalog.meta?.catalogVersion ?? null;
  const [own, setOwn] = useState<OwnCatalog>(IDLE_CATALOG);
  const [nonce, setNonce] = useState(0);
  const signedIn = !!state.session && !state.reauthRequired;

  useEffect(() => {
    if (!open || reuse || !signedIn) return;
    const ac = new AbortController();
    setOwn((c) => ({ ...c, status: "loading", error: null }));
    services.catalog
      .listOpportunities(filter, ac.signal)
      .then((r) => setOwn({ status: "ready", data: r.data, agencies: r.agencies, meta: r.meta, error: null }))
      .catch((e) => {
        if ((e as Error)?.name === "AbortError") return;
        if (isServiceError(e) && e.code === "unauthenticated") dispatch({ type: "auth/expired" });
        setOwn((c) => ({ ...c, status: "error", error: isServiceError(e) ? e.message : "The opportunity service didn't respond." }));
      });
    return () => ac.abort();
    // filterKey stands in for filter; mainVersion refetches when the map's catalog changes.
  }, [open, reuse, signedIn, filterKey, mainVersion, nonce, services, dispatch]);

  const source: OwnCatalog = reuse
    ? { status: state.catalog.status, data: state.catalog.data, agencies: state.catalog.agencies, meta: state.catalog.meta, error: state.catalog.error?.message ?? null }
    : own;
  const catalog = useMemo<ExplorerCatalog<Opportunity>>(
    () => (source.status === "ready" ? { status: "ready", opportunities: source.data } : source.status === "error" ? { status: "error", message: source.error } : { status: "loading" }),
    [source.status, source.data, source.error],
  );
  const agencies = useMemo(() => new Map(source.agencies.map((a) => [a.id, a])), [source.agencies]);
  const versionMismatch = !reuse && !!own.meta && !!mainVersion && own.meta.catalogVersion !== mainVersion;

  const profile = useMemo(() => explorerProfileOf(state.profile), [state.profile]);
  const assessments = useMemo(() => currentAssessments(state.matching, state.profile), [state.matching, state.profile]);

  const save = useCallback(
    async (selection: ServiceAreaSelection) => {
      const current = state.profile;
      if (!current) throw new ServiceError({ code: "invalid_input", message: "Confirm a business profile first.", retryable: false });
      try {
        return await saveServiceAreaSelection(actions.confirmProfile, current, selection);
      } catch (e) {
        if (isServiceError(e) && e.code === "unauthenticated") dispatch({ type: "auth/expired" });
        throw e;
      }
    },
    [state.profile, actions, dispatch],
  );

  const explorer = useServiceAreaExplorer({ profile, catalog, assessments, save });
  const { applyState } = explorer.state;
  const fitRefresh = applyState.phase === "applied" ? fitRefreshFor(state.matching, state.profile, applyState.revision) : null;

  const opportunitiesById = useMemo(() => new Map(source.data.map((o) => [o.id, o])), [source.data]);

  return {
    ...explorer,
    agencies,
    opportunitiesById,
    versionMismatch,
    fitRefresh,
    keptFilters: activeNonGeographicFilters(state.filter),
    geographyFiltersSetAside: !reuse,
    integration: services.integration,
    retryCatalog: reuse ? actions.retryCatalog : () => setNonce((n) => n + 1),
    retryMatching: actions.retryMatching,
  };
}

export type ServiceAreaInApp = ReturnType<typeof useServiceAreaInApp>;
