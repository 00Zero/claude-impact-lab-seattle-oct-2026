import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_DRAFT_STATE, baselineMovedDuringDraft, draftReducer, effectiveBaseline, effectiveDraft, isDirty } from "@/serviceArea/core/draft";
import type { DraftAction, DraftState } from "@/serviceArea/core/draft";
import type { ProfileServiceArea } from "@/serviceArea/core/serviceArea";

const baseline: ProfileServiceArea = { kind: "counties", counties: ["King", "Pierce"] };
const ctx = { baseline, revision: 3 };
const run = (actions: DraftAction[], start: DraftState = INITIAL_DRAFT_STATE) => actions.reduce(draftReducer, start);

describe("county selection", () => {
  test("starts by mirroring the confirmed area, with nothing to apply", () => {
    assert.deepEqual(effectiveDraft(INITIAL_DRAFT_STATE, baseline), baseline);
    assert.equal(isDirty(INITIAL_DRAFT_STATE, baseline), false);
  });

  test("adds and removes counties in canonical order", () => {
    const s = run([
      { type: "toggle_county", county: "Thurston", ...ctx },
      { type: "toggle_county", county: "Adams", ...ctx },
      { type: "toggle_county", county: "King", ...ctx },
    ]);
    assert.deepEqual(effectiveDraft(s, baseline), { kind: "counties", counties: ["Adams", "Pierce", "Thurston"] });
    assert.equal(isDirty(s, baseline), true);
    assert.equal(s.basedOnRevision, 3);
  });

  test("returning to the confirmed area ends the preview", () => {
    const s = run([{ type: "toggle_county", county: "Thurston", ...ctx }, { type: "toggle_county", county: "Thurston", ...ctx }]);
    assert.equal(s.draft, null);
    assert.equal(isDirty(s, baseline), false);
  });

  test("all of Washington restores the earlier counties when switched off", () => {
    const on = run([{ type: "toggle_county", county: "Lewis", ...ctx }, { type: "set_statewide", enabled: true, ...ctx }]);
    assert.deepEqual(effectiveDraft(on, baseline), { kind: "statewide" });
    const off = draftReducer(on, { type: "set_statewide", enabled: false, ...ctx });
    assert.deepEqual(effectiveDraft(off, baseline), { kind: "counties", counties: ["King", "Lewis", "Pierce"] });
  });

  test("removing one county from all of Washington keeps the other 38", () => {
    const s = run([{ type: "set_statewide", enabled: true, ...ctx }, { type: "toggle_county", county: "Yakima", ...ctx }]);
    const d = effectiveDraft(s, baseline);
    assert.equal(d.kind === "counties" && d.counties.length, 38);
    assert.ok(d.kind === "counties" && !d.counties.includes("Yakima"));
  });
});

describe("cancel", () => {
  test("restores the exact confirmed area after any sequence of edits", () => {
    const s = run([
      { type: "toggle_county", county: "Thurston", ...ctx },
      { type: "set_statewide", enabled: true, ...ctx },
      { type: "toggle_county", county: "King", ...ctx },
      { type: "cancel" },
    ]);
    assert.equal(s.draft, null);
    assert.deepEqual(effectiveDraft(s, baseline), baseline);
    assert.deepEqual(effectiveBaseline(s, baseline), baseline);
    assert.deepEqual(s.countiesBeforeStatewide, []);
  });
});

describe("apply", () => {
  test("holds the saved area as the baseline until the store reports the revision", () => {
    const saved: ProfileServiceArea = { kind: "counties", counties: ["King", "Pierce", "Thurston"] };
    const s = run([{ type: "toggle_county", county: "Thurston", ...ctx }, { type: "saved", revision: 4, serviceArea: saved }]);
    assert.equal(s.draft, null);
    assert.deepEqual(effectiveBaseline(s, baseline), saved);
    assert.equal(isDirty(s, effectiveBaseline(s, baseline)), false);
    assert.equal(draftReducer(s, { type: "profile_revision_changed" }).pendingSaved, null);
  });

  test("notices a profile edited elsewhere during the preview", () => {
    const s = run([{ type: "toggle_county", county: "Thurston", ...ctx }]);
    assert.equal(baselineMovedDuringDraft(s, 3), false);
    assert.equal(baselineMovedDuringDraft(s, 5), true);
  });
});
