/* UI-private Zod schema for intake.json (Intake Brief v1).
   Mirrors .claude/skills/gtm-intake/references/schema.md, including the #3 (unit economics)
   and #6 (creatives, lexicon voice) additions. Deliberately lenient: unknown keys pass through
   and script-computed fields are optional, so briefs from a newer skill version still render. */
import { z } from "zod";

const L = z.looseObject;

export const ENUMS = {
  verdict: ["serviceable", "marginal", "not-serviceable", "insufficient-evidence"],
  confidence: ["low", "medium", "high"],
  bucket: ["locked", "preference", "hypothesis", "unknown"],
  dimension: ["geography", "age", "sex", "income", "lifeStage", "healthCondition", "audienceType",
    "price", "channel", "language", "regulatory", "ethics", "interest"],
  appliesTo: ["research", "targeting", "messaging", "all"],
  findingKind: ["observed", "estimated", "inferred"],
  sourceType: ["first-party", "official-stats", "survey", "news-report", "review-aggregate", "review", "forum-post", "competitor-site"],
  hypothesisStatus: ["untested", "supported", "weakened", "refuted"],
  skepticResult: ["unresolved", "resolved", "nothing-found"],
  skepticKind: ["motivation", "incumbent-gap", "size", "other"],
  adVerdict: ["worked", "didnt-work", "inconclusive"],
  conversionType: ["paying", "trial", "unknown"],
  channel: ["meta", "google", "reddit", "tiktok", "email", "website", "other"],
  creativeStatus: ["live", "past", "draft"],
  readiness: ["ready", "no-supported-segment", "needs-more"],
} as const;

const e = <K extends keyof typeof ENUMS>(k: K) => z.enum(ENUMS[k]);
const num = z.number();
const ids = z.array(z.string());

const EvidenceSchema = L({
  id: z.string(),
  origin: z.enum(["web", "owner-file", "owner-text"]),
  sourceType: e("sourceType"),
  url: z.string().optional(),
  title: z.string().optional(),
  excerpt: z.string(),
  sampleSize: num.optional(),
  segmentIds: ids.default([]),
  concernIds: ids.default([]),
  confidence: e("confidence"),
  limitations: z.string().optional(),
  retrievedAt: z.string().optional(),
  creativeId: z.string().optional(),
});

const LexiconSchema = L({
  id: z.string(),
  phrase: z.string(),
  segmentIds: ids.default([]),
  evidenceId: z.string(),
  voice: z.enum(["customer", "owner"]).optional(),
});

const SegmentSchema = L({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  isOwnerGuess: z.boolean().default(false),
  ownerRank: num.optional(),
  sampleShare: num.optional(),
  attributes: z.array(L({ name: z.string(), values: z.array(L({ value: z.string(), weight: num })) })).default([]),
  needs: z.array(z.string()).default([]),
  barriers: z.array(z.string()).default([]),
  decisionCriteria: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
  concernBundles: z.array(L({ concernIds: ids, observedCount: num, weight: num.optional(), confidence: e("confidence").optional() })).default([]),
  serviceability: L({
    incumbents: z.array(L({ name: z.string(), rating: num.optional(), reviewCount: num.optional(), evidenceIds: ids.default([]) })).default([]),
    unresolvedConcernIds: ids.default([]),
    switchingEvidenceIds: ids.default([]),
    size: L({ population: num.nullable(), isEstimate: z.boolean(), logic: z.string(), evidenceIds: ids.default([]) }).optional(),
    sizeMath: L({ customersNeeded: num.nullable(), adoptionRate: num.nullable(), minPopulation: num.nullable() }).nullable().optional(),
    motivation: z.string().default(""),
    verdict: e("verdict").optional(),
    confidence: e("confidence").optional(),
    reasoning: z.string().default(""),
  }),
});

const PerformanceSchema = L({
  spend: num.nullable(), impressions: num.nullable(), clicks: num.nullable(), conversions: num.nullable(),
  ctr: num.nullable().optional(), costPerSignup: num.nullable(),
  conversionType: z.union([e("conversionType"), z.literal("mixed")]),
  verdict: e("adVerdict"), verdictReason: z.string(),
}).nullable();

const CreativeSchema = L({
  id: z.string(),
  format: z.enum(["text", "image"]),
  channel: e("channel").optional(),
  status: e("creativeStatus"),
  headline: z.string().optional(),
  body: z.string().optional(),
  cta: z.string().optional(),
  imageFile: z.string().optional(),
  imageDescription: z.string().optional(),
  source: z.enum(["owner-text", "owner-file", "website"]),
  sourceFile: z.string().optional(),
  experimentIds: ids.default([]),
  guardrailFlags: z.array(z.string()).optional(),
  performance: PerformanceSchema.optional(),
});

