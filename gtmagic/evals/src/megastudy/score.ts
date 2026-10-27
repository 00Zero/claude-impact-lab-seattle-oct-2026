import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { choiceSets, loadSurvey, quantities } from "./design";
import { argmax, dot, mean, meanCI, pearson, sd, spearman } from "./stats";
import { BENCH_DIR, PRED_DIR, type Interval, type Predictions, type Split, type SplitTruth } from "./types";

export const loadTruth = (split: Split): SplitTruth => JSON.parse(readFileSync(join(BENCH_DIR, `${split}.truth.json`), "utf8")) as SplitTruth;
export const listArms = (): string[] => (existsSync(PRED_DIR) ? readdirSync(PRED_DIR).filter((a) => !a.startsWith(".")).sort() : []);

const readJson = (path: string): Predictions => JSON.parse(readFileSync(path, "utf8")) as Predictions;
const MID = 4;

/** Card-ordered vector from {cardId: value} or an array; NaN for missing, values clamped to 1–7. */
export function toVector(v: Predictions[string] | undefined, cardIds: readonly string[]): number[] {
  const raw = Array.isArray(v) ? cardIds.map((_, i) => v[i]) : cardIds.map((id) => v?.[id]);
  return raw.map((x) => (typeof x === "number" && Number.isFinite(x) ? Math.min(7, Math.max(1, x)) : Number.NaN));
}

export interface ArmPredictions {
  /** segment id → predicted means (from a segment arm, or averaged twin predictions). */
  segments: Map<string, number[]> | null;
  segmentSource: "segment" | "twins" | null;
  /** person task id → predicted ratings. */
  twins: Map<string, number[]> | null;
  /** Missing tasks or cells, filled with the scale midpoint. */
  missing: number;
}

/** Segment arms write segments.json (split-independent) or segments-<split>.json; twin arms write <split>.json or <split>-<n>.json. */
export function loadArm(arm: string, truth: SplitTruth, cardIds: readonly string[]): ArmPredictions {
  const dir = join(PRED_DIR, arm);
  const files = existsSync(dir) ? readdirSync(dir) : [];
  let missing = 0;
  const fill = (v: number[]) => v.map((x) => (Number.isNaN(x) ? (missing++, MID) : x));

  let twins: Map<string, number[]> | null = null;
  const twinFiles = files.filter((f) => f === `${truth.split}.json` || new RegExp(`^${truth.split}-\\d+\\.json$`).test(f));
  if (twinFiles.length) {
    const raw: Predictions = Object.assign({}, ...twinFiles.map((f) => readJson(join(dir, f))));
    twins = new Map(truth.people.map((p) => [p.id, p.id in raw ? fill(toVector(raw[p.id], cardIds)) : (missing += cardIds.length, cardIds.map(() => MID))]));
  }

  const segFile = [`segments-${truth.split}.json`, "segments.json"].find((f) => files.includes(f));
  let segments: Map<string, number[]> | null = null;
  let segmentSource: ArmPredictions["segmentSource"] = null;
  if (segFile) {
    const raw = readJson(join(dir, segFile));
    segments = new Map(truth.segments.map((s) => [s.id, s.id in raw ? fill(toVector(raw[s.id], cardIds)) : (missing += cardIds.length, cardIds.map(() => MID))]));
    segmentSource = "segment";
  } else if (twins) {
    const t = twins;
    segments = new Map(truth.segments.map((s) => {
      const rows = truth.people.filter((p) => p.segments.includes(s.id)).map((p) => t.get(p.id)!);
      return [s.id, cardIds.map((_, c) => mean(rows.map((r) => r[c]!)))];
    }));
    segmentSource = "twins";
  }
  return { segments, segmentSource, twins, missing };
}

export interface Estimate {
  value: number;
  ci?: Interval;
  n: number;
}
const est = (values: number[], seed: number): Estimate => {
  const ok = values.filter((v) => Number.isFinite(v));
  return { value: mean(ok), ci: ok.length > 1 ? meanCI(ok, seed) : undefined, n: ok.length };
};

export interface SegmentScores {
  winnerAcc: Estimate;
  winnerChance: number;
  overallRho: number;
  cardR: Estimate;
  cardRho: Estimate;
  meanMAE: Estimate;
  gapSign: Estimate;
  gapR: number;
  gapScale: number;
  /** Real gaps: truth vs predicted, a minus b. */
  gapDetail: { label: string; truth: number; pred: number }[];
}

