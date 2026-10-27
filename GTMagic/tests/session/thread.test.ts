import { describe, expect, it } from "vitest";
import type { TranscriptEvent } from "@/app/_session/events";
import { buildThread, composerPlaceholder, isDisconnected } from "@/app/_session/thread";

let n = 0;
const at = (s: number) => new Date(Date.UTC(2026, 9, 25, 12, 0, s)).toISOString();
function ev(e: Record<string, string | string[]> & { kind: string }, s = n): TranscriptEvent {
  n += 1;
  return { id: `ev-${n}`, at: at(s), ...e } as TranscriptEvent;
}

describe("buildThread", () => {
  it("turns an answered question into an answered ask plus the owner's turn", () => {
    n = 0;
    const t = buildThread([ev({ kind: "ask", questions: ["Price?"] }), ev({ kind: "answer", askId: "ev-1", text: "$14.99", from: "page" })], null);
    expect(t.items[0]).toMatchObject({ kind: "ask", state: "answered" });
    expect(t.items[1]).toMatchObject({ kind: "owner", text: "$14.99", from: "page" });
    expect(t.openAsk).toBeNull();
  });

  it("marks a question answered in the terminal", () => {
    n = 0;
    const t = buildThread([ev({ kind: "ask", questions: ["Price?"] }), ev({ kind: "answer", askId: "ev-1", text: "$9", from: "terminal" })], null);
    expect(t.items[0]).toMatchObject({ state: "answered-in-terminal" });
  });

  it("keeps only the latest question open", () => {
    n = 0;
    const t = buildThread([ev({ kind: "ask", questions: ["A?"] }), ev({ kind: "cancel", askId: "ev-1" }), ev({ kind: "ask", questions: ["B?"], chips: ["Skip"] })], null);
    expect(t.items[0]).toMatchObject({ state: "cancelled" });
    expect(t.openAsk).toEqual({ askId: "ev-3", questions: ["B?"], chips: ["Skip"] });
  });

  it("switches to scripted mode when the demo owner answers", () => {
    n = 0;
    const t = buildThread([ev({ kind: "ask", questions: ["A?"] }), ev({ kind: "answer", askId: "ev-1", text: "x", from: "scripted" })], null);
    expect(t.mode).toBe("scripted");
  });

  it("flags a card as updated when the save file changed after it was shown", () => {
    n = 0;
    const events = [ev({ kind: "plate", plate: "economics" }, 1)];
    expect(buildThread(events, at(5)).items[0]).toMatchObject({ kind: "plate", updated: true });
    expect(buildThread(events, at(0)).items[0]).toMatchObject({ kind: "plate", updated: false });
  });

  it("advances the steps from status events and records the linked business", () => {
    n = 0;
    const t = buildThread([ev({ kind: "status", step: "answers" }), ev({ kind: "status", step: "research" }), ev({ kind: "link", business: "keepstrong" })], null);
    expect(t.steps.describe).toBe("done");
    expect(t.steps.answers).toBe("done");
    expect(t.steps.research).toBe("running");
    expect(t.steps.check).toBe("pending");
    expect(t.business).toBe("keepstrong");
  });

  it("shows errors as notices and finishes on done", () => {
    n = 0;
    const t = buildThread([ev({ kind: "error", message: "Search timed out" }), ev({ kind: "done" })], null);
    expect(t.items[0]).toMatchObject({ kind: "notice", tone: "error", text: "Search timed out" });
    expect(t.finished).toBe(true);
  });

  it("closes a question that was still open when the session ended", () => {
    n = 0;
    const t = buildThread([ev({ kind: "ask", questions: ["Price?"] }), ev({ kind: "done" })], null);
    expect(t.items[0]).toMatchObject({ kind: "ask", state: "cancelled" });
    expect(t.openAsk).toBeNull();
  });
});

describe("isDisconnected", () => {
  const now = new Date(Date.UTC(2026, 9, 25, 12, 1, 31));
  it("is true after 90 seconds of silence", () => {
    expect(isDisconnected(at(0), now, false)).toBe(true);
  });
  it("is false while a question is waiting for the owner", () => {
    expect(isDisconnected(at(0), now, true)).toBe(false);
  });
});

describe("composerPlaceholder", () => {
  it("says the session has ended instead of waiting for a question that won't come", () => {
    expect(composerPlaceholder({ mode: "live", finished: true }, false, false)).toBe("This session has ended");
    expect(composerPlaceholder({ mode: "scripted", finished: true }, false, false)).toBe("This session has ended");
  });
  it("says the session stopped when Claude Code is gone", () => {
    expect(composerPlaceholder({ mode: "live", finished: false }, false, true)).toBe("This session stopped");
  });
  it("waits only while the session is still running", () => {
    expect(composerPlaceholder({ mode: "live", finished: false }, true, false)).toBe("Your answer");
    expect(composerPlaceholder({ mode: "live", finished: false }, false, false)).toBe("Waiting for the next question");
    expect(composerPlaceholder({ mode: "scripted", finished: false }, false, false)).toBe("The demo owner answers on their own");
  });
});
