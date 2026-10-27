import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH_DIR, type Card, type Survey } from "./types";

/**
 * The 18 cards are a fixed fractional design over five attributes. Every derived quantity (attribute-level
 * marginal means, contrasts, the overall share level) is a fixed linear combination of the 18 card ratings,
 * so it can be applied identically to one person's ratings, to segment means and to predicted means.
 */
export const ATTRS = ["headline", "source", "content", "lean", "likes"] as const;
export type Attr = (typeof ATTRS)[number];
export const ATTR_LABEL: Record<Attr, string> = {
  headline: "Headline",
  source: "Source",
  content: "Content type",
  lean: "Political lean",
  likes: "Number of likes",
};

export interface Option {
  id: string;
  label: string;
  weights: number[];
}
/** A set of message variants a marketer would choose between; the option with the highest value wins. */
export interface ChoiceSet {
  id: string;
  label: string;
  options: Option[];
}
export interface Quantity {
  id: string;
  label: string;
  weights: number[];
}

export const loadSurvey = (): Survey => JSON.parse(readFileSync(join(BENCH_DIR, "survey.json"), "utf8")) as Survey;

export function levels(cards: readonly Card[], a: Attr): string[] {
  const seen = [...new Set(cards.map((c) => c[a]))];
  return a === "likes" ? seen.sort((x, y) => Number(x) - Number(y)) : a === "headline" ? seen : seen.sort();
}

function invert(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    if (Math.abs(a[p]![c]!) < 1e-12) throw new Error("card design is not full rank");
    [a[c], a[p]] = [a[p]!, a[c]!];
    const piv = a[c]![c]!;
    a[c] = a[c]!.map((v) => v / piv);
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r]![c]!;
      if (f) a[r] = a[r]!.map((v, j) => v - f * a[c]![j]!);
    }
  }
  return a.map((row) => row.slice(n));
}

/** weights[a][level]: regression-adjusted marginal mean of that level (OLS on attribute dummies, other attributes at their design average). */
export function marginalWeights(cards: readonly Card[]): Record<Attr, Record<string, number[]>> {
  const cols: { attr: Attr; level: string }[] = ATTRS.flatMap((a) => levels(cards, a).slice(1).map((level) => ({ attr: a, level })));
  const row = (c: Card, override?: { attr: Attr; level: string }) => [
    1,
    ...cols.map((col) => ((override?.attr === col.attr ? override.level : c[col.attr]) === col.level ? 1 : 0)),
  ];
  const x = cards.map((c) => row(c));
  const k = x[0]!.length;
  const xtx = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => x.reduce((s, r) => s + r[i]! * r[j]!, 0)));
  const inv = invert(xtx);
  // hat[j][card] = ((X'X)^-1 X')[j][card]
  const hat = inv.map((ri) => cards.map((_, c) => ri.reduce((s, v, j) => s + v * x[c]![j]!, 0)));
  const out = {} as Record<Attr, Record<string, number[]>>;
  for (const a of ATTRS) {
    out[a] = {};
    for (const level of levels(cards, a)) {
      const avgRow = Array.from({ length: k }, (_, j) => cards.reduce((s, c) => s + row(c, { attr: a, level })[j]!, 0) / cards.length);
      out[a][level] = cards.map((_, c) => avgRow.reduce((s, v, j) => s + v * hat[j]![c]!, 0));
    }
  }
  return out;
}

const unit = (n: number, i: number) => Array.from({ length: n }, (_, j) => (j === i ? 1 : 0));
const headlineTag = (cards: readonly Card[], h: string) => `h${levels(cards, "headline").indexOf(h) + 1}`;
const levelId = (cards: readonly Card[], a: Attr, level: string) =>
  a === "headline" ? headlineTag(cards, level) : level.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Choice sets: each attribute (adjusted marginal means), and the concrete posts sharing each headline. */
export function choiceSets(cards: readonly Card[]): ChoiceSet[] {
  const w = marginalWeights(cards);
  const attrSets = ATTRS.map((a) => ({
    id: `attr:${a}`,
    label: `${ATTR_LABEL[a]} (adjusted marginal mean)`,
    options: levels(cards, a).map((level) => ({ id: levelId(cards, a, level), label: level, weights: w[a][level]! })),
  }));
  const postSets = levels(cards, "headline").map((h) => ({
    id: `posts:${headlineTag(cards, h)}`,
    label: `Posts with headline "${h}"`,
    options: cards.flatMap((c, i) => (c.headline === h ? [{ id: c.id, label: c.text, weights: unit(cards.length, i) }] : [])),
  }));
  return [...attrSets, ...postSets];
}

/** Quantities compared between complementary segments: overall share level, each card, and every pairwise level contrast. */
export function quantities(cards: readonly Card[]): Quantity[] {
  const n = cards.length;
  const w = marginalWeights(cards);
  const out: Quantity[] = [{ id: "level", label: "Average share rating over all 18 posts", weights: Array.from({ length: n }, () => 1 / n) }];
  for (const a of ATTRS) {
    const ls = levels(cards, a);
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        const [li, lj] = [ls[i]!, ls[j]!];
        out.push({
          id: `contrast:${a}:${levelId(cards, a, lj)}-${levelId(cards, a, li)}`,
          label: `${ATTR_LABEL[a]}: ${lj} minus ${li}`,
          weights: w[a][lj]!.map((v, k) => v - w[a][li]![k]!),
        });
      }
    }
  }
  cards.forEach((c, i) => out.push({ id: `card:${c.id}`, label: c.text, weights: unit(n, i) }));
  return out;
}
