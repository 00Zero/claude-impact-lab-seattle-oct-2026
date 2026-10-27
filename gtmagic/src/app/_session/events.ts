/* The conversation between Claude Code (via the gtm-web `ui` command) and the page:
   one JSON event per line in gtm-workspace/.sessions/<id>/transcript.jsonl. */
import { z } from "zod";

export const STEP_IDS = ["describe", "guess", "answers", "research", "check", "save", "test", "results"] as const;
export const PLATE_IDS = ["baseline", "creatives", "economics", "ads", "constraints", "research", "evidence", "save", "crowd", "results"] as const;

export const StepIdSchema = z.enum(STEP_IDS);
export const PlateIdSchema = z.enum(PLATE_IDS);
export type StepId = z.infer<typeof StepIdSchema>;
export type PlateId = z.infer<typeof PlateIdSchema>;

const base = { id: z.string(), at: z.string() };

export const TranscriptEventSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("say"), text: z.string() }),
  z.object({ ...base, kind: z.literal("ask"), questions: z.array(z.string()).min(1), chips: z.array(z.string()).optional() }),
  z.object({
    ...base, kind: z.literal("answer"), askId: z.string(), text: z.string(),
    from: z.enum(["page", "terminal", "scripted"]), files: z.array(z.string()).optional(),
  }),
  z.object({ ...base, kind: z.literal("cancel"), askId: z.string() }),
  z.object({ ...base, kind: z.literal("status"), step: StepIdSchema, detail: z.string().optional() }),
  z.object({ ...base, kind: z.literal("plate"), plate: PlateIdSchema }),
  z.object({ ...base, kind: z.literal("link"), business: z.string() }),
  z.object({ ...base, kind: z.literal("done") }),
  z.object({ ...base, kind: z.literal("error"), message: z.string() }),
]);

export type TranscriptEvent = z.infer<typeof TranscriptEventSchema>;
export type AnswerFrom = Extract<TranscriptEvent, { kind: "answer" }>["from"];

/** Parse transcript.jsonl text; blank or malformed lines (a line can be mid-write) are skipped. */
export function parseTranscript(text: string): TranscriptEvent[] {
  const out: TranscriptEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = TranscriptEventSchema.safeParse(JSON.parse(line));
      if (r.success) out.push(r.data);
    } catch {
      // partial line; the next read will see it whole
    }
  }
  return out;
}
