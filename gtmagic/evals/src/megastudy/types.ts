import { join } from "node:path";
import { EVALS_DIR } from "../shared/paths";

export const BENCH_DIR = join(EVALS_DIR, "benchmarks", "megastudy");
export const PRED_DIR = join(BENCH_DIR, "predictions");
/** Written by scripts/prep_megastudy.py (gitignored). */
export const DATA_FILE = join(EVALS_DIR, "data", "megastudy", "infotainment.json");
export const SPLITS = ["train", "val", "test"] as const;
export type Split = (typeof SPLITS)[number];
export const MIN_SEGMENT = 25;

export interface Card {
  id: string;
  /** Exactly what participants saw. */
  text: string;
  headline: string;
  source: string;
  content: string;
  lean: string;
  likes: string;
}

export interface Survey {
  intro: string;
  instruction: string;
  cards: Card[];
}

export interface RawPerson {
  pid: number;
  ratings: number[];
  flags: Record<string, string | null>;
  demographics: Record<string, string>;
  persona_summary: string;
}

export interface RawPublished {
  folder: string;
  model: string | null;
  temperature: number | null;
  /** pid → 18 ratings, card order. */
  ratings: Record<string, number[]>;
}

export interface RawData {
  survey: Survey;
  people: RawPerson[];
  published: Record<string, RawPublished>;
}

export type Interval = [number, number];

export interface PersonTruth {
  /** Task id shown to predictors, e.g. "test-p017". */
  id: string;
  pid: number;
  segments: string[];
  /** 1–7, in survey card order. */
  ratings: number[];
}

export interface SegmentTruth {
  id: string;
  description: string;
  n: number;
  means: number[];
  ci: Interval[];
}

/** Which option of a comparable set wins within one segment. */
export interface WinnerTruth {
  segment: string;
  set: string;
  options: string[];
  means: number[];
  winner: string;
  runnerUp: string;
  /** Winner minus runner-up, paired within people. */
  diff: number;
  ci: Interval;
  p: number;
  /** Benjamini–Hochberg adjusted p across all winner tests in the split; real = q < FDR. */
  q: number;
  real: boolean;
}

/** Difference between two complementary segments on one quantity (segment a minus segment b). */
export interface GapTruth {
  a: string;
  b: string;
  quantity: string;
  /** "key" quantities are pre-registered and scored; "exploratory" ones count only if they survive their own (larger) correction. */
  family: "key" | "exploratory";
  gap: number;
  ci: Interval;
  p: number;
  q: number;
  real: boolean;
}

export interface SplitTruth {
  /** "all" = full sample, reference only (never scored). */
  split: Split | "all";
  people: PersonTruth[];
  segments: SegmentTruth[];
  winners: WinnerTruth[];
  gaps: GapTruth[];
}

/** Per task id (segment id or person task id): card id → predicted rating (or an array in card order). */
export type Predictions = Record<string, Record<string, number> | number[]>;
