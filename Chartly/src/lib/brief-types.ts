import { z } from "zod";

// The service brief the AI writes after the customer submits. The AI returns
// exactly this JSON; parse it with serviceBriefSchema before saving or
// showing it. Photo URLs and the customer's answers are not part of the AI
// output: the page passes them in alongside the brief.

export const confidenceSchema = z.enum(["high", "med", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const serviceBriefSchema = z.object({
  /** Likely cause, a few words: "Failed run capacitor". */
  verdict: z.string().min(1),
  confidence: confidenceSchema,
  /** One sentence tying the verdict to the evidence. */
  why: z.string().min(1),
  /** Parts and tools to load in the truck, most important first. */
  bring: z.array(z.object({ item: z.string().min(1), note: z.string().optional() })),
  /** What the tech should check before swapping parts. */
  confirmOnSite: z.string().min(1),
  alsoPossible: z.array(z.object({ cause: z.string().min(1), confidence: confidenceSchema })),
  equipment: z.object({
    /** Plain name: "Carrier outdoor AC unit". */
    label: z.string().min(1),
    model: z.string().nullable(),
    serial: z.string().nullable(),
  }),
  /**
   * What the AI saw in each photo. x/y are approximate pin positions as a
   * percent of the photo's width/height, or null when the AI can't place it
   * (the note still shows, without a pin).
   */
  photoNotes: z.array(
    z.object({
      photoId: z.string().min(1),
      x: z.number().min(0).max(100).nullable(),
      y: z.number().min(0).max(100).nullable(),
      /** What's in the photo: "Fan on top of the unit". */
      text: z.string().min(1),
      /** How it supports the verdict: "Drew says it isn't spinning". */
      supports: z.string().min(1),
    }),
  ),
  /** Evidence a photo can't show, quoted from the customer's answers. */
  answerNotes: z.array(
    z.object({
      /** Question id, or "note" for the free-text "anything else". */
      questionId: z.string().min(1),
      quote: z.string().min(1),
      supports: z.string().min(1),
    }),
  ),
  /** What the AI couldn't check, so the tech doesn't assume it. */
  notSeen: z.string(),
  /** Rough price range in dollars, if the contractor uses one. */
  estimate: z.object({ low: z.number(), high: z.number() }).nullable(),
});
export type ServiceBrief = z.infer<typeof serviceBriefSchema>;

/** A customer photo as the brief displays it. */
export type BriefPhoto = { id: string; title: string; url: string; width?: number; height?: number };

/** One saved answer, labeled for the brief. */
export type BriefAnswer = { questionId: string; short: string; answer: string };
