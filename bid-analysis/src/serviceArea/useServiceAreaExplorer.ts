"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { indexCurrentAssessments } from "./core/assessments";
import type { FitDisplay } from "./core/assessments";
import { compareServiceAreas } from "./core/comparison";
import type { ServiceAreaComparison } from "./core/comparison";
import { normalizeCountyName } from "./core/counties";
import { INITIAL_DRAFT_STATE, baselineMovedDuringDraft, draftReducer, effectiveBaseline, effectiveDraft, isDirty } from "./core/draft";
import { buildMapHighlight } from "./core/highlight";
import type { ServiceAreaMapHighlight } from "./core/highlight";
import { isEmptySelection } from "./core/serviceArea";
import type { ExplorerProfile, ProfileServiceArea, ServiceAreaSelection } from "./core/serviceArea";
import type { ExplorerAssessment, ExplorerOpportunity } from "./core/types";

/** The comparison catalog. `error` is a failed load, never shown as an empty result. */
export type ExplorerCatalog<O> =
  | { status: "loading" }
  | { status: "error"; message: string | null }
  | { status: "ready"; opportunities: readonly O[] };

export type ApplyState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "applied"; revision: number }
  | { phase: "save_failed"; error: { code: string; message: string } };

export interface UseServiceAreaExplorerOptions<O extends ExplorerOpportunity> {
  /** Active confirmed profile, or null before onboarding. */
  profile: ExplorerProfile | null;
  catalog: ExplorerCatalog<O>;
  /** Current assessments; only those for the active revision are shown. */
  assessments: readonly ExplorerAssessment[];
  /** Confirms the area as a new profile revision. Must reject on failure or revision conflict. */
  save(selection: ServiceAreaSelection): Promise<{ revision: number; serviceArea: ProfileServiceArea }>;
}

export interface ServiceAreaExplorerState<O extends ExplorerOpportunity> {
  profile: ExplorerProfile | null;
  catalog: ExplorerCatalog<O>;
  baseline: ProfileServiceArea;
  draft: ServiceAreaSelection;
  isExploring: boolean;
  profileChangedDuringDraft: boolean;
  comparison: ServiceAreaComparison<O> | null;
  fit: ReadonlyMap<string, FitDisplay>;
  applyState: ApplyState;
  onToggleCounty(county: string): void;
  onSetStatewide(enabled: boolean): void;
  onClear(): void;
  onApply(): void;
}

const IDLE: ApplyState = { phase: "idle" };
const UNSET: ProfileServiceArea = { kind: "unset" };
const clearTransient = (s: ApplyState): ApplyState => (s.phase === "applied" || s.phase === "save_failed" ? IDLE : s);

/**
 * Local preview state for the Service Area Explorer. It owns no profile or
 * fit data: the profile arrives as a prop, saving goes through `save`, and fit
 * recalculation stays with whoever owns matching (the explorer store).
 */
export function useServiceAreaExplorer<O extends ExplorerOpportunity>(options: UseServiceAreaExplorerOptions<O>) {
  const { profile, catalog, assessments, save } = options;
  const [state, dispatch] = useReducer(draftReducer, INITIAL_DRAFT_STATE);
  const [applyState, setApplyState] = useState<ApplyState>(IDLE);

  // Highest profile revision seen, so a late save response can't win over a newer one.
  const latestRevision = useRef<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const profileRevision = profile?.revision ?? null;
  useEffect(() => {
    if (profileRevision != null && (latestRevision.current == null || profileRevision > latestRevision.current)) latestRevision.current = profileRevision;
    dispatch({ type: "profile_revision_changed" });
  }, [profileRevision]);

  const activeRevision = state.pendingSaved?.revision ?? profileRevision;
  const baseline = effectiveBaseline(state, profile?.serviceArea ?? UNSET);
  const draft = effectiveDraft(state, baseline);
  const isExploring = isDirty(state, baseline);
  const saving = applyState.phase === "saving";
  const opportunities = catalog.status === "ready" ? catalog.opportunities : null;

  const comparison = useMemo(() => (opportunities ? compareServiceAreas({ opportunities, baseline, draft }) : null), [opportunities, baseline, draft]);
  const fit = useMemo(
    () => (profile ? indexCurrentAssessments(assessments, profile.revision, opportunities ?? []) : new Map<string, FitDisplay>()),
    [assessments, profile, opportunities],
  );
  const highlight: ServiceAreaMapHighlight = useMemo(() => buildMapHighlight({ baseline, draft, exploring: isExploring, comparison }), [baseline, draft, isExploring, comparison]);

  const edit = useCallback(
    (action: { type: "toggle_county"; county: string } | { type: "set_statewide"; enabled: boolean } | { type: "clear" }) => {
      if (saving || !profile) return;
      dispatch({ ...action, baseline, revision: activeRevision });
      setApplyState(clearTransient);
    },
    [saving, profile, baseline, activeRevision],
  );

  const toggleCounty = useCallback(
    (name: string) => {
      const county = normalizeCountyName(name);
      if (county) edit({ type: "toggle_county", county });
    },
    [edit],
  );

  const cancel = useCallback(() => {
    if (saving) return;
    dispatch({ type: "cancel" });
    setApplyState(IDLE);
  }, [saving]);

  const apply = useCallback(async () => {
    if (!profile || !isExploring || isEmptySelection(draft) || saving) return;
    setApplyState({ phase: "saving" });
    try {
      const saved = await save(draft);
      if (!mounted.current) return;
      if (latestRevision.current != null && saved.revision < latestRevision.current) {
        // A newer revision is already active; this response must not be adopted.
        setApplyState(IDLE);
        return;
      }
      dispatch({ type: "saved", revision: saved.revision, serviceArea: saved.serviceArea });
      setApplyState({ phase: "applied", revision: saved.revision });
    } catch (e) {
      if (!mounted.current) return;
      const err = e as { code?: unknown; message?: unknown };
      setApplyState({
        phase: "save_failed",
        error: { code: typeof err?.code === "string" ? err.code : "internal_error", message: typeof err?.message === "string" ? err.message : "The profile couldn't be saved." },
      });
    }
  }, [profile, isExploring, draft, saving, save]);

  const state$: ServiceAreaExplorerState<O> = {
    profile,
    catalog,
    baseline,
    draft,
    isExploring,
    profileChangedDuringDraft: baselineMovedDuringDraft(state, activeRevision),
    comparison,
    fit,
    applyState,
    onToggleCounty: toggleCounty,
    onSetStatewide: (enabled) => edit({ type: "set_statewide", enabled }),
    onClear: () => edit({ type: "clear" }),
    onApply: () => void apply(),
  };

  return { state: state$, highlight, toggleCounty, cancel, isExploring, saving };
}
