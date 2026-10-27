import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { choiceSets, quantities } from "./design";
import { SEGMENTS } from "./segments";
import { FDR, KEY_QUANTITIES } from "./truth";
import { BENCH_DIR, MIN_SEGMENT, type Interval, type SplitTruth, type Survey } from "./types";

const f2 = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);
const ci = ([lo, hi]: Interval) => `[${f2(lo)}, ${f2(hi)}]`;

/** Human-readable ground truth (never show it to a predictor). */
export function writeTruthSummary(truths: SplitTruth[], survey: Survey): void {
  const sets = new Map(choiceSets(survey.cards).map((s) => [s.id, s]));
  const qs = new Map(quantities(survey.cards).map((q) => [q.id, q]));
  const optLabel = (set: string, id: string) => {
    const o = sets.get(set)?.options.find((x) => x.id === id);
    return set.startsWith("posts:") ? id : (o?.label ?? id);
  };
  const lines = [
    "# Infotainment benchmark: ground truth summary (scorer-only, never put this in a prompt)",
    "",
    `Segments are scored in a split only when n ≥ ${MIN_SEGMENT}. "Real" = 95% bootstrap CI excludes 0 and Benjamini–Hochberg q < ${FDR} within the split. Families: winner tests; key gap tests (${KEY_QUANTITIES.join(", ")}); exploratory gap tests (every other card/contrast). The "all" section pools every split and is a reference only (never scored).`,
    "",
    `| Segment | Description | ${truths.map((t) => `n ${t.split}`).join(" | ")} |`,
    `|---|---|${truths.map(() => "---").join("|")}|`,
    ...SEGMENTS.map((s) => {
      const ns = truths.map((t) => {
        const n = t.people.filter((p) => p.segments.includes(s.id)).length;
        return n >= MIN_SEGMENT ? String(n) : `(${n})`;
      });
      return `| ${s.id} | ${s.description} | ${ns.join(" | ")} |`;
    }),
    "",
    "Parenthesized n: too small, not scored in that split.",
    "",
  ];
  for (const t of truths) {
    const all = t.segments.find((s) => s.id === "all")!;
    const order = all.means.map((m, i) => [m, i] as const).sort((a, b) => b[0] - a[0]);
    lines.push(`## ${t.split === "all" ? "Full sample (reference only, not scored)" : t.split} (${t.people.length} people)`, "", `Overall ranking (all ${all.n}): ${order.map(([m, i]) => `${survey.cards[i]!.id} ${m.toFixed(2)}`).join(", ")}`, "");
    const rw = t.winners.filter((w) => w.real);
    lines.push(`### Real winners (${rw.length} of ${t.winners.length} segment × choice-set tests)`, "", "| Segment | Choice set | Winner | Runner-up | Diff [95% CI] | q |", "|---|---|---|---|---|---|");
    for (const w of rw) lines.push(`| ${w.segment} | ${w.set} | ${optLabel(w.set, w.winner)} | ${optLabel(w.set, w.runnerUp)} | ${f2(w.diff)} ${ci(w.ci)} | ${w.q.toFixed(3)} |`);
    const rg = t.gaps.filter((g) => g.real);
    const count = (fam: string) => `${rg.filter((g) => g.family === fam).length}/${t.gaps.filter((g) => g.family === fam).length} ${fam}`;
    lines.push("", `### Real segment gaps (${count("key")}, ${count("exploratory")})`, "", "| Segment A − B | Family | Quantity | Gap [95% CI] | p | q |", "|---|---|---|---|---|---|");
    for (const g of rg) lines.push(`| ${g.a} − ${g.b} | ${g.family} | ${g.quantity.startsWith("card:") ? g.quantity : (qs.get(g.quantity)?.label ?? g.quantity)} | ${f2(g.gap)} ${ci(g.ci)} | ${g.p.toFixed(3)} | ${g.q.toFixed(3)} |`);
    const near = t.gaps.filter((g) => !g.real && g.family === "key" && g.p < 0.05);
    if (near.length) lines.push("", `Key gaps with unadjusted p < 0.05 that did not survive correction: ${near.map((g) => `${g.a} − ${g.b} ${g.quantity} ${f2(g.gap)} (p ${g.p.toFixed(3)})`).join("; ")}`);
    lines.push("");
  }
  writeFileSync(join(BENCH_DIR, "TRUTH.md"), `${lines.join("\n")}\n`);
}
