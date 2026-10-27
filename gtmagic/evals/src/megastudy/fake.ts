import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mulberry32 } from "../shared/rng";
import { loadSurvey } from "./design";
import { loadTruth } from "./score";
import { SEGMENTS } from "./segments";
import { PRED_DIR, SPLITS, type Predictions } from "./types";

/**
 * Code-generated sanity arms (no model calls):
 *   oracle-segment / oracle-twin  the truth itself (upper bound; checks the scorer)
 *   random-segment / random-twin  uniform noise on the 1–7 scale (chance level)
 *   null-train-mean               train-split average of every card for every segment and person (no ICP conditioning)
 */
export function writeFakeArms(): void {
  const cardIds = loadSurvey().cards.map((c) => c.id);
  const asObj = (v: readonly number[]) => Object.fromEntries(cardIds.map((id, i) => [id, Math.round(v[i]! * 100) / 100]));
  const write = (arm: string, file: string, data: Predictions) => {
    mkdirSync(join(PRED_DIR, arm), { recursive: true });
    writeFileSync(join(PRED_DIR, arm, file), `${JSON.stringify(data, null, 1)}\n`);
  };
  for (const arm of ["oracle-segment", "oracle-twin", "random-segment", "random-twin", "null-train-mean"]) {
    rmSync(join(PRED_DIR, arm), { recursive: true, force: true });
  }

  const rng = mulberry32(424242);
  write("random-segment", "segments.json", Object.fromEntries(SEGMENTS.map((s) => [s.id, asObj(cardIds.map(() => 1 + 6 * rng()))])));
  const trainAll = loadTruth("train").segments.find((s) => s.id === "all")!.means;
  write("null-train-mean", "segments.json", Object.fromEntries(SEGMENTS.map((s) => [s.id, asObj(trainAll)])));

  for (const split of SPLITS) {
    const truth = loadTruth(split);
    write("oracle-segment", `segments-${split}.json`, Object.fromEntries(truth.segments.map((s) => [s.id, asObj(s.means)])));
    write("oracle-twin", `${split}.json`, Object.fromEntries(truth.people.map((p) => [p.id, asObj(p.ratings)])));
    write("random-twin", `${split}.json`, Object.fromEntries(truth.people.map((p) => [p.id, asObj(cardIds.map(() => 1 + Math.floor(7 * rng())))])));
    if (split !== "train") write("null-train-mean", `${split}.json`, Object.fromEntries(truth.people.map((p) => [p.id, asObj(trainAll)])));
  }
  console.log("wrote oracle-segment, oracle-twin, random-segment, random-twin, null-train-mean under benchmarks/megastudy/predictions/");
}
