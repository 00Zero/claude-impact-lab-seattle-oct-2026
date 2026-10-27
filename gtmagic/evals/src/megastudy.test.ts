import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { choiceSets, loadSurvey, marginalWeights, quantities } from "./megastudy/design";
import { loadTruth, scoreSegments, scoreTwins } from "./megastudy/score";
import { bh, dot, ranks, spearman } from "./megastudy/stats";
import { BENCH_DIR } from "./megastudy/types";

const built = existsSync(join(BENCH_DIR, "test.truth.json"));

test("megastudy stats helpers", () => {
  assert.deepEqual(ranks([3, 1, 3, 2]), [3.5, 1, 3.5, 2]);
  assert.equal(spearman([1, 2, 3], [10, 20, 30]), 1);
  assert.deepEqual(bh([0.01, 0.04, 0.03]).map((q) => Number(q.toFixed(3))), [0.03, 0.04, 0.04]);
});

test("megastudy design weights are linear marginal means", { skip: !built }, () => {
  const cards = loadSurvey().cards;
  const flat = cards.map(() => 3);
  for (const levels of Object.values(marginalWeights(cards))) {
    for (const w of Object.values(levels)) assert.ok(Math.abs(dot(w, flat) - 3) < 1e-9);
  }
  for (const q of quantities(cards).filter((x) => x.id.startsWith("contrast:"))) assert.ok(Math.abs(dot(q.weights, flat)) < 1e-9);
  // A pure lean effect is recovered exactly, with nothing leaking into other attributes.
  const lean = cards.map((c) => (c.lean === "Liberal" ? 1 : 0));
  const q = quantities(cards);
  assert.ok(Math.abs(dot(q.find((x) => x.id === "contrast:lean:liberal-conservative")!.weights, lean) - 1) < 1e-9);
  assert.ok(Math.abs(dot(q.find((x) => x.id === "contrast:content:informative-entertaining")!.weights, lean)) < 1e-9);
  assert.equal(choiceSets(cards).length, 9);
});

test("megastudy prompts quote the survey verbatim and use only known placeholders", { skip: !built }, () => {
  const survey = loadSurvey();
  for (const [file, vars] of [["vanilla-segment-v1.md", ["SEGMENT", "CARDS"]], ["vanilla-twin-v1.md", ["PERSONA", "CARDS"]]] as const) {
    const text = readFileSync(join(BENCH_DIR, "prompts", file), "utf8");
    assert.ok(text.includes(survey.intro) && text.includes(survey.instruction), file);
    assert.deepEqual([...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].sort(), [...vars].sort());
  }
});

test("megastudy blind batches carry no outcomes and oracle scores perfectly", { skip: !built }, () => {
  const dir = join(BENCH_DIR, "batches");
  for (const f of readdirSync(dir)) {
    const items = JSON.parse(readFileSync(join(dir, f), "utf8")) as { id: string; vars: Record<string, string> }[];
    for (const it of items) assert.deepEqual(Object.keys(it).sort(), ["id", "vars"]);
  }
  const truth = loadTruth("test");
  const seg = scoreSegments(truth, new Map(truth.segments.map((s) => [s.id, s.means])));
  assert.equal(seg.winnerAcc.value, 1);
  assert.equal(seg.gapSign.value, 1);
  const twin = scoreTwins(truth, new Map(truth.people.map((p) => [p.id, p.ratings])));
  assert.equal(twin.mae.value, 0);
});
