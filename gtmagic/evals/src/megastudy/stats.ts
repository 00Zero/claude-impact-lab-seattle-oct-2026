import { mulberry32 } from "../shared/rng";
import type { Interval } from "./types";

export const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
export const dot = (w: readonly number[], y: readonly number[]): number => w.reduce((s, wi, i) => s + wi * y[i]!, 0);

export function sd(xs: readonly number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Pearson r; NaN when either side has no variance. */
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : Number.NaN;
}

/** Average ranks (1-based), ties share the mean rank. */
export function ranks(xs: readonly number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
    for (let k = i; k <= j; k++) out[order[k]![1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return out;
}

export const spearman = (xs: readonly number[], ys: readonly number[]): number => pearson(ranks(xs), ranks(ys));

/** Index of the largest value (first one on ties). */
export const argmax = (xs: readonly number[]): number => xs.reduce((best, x, i) => (x > xs[best]! ? i : best), 0);

const percentile = (sorted: readonly number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;

/** Bootstrap distribution of any statistic computed from resampled indexes of `n` units. */
export function bootstrap(n: number, stat: (idx: number[]) => number, seed: number, reps = 2000): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  const idx = new Array<number>(n);
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i < n; i++) idx[i] = Math.floor(rng() * n);
    const v = stat(idx);
    if (Number.isFinite(v)) out.push(v);
  }
  return out.sort((a, b) => a - b);
}

export const interval = (sorted: readonly number[]): Interval => [percentile(sorted, 0.025), percentile(sorted, 0.975)];

/** Complementary error function (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return x >= 0 ? y : 2 - y;
}

/** Two-sided p-value for "the statistic is 0": normal approximation with the bootstrap standard error (resolves small p better than counting). */
export function bootP(sorted: readonly number[], estimate: number): number {
  const se = sd(sorted);
  if (!(se > 0)) return estimate === 0 ? 1 : 0;
  return Math.min(1, erfc(Math.abs(estimate / se) / Math.SQRT2));
}

/** 95% bootstrap CI of the mean. */
export function meanCI(values: readonly number[], seed: number): Interval {
  return interval(bootstrap(values.length, (idx) => mean(idx.map((i) => values[i]!)), seed));
}

/** Benjamini–Hochberg adjusted p-values (same order as input). */
export function bh(ps: readonly number[]): number[] {
  const order = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const q = new Array<number>(ps.length);
  let min = 1;
  for (let k = order.length - 1; k >= 0; k--) {
    const [p, i] = order[k]!;
    min = Math.min(min, (p * ps.length) / (k + 1));
    q[i] = min;
  }
  return q;
}
