import { z } from "zod";

// Shared by the customer wizard and the server. The server validates every
// AI-generated question and every answer against these before storing them.

// The allowlisted question UI types (C5). Matches intake_questions.type.
export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
  "yes_no_unknown",
  "number_with_units",
  "photo_request",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// Suggested starting point from the spec: three initial questions.
export const INITIAL_QUESTION_COUNT = 3;
export const MAX_QUESTION_COUNT = 8;
export const MAX_OPTIONS = 8;
export const MAX_TEXT_ANSWER_LENGTH = 1000;

export const YES_NO_UNKNOWN_OPTIONS = ["Yes", "No", "Not sure"] as const;

export type IntakeQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  help: string | null;
  options: string[];
  unit: string | null;
  required: boolean;
  allowUnknown: boolean;
  /** Why the AI is asking, in plain language. */
  reason: string;
};

export type AnswerValue =
  | { kind: "text"; text: string }
  | { kind: "choice"; choice: string }
  | { kind: "choices"; choices: string[] }
  | { kind: "number"; value: number; unit: string | null }
  | { kind: "photo"; photoId: string }
  | { kind: "unknown" }
  | { kind: "skipped" };

const answerValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().trim().min(1).max(MAX_TEXT_ANSWER_LENGTH) }),
  z.object({ kind: z.literal("choice"), choice: z.string().min(1).max(200) }),
  z.object({ kind: z.literal("choices"), choices: z.array(z.string().min(1).max(200)).min(1).max(MAX_OPTIONS) }),
  z.object({ kind: z.literal("number"), value: z.number().finite(), unit: z.string().max(40).nullable() }),
  z.object({ kind: z.literal("photo"), photoId: z.uuid() }),
  z.object({ kind: z.literal("unknown") }),
  z.object({ kind: z.literal("skipped") }),
]);

// Checks an untrusted answer against its question. Returns the cleaned value
// or an error message for the customer.
export function validateAnswer(
  question: IntakeQuestion,
  input: unknown,
): { ok: true; value: AnswerValue } | { ok: false; error: string } {
  const parsed = answerValueSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That answer couldn’t be saved. Please check it and try again." };
  }
  const value = parsed.data;

  if (value.kind === "skipped") {
    return question.required
      ? { ok: false, error: "This one is needed. Answer it or choose “I don’t know”." }
      : { ok: true, value };
  }
  if (value.kind === "unknown") {
    return question.allowUnknown || question.type === "yes_no_unknown"
      ? { ok: true, value }
      : { ok: false, error: "Please choose an answer." };
  }

  const allowed: Record<QuestionType, AnswerValue["kind"]> = {
    short_text: "text",
    long_text: "text",
    single_select: "choice",
    multi_select: "choices",
    yes_no_unknown: "choice",
    number_with_units: "number",
    photo_request: "photo",
  };
  if (allowed[question.type] !== value.kind) {
    return { ok: false, error: "That answer doesn’t fit this question." };
  }

  const options = question.type === "yes_no_unknown" ? [...YES_NO_UNKNOWN_OPTIONS] : question.options;
  if (value.kind === "choice" && !options.includes(value.choice)) {
    return { ok: false, error: "Please pick one of the options." };
  }
  if (value.kind === "choices") {
    const choices = [...new Set(value.choices)];
    if (choices.some((choice) => !options.includes(choice))) {
      return { ok: false, error: "Please pick from the options." };
    }
    return { ok: true, value: { kind: "choices", choices } };
  }
  if (value.kind === "number") {
    return { ok: true, value: { kind: "number", value: value.value, unit: question.unit } };
  }
  if (question.type === "short_text" && value.kind === "text" && value.text.length > 200) {
    return { ok: false, error: "Keep this answer under 200 characters." };
  }
  return { ok: true, value };
}

// Plain-language rendering for the review screen and the contractor page.
export function formatAnswer(value: AnswerValue | null | undefined): string {
  if (!value) return "Not answered";
  switch (value.kind) {
    case "text":
      return value.text;
    case "choice":
      return value.choice;
    case "choices":
      return value.choices.join(", ");
    case "number":
      return value.unit ? `${value.value} ${value.unit}` : String(value.value);
    case "photo":
      return "Sent a photo";
    case "unknown":
      return "Doesn’t know";
    case "skipped":
      return "Skipped";
  }
}

// A photo the AI couldn't use, with what to do about it (C4).
export type PhotoIssue = {
  photoId: string;
  message: string;
  requestedView: string | null;
};

// What the customer's browser gets back from the initial analysis.
export type IntakeAnalysisView = {
  /** Short lines on what the AI read in the photos ("Carrier AC · model 24ACC636"), shown to the customer. */
  seen: string[];
  questions: IntakeQuestion[];
  photoIssues: PhotoIssue[];
  /** Set when something reported may be urgent; shown with safety guidance. */
  urgentConcern: string | null;
};
