// Guided "do I qualify?" survey: one question at a time, scored against a payer's
// prior authorization criteria. Answers stay in memory only.

import type { Insurer } from "../types";
import { UHC_GEPANT_SURVEYS } from "./uhcGepants";

export type Answers = Record<string, string | string[] | undefined>;

export type Alternative = {
  title: string;
  detail: string;
  /** If set, the UI offers to price this drug instead */
  rxcui?: string;
};

export type VerdictStatus = "met" | "confirm" | "not_met";

export type Verdict = {
  status: VerdictStatus;
  label: string;
  reason?: string;
  alternatives?: Alternative[];
};

export type Option = { value: string; label: string; hint?: string };

export type Question = {
  id: string;
  prompt: string;
  help?: string | ((a: Answers) => string);
  /** Multi-select; an option with value "none" clears the others */
  multi?: boolean;
  options: Option[];
  /** Ask only when this returns true. May only read answers to earlier questions. */
  when?: (a: Answers) => boolean;
  /** Score this answer. Undefined means it only gathers info (or a later question scores it). */
  score?: (a: Answers) => Verdict | undefined;
};

export type Survey = {
  drugName: string;
  policy: string;
  questions: Question[];
};

export function getSurvey(insurer: Insurer, rxcui: string): Survey | undefined {
  if (insurer === "uhc") return UHC_GEPANT_SURVEYS[rxcui];
  return undefined;
}

export function nextQuestionIndex(survey: Survey, answers: Answers, after: number): number {
  for (let i = after + 1; i < survey.questions.length; i++) {
    const q = survey.questions[i];
    if (!q.when || q.when(answers)) return i;
  }
  return -1;
}

/** Verdicts for every question that was asked and scored, in order. */
export function scoreAnswers(survey: Survey, answers: Answers, asked: string[]): Verdict[] {
  return survey.questions
    .filter((q) => asked.includes(q.id) && q.score)
    .map((q) => q.score!(answers))
    .filter((v): v is Verdict => Boolean(v));
}
