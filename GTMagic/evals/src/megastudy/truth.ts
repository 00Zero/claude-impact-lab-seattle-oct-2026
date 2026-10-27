import { mulberry32 } from "../shared/rng";
import { choiceSets, quantities } from "./design";
import { PAIRS, SEGMENTS } from "./segments";
import { argmax, bh, bootP, bootstrap, dot, interval, mean } from "./stats";
import { MIN_SEGMENT, type GapTruth, type Interval, type PersonTruth, type SegmentTruth, type Split, type SplitTruth, type Survey, type WinnerTruth } from "./types";

const REPS = 2000;
const excludesZero = ([lo, hi]: Interval) => lo > 0 || hi < 0;
/** Benjamini–Hochberg false discovery rate within each family of tests. */
export const FDR = 0.1;
/** Pre-registered gap quantities (the ones an ICP message decision hinges on); all other quantities are exploratory. */
export const KEY_QUANTITIES = ["level", "contrast:lean:", "contrast:content:"];
const isKey = (id: string) => KEY_QUANTITIES.some((k) => (k.endsWith(":") ? id.startsWith(k) : id === k));

function twoSampleBoot(a: readonly number[], b: readonly number[], seed: number): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let r = 0; r < REPS; r++) {
    let sa = 0, sb = 0;
    for (let i = 0; i < a.length; i++) sa += a[Math.floor(rng() * a.length)]!;
    for (let i = 0; i < b.length; i++) sb += b[Math.floor(rng() * b.length)]!;
    out.push(sa / a.length - sb / b.length);
  }
  return out.sort((x, y) => x - y);
}

/** Ground truth for one split: segment means, which variant wins in each segment, and real gaps between segments. */
export function computeTruth(split: Split | "all", people: PersonTruth[], survey: Survey): SplitTruth {
  const nCards = survey.cards.length;
  const members = new Map(SEGMENTS.map((s) => [s.id, people.filter((p) => p.segments.includes(s.id))]));
  const eligible = SEGMENTS.filter((s) => members.get(s.id)!.length >= MIN_SEGMENT);

  const segments: SegmentTruth[] = eligible.map((s, si) => {
    const rows = members.get(s.id)!.map((p) => p.ratings);
    const means = Array.from({ length: nCards }, (_, c) => mean(rows.map((r) => r[c]!)));
    const ci = means.map((_, c): Interval => interval(bootstrap(rows.length, (idx) => mean(idx.map((i) => rows[i]![c]!)), 1000 * si + c, REPS)));
    return { id: s.id, description: s.description, n: rows.length, means, ci };
  });

  const sets = choiceSets(survey.cards);
  const winnerDrafts: Omit<WinnerTruth, "q" | "real">[] = [];
  eligible.forEach((s, si) => {
    const rows = members.get(s.id)!.map((p) => p.ratings);
    sets.forEach((set, ti) => {
      const values = rows.map((r) => set.options.map((o) => dot(o.weights, r)));
      const means = set.options.map((_, o) => mean(values.map((v) => v[o]!)));
      const w = argmax(means);
      const r = argmax(means.map((m, i) => (i === w ? -Infinity : m)));
      const d = values.map((v) => v[w]! - v[r]!);
      const boot = bootstrap(d.length, (idx) => mean(idx.map((i) => d[i]!)), 50_000 + 100 * si + ti, REPS);
      winnerDrafts.push({
        segment: s.id,
        set: set.id,
        options: set.options.map((o) => o.id),
        means,
        winner: set.options[w]!.id,
        runnerUp: set.options[r]!.id,
        diff: means[w]! - means[r]!,
        ci: interval(boot),
        p: bootP(boot, means[w]! - means[r]!),
      });
    });
  });
  const wq = bh(winnerDrafts.map((x) => x.p));
  const winners = winnerDrafts.map((x, i) => ({ ...x, q: wq[i]!, real: wq[i]! < FDR && excludesZero(x.ci) }));

  const qs = quantities(survey.cards);
  const gapDrafts: Omit<GapTruth, "q" | "real">[] = [];
  PAIRS.forEach(([a, b], pi) => {
    const ra = members.get(a)!, rb = members.get(b)!;
    if (ra.length < MIN_SEGMENT || rb.length < MIN_SEGMENT) return;
    qs.forEach((q, qi) => {
      const va = ra.map((p) => dot(q.weights, p.ratings)), vb = rb.map((p) => dot(q.weights, p.ratings));
      const boot = twoSampleBoot(va, vb, 90_000 + 1000 * pi + qi);
      const gap = mean(va) - mean(vb);
      gapDrafts.push({ a, b, quantity: q.id, family: isKey(q.id) ? "key" : "exploratory", gap, ci: interval(boot), p: bootP(boot, gap) });
    });
  });
  const gaps: GapTruth[] = [];
  for (const family of ["key", "exploratory"] as const) {
    const fam = gapDrafts.filter((g) => g.family === family);
    const gq = bh(fam.map((x) => x.p));
    fam.forEach((x, i) => gaps.push({ ...x, q: gq[i]!, real: gq[i]! < FDR && excludesZero(x.ci) }));
  }

  return { split, people, segments, winners, gaps };
}