const PriorExperimentSchema = L({
  id: z.string(),
  channel: e("channel"),
  hypothesis: z.string().optional(),
  audience: z.string(),
  message: L({ headline: z.string().optional(), body: z.string().optional() }),
  spend: num.optional(),
  metrics: L({ impressions: num.optional(), clicks: num.optional(), conversions: num.optional() }),
  conversionType: e("conversionType").optional(),
  verdict: e("adVerdict"),
  verdictReason: z.string().optional(),
  creativeIds: ids.optional(),
  source: z.enum(["file", "manual"]).optional(),
  sourceFile: z.string().optional(),
});

const UnitEconomicsSchema = L({
  annualRevenuePerCustomer: num.nullable(), maxCac: num.nullable(), breakEvenCac: num.nullable(),
  firstYearMarginShare: num.nullable(), firstYearMargin: num.nullable(),
  targetCpaUsed: num.nullable(), targetCpaSource: z.enum(["owner", "derived", "none"]),
});

export const IntakeBriefSchema = L({
  schemaVersion: z.literal(1),
  mode: z.enum(["live", "demo"]),
  business: L({
    name: z.string(), description: z.string(), websiteUrl: z.string().optional(),
    stage: z.enum(["idea", "launched", "established"]),
    pricing: L({ amount: num, currency: z.string(), period: z.enum(["one-time", "month", "year"]), purchasesPerYear: num }).optional(),
    revenueGoal12mo: num.optional(), adoptionRate: num.optional(), targetCpa: num.optional(),
    costToServeShare: num.optional(), acquisitionShare: num.optional(),
    unitEconomics: UnitEconomicsSchema.optional(),
  }),
  baseline: L({ ownerFirstDescription: z.string(), promptVersion: z.string(), icps: z.array(z.string()), taglines: z.array(z.string()), frozenAt: z.string() }),
  priorExperiments: z.array(PriorExperimentSchema).default([]),
  creatives: z.array(CreativeSchema).default([]),
  constraints: z.array(L({
    dimension: e("dimension"), bucket: e("bucket"),
    rule: L({ op: z.enum(["include", "exclude", "range"]), values: z.array(z.string()).optional(), min: num.optional(), max: num.optional() }),
    appliesTo: e("appliesTo"), source: z.enum(["stated", "website", "file", "inferred"]),
    pushback: L({ evidenceIds: ids, ownerKept: z.boolean() }).optional(),
  })).default([]),
  hypotheses: z.array(L({
    id: z.string(), kind: z.enum(["primary", "alternate"]), segment: z.string(), action: z.enum(["buy", "switch"]),
    motivation: z.string(), insteadOf: z.string(), price: z.string(), wrongIf: z.string(),
    confidence: num, status: e("hypothesisStatus"), evidenceIds: ids.default([]),
  })).default([]),
  concerns: z.array(L({ id: z.string(), label: z.string(), definition: z.string() })).default([]),
  segments: z.array(SegmentSchema).default([]),
  icp: L({ statement: z.string(), mustHaves: z.array(z.string()), disqualifiers: z.array(z.string()), segmentId: z.string() }).nullable(),
  roughMessaging: z.array(L({ angle: z.string(), headline: z.string(), subheadline: z.string(), segmentId: z.string(), lexiconIds: ids.default([]) })).default([]),
  lexicon: z.array(LexiconSchema).default([]),
  evidence: z.array(EvidenceSchema).default([]),
  findings: z.array(L({
    id: z.string(), claim: z.string(), segmentId: z.string().optional(), kind: e("findingKind"),
    derivation: z.string(), evidenceIds: ids.default([]), confidence: e("confidence"), limitations: z.string().optional(),
  })).default([]),
  skeptic: z.array(L({ claim: z.string(), kind: e("skepticKind").optional(), queries: z.array(z.string()), result: e("skepticResult"), evidenceIds: ids.default([]) })).default([]),
  readiness: L({ status: e("readiness"), checks: z.array(L({ check: z.string(), pass: z.boolean(), note: z.string().optional() })) }),
  openQuestions: z.array(z.string()).default([]),
});

export type IntakeBrief = z.infer<typeof IntakeBriefSchema>;
export type Evidence = IntakeBrief["evidence"][number];
export type Segment = IntakeBrief["segments"][number];
export type Creative = IntakeBrief["creatives"][number];
export type PriorExperiment = IntakeBrief["priorExperiments"][number];
export type Business = IntakeBrief["business"];

export type ParseResult = { ok: true; brief: IntakeBrief } | { ok: false; reason: "json" | "schema"; issues: string[] };

/** Parse a raw intake.json string; failures come back as up to five plain-word issues. */
export function parseIntake(raw: string): ParseResult {
  let r: ReturnType<typeof IntakeBriefSchema.safeParse>;
  try {
    r = IntakeBriefSchema.safeParse(JSON.parse(raw));
  } catch (err) {
    return { ok: false, reason: "json", issues: [`The save file isn't valid JSON (${err instanceof Error ? err.message : "parse error"}).`] };
  }
  if (r.success) return { ok: true, brief: r.data };
  return {
    ok: false,
    reason: "schema",
    issues: r.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(top level)"}: ${i.message}`),
  };
}