export function scoreSegments(truth: SplitTruth, pred: Map<string, number[]>): SegmentScores {
  const survey = loadSurvey();
  const sets = new Map(choiceSets(survey.cards).map((s) => [s.id, s]));
  const qs = new Map(quantities(survey.cards).map((q) => [q.id, q]));
  const p = (id: string) => pred.get(id)!;

  const real = truth.winners.filter((w) => w.real);
  const hits = real.map((w) => {
    const set = sets.get(w.set)!;
    const values = set.options.map((o) => dot(o.weights, p(w.segment)));
    return set.options[argmax(values)]!.id === w.winner ? 1 : 0;
  });

  const all = truth.segments.find((s) => s.id === "all")!;
  const perSeg = truth.segments.map((s) => ({
    r: pearson(p(s.id), s.means),
    rho: spearman(p(s.id), s.means),
    mae: mean(s.means.map((m, c) => Math.abs(p(s.id)[c]! - m))),
  }));

  const predGap = (g: { a: string; b: string; quantity: string }) => {
    const w = qs.get(g.quantity)!.weights;
    return dot(w, p(g.a)) - dot(w, p(g.b));
  };
  const realGaps = truth.gaps.filter((g) => g.real);
  const key = truth.gaps.filter((g) => g.family === "key");
  const gapPreds = realGaps.map(predGap);
  const absTruth = mean(realGaps.map((g) => Math.abs(g.gap)));
  return {
    winnerAcc: est(hits, 11),
    winnerChance: mean(real.map((w) => 1 / w.options.length)),
    overallRho: spearman(p("all"), all.means),
    cardR: est(perSeg.map((x) => x.r), 12),
    cardRho: est(perSeg.map((x) => x.rho), 13),
    meanMAE: est(perSeg.map((x) => x.mae), 14),
    gapSign: est(realGaps.map((g, i) => (Math.sign(gapPreds[i]!) === Math.sign(g.gap) ? 1 : 0)), 15),
    gapR: pearson(key.map(predGap), key.map((g) => g.gap)),
    gapScale: realGaps.length ? mean(realGaps.map((g, i) => gapPreds[i]! * Math.sign(g.gap))) / absTruth : Number.NaN,
    gapDetail: realGaps.map((g, i) => ({ label: `${g.a} − ${g.b}: ${g.quantity}`, truth: g.gap, pred: gapPreds[i]! })),
  };
}

export interface TwinScores {
  mae: Estimate;
  withinR: Estimate;
  pooledR: number;
  sdRatio: number;
}

export function scoreTwins(truth: SplitTruth, pred: Map<string, number[]>): TwinScores {
  const pairs = truth.people.map((p) => ({ t: p.ratings, y: pred.get(p.id)! }));
  const flatT = pairs.flatMap((x) => x.t), flatY = pairs.flatMap((x) => x.y);
  return {
    mae: est(pairs.map((x) => mean(x.t.map((t, c) => Math.abs(t - x.y[c]!)))), 21),
    // NaN (no variance on either side) is excluded; n shows how many people count.
    withinR: est(pairs.map((x) => pearson(x.y, x.t)), 22),
    pooledR: pearson(flatY, flatT),
    sdRatio: sd(flatY) / sd(flatT),
  };
}

const n2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "–");
const pct = (x: number) => (Number.isFinite(x) ? `${(100 * x).toFixed(0)}%` : "–");
const cell = (e: Estimate, f: (x: number) => string = n2) => (e.ci ? `${f(e.value)} <sub>[${f(e.ci[0])}, ${f(e.ci[1])}]</sub>` : f(e.value));
const signed = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);

export function report(split: Split, only?: string[]): string {
  const truth = loadTruth(split);
  const cardIds = loadSurvey().cards.map((c) => c.id);
  const arms = (only ?? listArms()).map((a) => ({ arm: a, p: loadArm(a, truth, cardIds) })).filter((x) => x.p.segments || x.p.twins);
  const real = truth.winners.filter((w) => w.real);
  const overall = new Map(truth.winners.filter((w) => w.segment === "all").map((w) => [w.set, w.winner]));
  const specific = real.filter((w) => w.segment !== "all" && overall.get(w.set) !== w.winner).length;
  const realGaps = truth.gaps.filter((g) => g.real);
  const lines = [
    `## ${split}: ${truth.people.length} people, ${truth.segments.length} segments with n ≥ 25, ${real.length} real winners (${specific} differ from the overall winner), ${realGaps.length} real segment gaps`,
    "",
    "### Segment level",
    "",
    "| Arm | Source | Winner acc. (real) | Overall ρ | Card r | Card ρ | Mean MAE | Gap sign (real) | Gap r (key) | Gap scale | Missing |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  const seg = new Map<string, SegmentScores>();
  for (const { arm, p } of arms) {
    if (!p.segments) continue;
    const s = scoreSegments(truth, p.segments);
    seg.set(arm, s);
    lines.push(`| ${arm} | ${p.segmentSource} | ${cell(s.winnerAcc, pct)} | ${n2(s.overallRho)} | ${cell(s.cardR)} | ${cell(s.cardRho)} | ${cell(s.meanMAE)} | ${cell(s.gapSign, pct)} | ${n2(s.gapR)} | ${n2(s.gapScale)} | ${p.missing} |`);
  }
  const first = [...seg.values()][0];
  lines.push("", `Chance winner accuracy: ${pct(first?.winnerChance ?? Number.NaN)}.`);
  if (realGaps.length && seg.size) {
    lines.push("", "### Real segment gaps: truth vs predicted (A minus B)", "", `| Arm | ${realGaps.map((g) => `${g.a} − ${g.b} ${g.quantity}`).join(" | ")} |`, `|---|${realGaps.map(() => "---").join("|")}|`);
    lines.push(`| *truth* | ${realGaps.map((g) => `${signed(g.gap)} <sub>[${signed(g.ci[0])}, ${signed(g.ci[1])}]</sub>`).join(" | ")} |`);
    for (const [arm, s] of seg) lines.push(`| ${arm} | ${s.gapDetail.map((d) => signed(d.pred)).join(" | ")} |`);
  }
  const twinArms = arms.filter((x) => x.p.twins);
  if (twinArms.length) {
    lines.push("", "### Individual level (twin task)", "", "| Arm | MAE | Within-person r | Pooled r | SD ratio (pred/true) |", "|---|---|---|---|---|");
    for (const { arm, p } of twinArms) {
      const t = scoreTwins(truth, p.twins!);
      lines.push(`| ${arm} | ${cell(t.mae)} | ${cell(t.withinR)} (n=${t.withinR.n}) | ${n2(t.pooledR)} | ${n2(t.sdRatio)} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
