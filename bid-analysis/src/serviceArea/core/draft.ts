import { EMPTY_SELECTION, matchesProfileArea, selectionFromProfile, withCountyToggled } from "./serviceArea";
import type { ProfileServiceArea, ServiceAreaSelection } from "./serviceArea";

/**
 * Temporary exploration state. Nothing here is the confirmed profile: a draft
 * reaches the profile only through an explicit, successful save.
 */
export interface DraftState {
  /** Null while the explorer mirrors the confirmed area. */
  draft: ServiceAreaSelection | null;
  /** Profile revision the draft started from, to notice edits made elsewhere. */
  basedOnRevision: number | null;
  /** Counties restored when "All of Washington" is switched back off. */
  countiesBeforeStatewide: readonly string[];
  /** A saved area shown as the baseline until the store reports its revision. */
  pendingSaved: { revision: number; serviceArea: ProfileServiceArea } | null;
}

export const INITIAL_DRAFT_STATE: DraftState = { draft: null, basedOnRevision: null, countiesBeforeStatewide: [], pendingSaved: null };

/** Edits carry the baseline and revision visible when the user acted. */
interface EditContext {
  baseline: ProfileServiceArea;
  revision: number | null;
}

export type DraftAction =
  | ({ type: "toggle_county"; county: string } & EditContext)
  | ({ type: "set_statewide"; enabled: boolean } & EditContext)
  | ({ type: "clear" } & EditContext)
  | { type: "cancel" }
  | { type: "saved"; revision: number; serviceArea: ProfileServiceArea }
  | { type: "profile_revision_changed" };

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "toggle_county":
    case "set_statewide":
    case "clear": {
      const current = state.draft ?? selectionFromProfile(action.baseline);
      let next: ServiceAreaSelection;
      let remembered = state.countiesBeforeStatewide;
      if (action.type === "toggle_county") next = withCountyToggled(current, action.county);
      else if (action.type === "clear") next = EMPTY_SELECTION;
      else if (action.enabled) {
        if (current.kind === "statewide") return state;
        remembered = current.counties;
        next = { kind: "statewide" };
      } else {
        if (current.kind !== "statewide") return state;
        next = { kind: "counties", counties: remembered };
      }
      // Returning to the confirmed area ends the preview rather than leaving an empty diff.
      if (matchesProfileArea(next, action.baseline)) return { ...state, draft: null, basedOnRevision: null, countiesBeforeStatewide: remembered };
      return { ...state, draft: next, basedOnRevision: state.draft ? state.basedOnRevision : action.revision, countiesBeforeStatewide: remembered };
    }
    case "cancel":
      return { ...state, draft: null, basedOnRevision: null, countiesBeforeStatewide: [] };
    case "saved":
      return { draft: null, basedOnRevision: null, countiesBeforeStatewide: [], pendingSaved: { revision: action.revision, serviceArea: action.serviceArea } };
    case "profile_revision_changed":
      // The store now reports the saved revision or a newer one; it is authoritative again.
      return state.pendingSaved ? { ...state, pendingSaved: null } : state;
  }
}

/** The confirmed area to compare against, including a save the store hasn't reflected yet. */
export function effectiveBaseline(state: DraftState, profileArea: ProfileServiceArea): ProfileServiceArea {
  return state.pendingSaved?.serviceArea ?? profileArea;
}

export function effectiveDraft(state: DraftState, baseline: ProfileServiceArea): ServiceAreaSelection {
  return state.draft ?? selectionFromProfile(baseline);
}

export function isDirty(state: DraftState, baseline: ProfileServiceArea): boolean {
  return state.draft !== null && !matchesProfileArea(state.draft, baseline);
}

/** The profile changed elsewhere after this preview started. */
export function baselineMovedDuringDraft(state: DraftState, revision: number | null): boolean {
  return state.draft !== null && state.basedOnRevision != null && state.basedOnRevision !== revision;
}
