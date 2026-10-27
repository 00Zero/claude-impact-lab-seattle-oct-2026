import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mulberry32, shuffle } from "../shared/rng";
import { SEGMENTS } from "./segments";
import { writeTruthSummary } from "./summary";
import { computeTruth } from "./truth";
import { BENCH_DIR, DATA_FILE, PRED_DIR, SPLITS, type Card, type PersonTruth, type RawData, type RawPerson, type Split, type Survey } from "./types";

const SEED = 20261025;
/** Position in the stratified order modulo 5 → split (40/20/40). */
const SPLIT_OF: Split[] = ["train", "train", "val", "test", "test"];
export const TWIN_BATCH = 20;
const DEMO_COLUMNS = ["region", "sex", "age", "education", "race", "party", "income", "ideology", "employment"] as const;

function loadRaw(): RawData {
  if (!existsSync(DATA_FILE)) throw new Error(`${DATA_FILE} not found: run \`python3 scripts/prep_megastudy.py\` first`);
  return JSON.parse(readFileSync(DATA_FILE, "utf8")) as RawData;
}

const ageBand = (age: string | undefined) => (age === "18-29" || age === "30-49" ? "18-49" : "50+");

/** Stratified by party × age band: shuffle within each stratum, concatenate, deal positions 0–4 to train/train/val/test/test. */
export function assignSplits(people: readonly RawPerson[]): Map<number, Split> {
  const rng = mulberry32(SEED);
  const strata = new Map<string, RawPerson[]>();
  for (const p of [...people].sort((a, b) => a.pid - b.pid)) {
    const key = `${p.demographics.party}|${ageBand(p.demographics.age)}`;
    strata.set(key, [...(strata.get(key) ?? []), p]);
  }
  const ordered = [...strata.keys()].sort().flatMap((k) => shuffle(strata.get(k)!, rng));
  return new Map(ordered.map((p, i) => [p.pid, SPLIT_OF[i % SPLIT_OF.length]!]));
}

export const renderCards = (cards: readonly Card[]): string => cards.map((c) => `${c.id} — ${c.text}`).join("\n");

const csvCell = (s: string | number) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const writeJson = (path: string, data: unknown) => writeFileSync(path, `${JSON.stringify(data, null, 1)}\n`);

export function prep(): void {
  const raw = loadRaw();
  const survey: Survey = {
    intro: raw.survey.intro,
    instruction: raw.survey.instruction,
    cards: raw.survey.cards.map(({ id, text, headline, source, content, lean, likes }) => ({ id, text, headline, source, content, lean, likes })),
  };
  mkdirSync(BENCH_DIR, { recursive: true });
  writeJson(join(BENCH_DIR, "survey.json"), survey);

  const splitOf = assignSplits(raw.people);
  const rng = mulberry32(SEED + 1);
  const bySplit = new Map<Split, { raw: RawPerson; truth: PersonTruth }[]>();
  for (const split of SPLITS) {
    // Task ids are assigned in random order so they carry no information about the participant id.
    const mine = shuffle(raw.people.filter((p) => splitOf.get(p.pid) === split), rng);
    bySplit.set(split, mine.map((p, i) => ({
      raw: p,
      truth: {
        id: `${split}-p${String(i + 1).padStart(3, "0")}`,
        pid: p.pid,
        segments: SEGMENTS.filter((s) => s.match(p.demographics)).map((s) => s.id),
        ratings: p.ratings,
      },
    })));
  }

  // Segment table: one row per participant (demographics only, no outcomes).
  const header = ["pid", "task_id", "split", ...DEMO_COLUMNS, "segments"];
  const rows = SPLITS.flatMap((split) => bySplit.get(split)!.map(({ raw: p, truth: t }) =>
    [p.pid, t.id, split, ...DEMO_COLUMNS.map((c) => p.demographics[c] ?? ""), t.segments.join(" ")].map(csvCell).join(",")));
  writeFileSync(join(BENCH_DIR, "people.csv"), `${[header.join(","), ...rows].join("\n")}\n`);

  const cardsText = renderCards(survey.cards);
  const batchDir = join(BENCH_DIR, "batches");
  rmSync(batchDir, { recursive: true, force: true });
  mkdirSync(batchDir, { recursive: true });
  writeJson(join(batchDir, "segments.json"), SEGMENTS.map((s) => ({ id: s.id, vars: { SEGMENT: s.description, CARDS: cardsText } })));

  const truths = SPLITS.map((split) => {
    const people = bySplit.get(split)!;
    const truth = computeTruth(split, people.map((x) => x.truth), survey);
    writeJson(join(BENCH_DIR, `${split}.truth.json`), truth);
    for (let b = 0; b * TWIN_BATCH < people.length; b++) {
      const batch = people.slice(b * TWIN_BATCH, (b + 1) * TWIN_BATCH).map(({ raw: p, truth: t }) => ({ id: t.id, vars: { PERSONA: p.persona_summary, CARDS: cardsText } }));
      writeJson(join(batchDir, `twin-${split}-${b + 1}.json`), batch);
    }
    const real = (xs: { real: boolean }[]) => `${xs.filter((x) => x.real).length}/${xs.length}`;
    const key = truth.gaps.filter((g) => g.family === "key"), expl = truth.gaps.filter((g) => g.family === "exploratory");
    console.log(`${split}: ${people.length} people, ${truth.segments.length} segments (n ≥ 25), real winners ${real(truth.winners)}, real gaps ${real(key)} key + ${real(expl)} exploratory`);
    return truth;
  });

  // Published Mega-Study twins (results.zip) as reference arms, keyed by our task ids.
  for (const [arm, ref] of Object.entries(raw.published)) {
    const dir = join(PRED_DIR, arm);
    mkdirSync(dir, { recursive: true });
    writeJson(join(dir, "meta.json"), { source: `Twin-2K-500-Mega-Study results.zip: results/infotainment/${ref.folder}`, model: ref.model, temperature: ref.temperature, note: "Published twin predictions (persona from all 4 waves unless the folder says otherwise); reference row, not our run." });
    for (const split of SPLITS) {
      const preds = Object.fromEntries(bySplit.get(split)!.flatMap(({ truth: t }) => {
        const r = ref.ratings[String(t.pid)];
        return r ? [[t.id, Object.fromEntries(survey.cards.map((c, i) => [c.id, r[i]!]))]] : [];
      }));
      writeJson(join(dir, `${split}.json`), preds);
    }
  }
  const everyone = SPLITS.flatMap((split) => bySplit.get(split)!.map((x) => x.truth));
  writeTruthSummary([...truths, computeTruth("all", everyone, survey)], survey);
  console.log(`wrote benchmarks/megastudy/{survey.json,people.csv,*.truth.json,TRUTH.md,batches/}, ${Object.keys(raw.published).length} reference arms`);
}
