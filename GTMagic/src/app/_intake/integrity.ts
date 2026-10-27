/* Integrity pass: drop dangling references instead of crashing (CONTRACTS.md: integrity
   items are dropped, with a warning). Pure: returns a new brief and the warnings. */
import type { IntakeBrief } from "./schema";

export function cleanIntake(input: IntakeBrief): { brief: IntakeBrief; warnings: string[] } {
  const warnings: string[] = [];
  const keep = (list: string[], known: Set<string>, where: string) =>
    list.filter((id) => {
      if (known.has(id)) return true;
      warnings.push(`${where} points at ${id}, which isn't in the save file; skipped.`);
      return false;
    });

  const evidenceIds = new Set(input.evidence.map((e) => e.id));
  const segmentIds = new Set(input.segments.map((s) => s.id));
  const concernIds = new Set(input.concerns.map((c) => c.id));

  const lexicon = input.lexicon.filter((l) => {
    if (evidenceIds.has(l.evidenceId)) return true;
    warnings.push(`Phrase ${l.id} points at ${l.evidenceId}, which isn't in the save file; skipped.`);
    return false;
  });
  const lexiconIds = new Set(lexicon.map((l) => l.id));
  const experimentIds = new Set(input.priorExperiments.map((p) => p.id));
  const creativeIds = new Set(input.creatives.map((c) => c.id));

  const brief: IntakeBrief = {
    ...input,
    lexicon,
    roughMessaging: input.roughMessaging.map((m) => ({ ...m, lexiconIds: keep(m.lexiconIds, lexiconIds, `Line "${m.headline}"`) })),
    evidence: input.evidence.map((e) => ({
      ...e,
      segmentIds: keep(e.segmentIds, segmentIds, `Evidence ${e.id}`),
      concernIds: keep(e.concernIds, concernIds, `Evidence ${e.id}`),
    })),
    creatives: input.creatives.map((c) => ({ ...c, experimentIds: keep(c.experimentIds, experimentIds, `Creative ${c.id}`) })),
    priorExperiments: input.priorExperiments.map((p) =>
      p.creativeIds ? { ...p, creativeIds: keep(p.creativeIds, creativeIds, `Campaign ${p.id}`) } : p,
    ),
  };
  return { brief, warnings };
}
