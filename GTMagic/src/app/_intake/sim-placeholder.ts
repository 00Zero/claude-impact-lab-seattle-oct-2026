/* PLACEHOLDER simulation. The simulation step isn't built yet, so the choices are hand-set
   counts, not model output. Everything else comes from the save file: groups and their
   sampleShare, the lines (roughMessaging plus the owner's own line from creatives), each
   customer's attributes and the customer-voice phrases they talk like. Labelled on screen. */
import type { Creative, Evidence, IntakeBrief } from "./schema";

export const SIM_SIZE = 48;
// [A, B, C, D, own line, none] for owner rank 1 and 2 (see ledger ruling).
const CHOICES_BY_RANK: Record<1 | 2, number[]> = { 1: [10, 4, 7, 6, 5, 2], 2: [3, 4, 1, 2, 2, 2] };
const REASONS = [
  "Keeping my strength is the whole point for me. This says it plainly.",
  "I've quit apps before. Lasting habits matter more to me than a quick start.",
  "I like that it isn't about the scale, but it's a bit vague about what I'd do.",
  "Eating enough is my real problem, so this one caught my eye.",
  "This is close to what I'm after, but I'd want to know what I actually do.",
];
const NONE_REASON = "None of these tell me what I'd actually do on day one.";

export type SimMessage = { label: string; headline: string; subheadline: string; isOwn: boolean };
export type SimCustomer = {
  id: string;
  segmentId: string;
  attrs: Array<{ name: string; value: string }>;
  voice: Array<{ phrase: string; evidence: Evidence }>;
  choice: string; // a message label or "none"
  reason: string;
};
export type SimRun = { size: number; messages: SimMessage[]; perSegment: number[]; customers: SimCustomer[] };

export function ownLine(creatives: Creative[]): Creative | undefined {
  const withHeadline = creatives.filter((c) => c.headline);
  return withHeadline.find((c) => c.channel === "website" && c.status === "live")
    ?? withHeadline.find((c) => c.channel === "website")
    ?? withHeadline.find((c) => c.status === "live")
    ?? withHeadline[0];
}

function split(shares: number[], size: number): number[] {
  const total = shares.reduce((a, b) => a + b, 0) || 1;
  const raw = shares.map((s) => (s / total) * size);
  const n = raw.map(Math.floor);
  let left = size - n.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
    if (left-- > 0) n[i] = (n[i] ?? 0) + 1;
  });
  return n;
}

export function buildSim(brief: IntakeBrief): SimRun {
  const segs = brief.segments;
  const own = ownLine(brief.creatives);
  const messages: SimMessage[] = brief.roughMessaging.slice(0, 4).map((m, i) => ({ label: "ABCD"[i] ?? "?", headline: m.headline, subheadline: m.subheadline, isOwn: false }));
  if (own?.headline) messages.push({ label: "E", headline: own.headline, subheadline: own.body ?? "", isOwn: true });

  const perSegment = split(segs.map((s) => s.sampleShare ?? 1), SIM_SIZE);
  const queues = segs.map((s, si) => {
    const base = CHOICES_BY_RANK[s.ownerRank === 1 ? 1 : 2];
    const labels = ["A", "B", "C", "D", "E"];
    const out: string[] = [];
    base.forEach((count, k) => {
      const label = k < 5 ? labels[k] : "none";
      const usable = label === "none" || messages.some((m) => m.label === label);
      for (let j = 0; j < count; j++) out.push(usable && label ? label : "none");
    });
    while (out.length < (perSegment[si] ?? 0)) out.push("none");
    out.length = perSegment[si] ?? 0;
    return out.map((c, i) => ({ c, k: (i * 7 + 3) % out.length })).sort((a, b) => a.k - b.k).map((x) => x.c);
  });

  const evById = new Map(brief.evidence.map((e) => [e.id, e]));
  const customers: SimCustomer[] = [];
  const cursor = segs.map(() => 0);
  while (customers.length < SIM_SIZE && segs.length > 0) {
    segs.forEach((s, si) => {
      const i = cursor[si] ?? 0;
      if (i >= (perSegment[si] ?? 0) || customers.length >= SIM_SIZE) return;
      cursor[si] = i + 1;
      const choice = queues[si]?.[i] ?? "none";
      const lex = brief.lexicon.filter((l) => l.segmentIds.includes(s.id) && (l.voice ?? "customer") === "customer");
      const picks = [lex[i % (lex.length || 1)], lex[(i + 1) % (lex.length || 1)]].filter((l, k, arr) => l && arr.indexOf(l) === k);
      customers.push({
        id: `C-${String(customers.length + 1).padStart(2, "0")}`,
        segmentId: s.id,
        attrs: s.attributes.map((a, ai) => ({ name: a.name, value: a.values[(i + ai) % (a.values.length || 1)]?.value ?? "" })),
        voice: picks.flatMap((l) => {
          const ev = l ? evById.get(l.evidenceId) : undefined;
          return l && ev ? [{ phrase: l.phrase, evidence: ev }] : [];
        }),
        choice,
        reason: choice === "none" ? NONE_REASON : REASONS["ABCDE".indexOf(choice)] ?? NONE_REASON,
      });
    });
    if (cursor.every((c, si) => c >= (perSegment[si] ?? 0))) break;
  }
  return { size: SIM_SIZE, messages, perSegment, customers };
}
