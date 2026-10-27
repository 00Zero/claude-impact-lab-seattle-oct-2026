import { describe, expect, it } from "vitest";
import { parseTranscript, TranscriptEventSchema } from "@/app/_session/events";

describe("TranscriptEventSchema", () => {
  it("accepts each event kind the bridge writes", () => {
    const at = "2026-10-25T12:00:00.000Z";
    const events = [
      { id: "ev-1", at, kind: "say", text: "Hi" },
      { id: "ev-2", at, kind: "ask", questions: ["What do you sell?"], chips: ["Skip"] },
      { id: "ev-3", at, kind: "answer", askId: "ev-2", text: "Apps", from: "page", files: ["uploads/a.csv"] },
      { id: "ev-4", at, kind: "cancel", askId: "ev-2" },
      { id: "ev-5", at, kind: "status", step: "research", detail: "12 pieces of evidence" },
      { id: "ev-6", at, kind: "plate", plate: "economics" },
      { id: "ev-7", at, kind: "link", business: "keepstrong" },
      { id: "ev-8", at, kind: "done" },
      { id: "ev-9", at, kind: "error", message: "oops" },
    ];
    for (const ev of events) expect(TranscriptEventSchema.safeParse(ev).success, ev.kind).toBe(true);
  });

  it("rejects an unknown plate or step", () => {
    expect(TranscriptEventSchema.safeParse({ id: "ev-1", at: "x", kind: "plate", plate: "nope" }).success).toBe(false);
    expect(TranscriptEventSchema.safeParse({ id: "ev-1", at: "x", kind: "status", step: "nope" }).success).toBe(false);
  });
});

describe("parseTranscript", () => {
  it("skips blank and malformed lines (a line can be mid-write)", () => {
    const text = '{"id":"ev-1","at":"x","kind":"say","text":"Hi"}\n\n{"id":"ev-2","at":"x","kind":"sa';
    expect(parseTranscript(text).map((e) => e.id)).toEqual(["ev-1"]);
  });
});
