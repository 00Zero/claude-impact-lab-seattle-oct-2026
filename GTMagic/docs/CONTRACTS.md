# Data contracts (v1)

These are the shapes passed between modules. The team should agree on them **before** building anything else. They're written as TypeScript here; in code they become **Zod schemas** in `src/contracts/`, with types inferred via `z.infer`. Once the code exists, it's the source of truth and this doc is the explanation.

## Rules

1. **Contracts only.** A module imports `@/contracts` and `@/platform/*`, never another module's files.
2. **Code owns IDs and grounding.** The model never writes an ID, a URL, or any text we present as a real quote.
   - IDs come from `ctx.ids.next("seg")`. They're deterministic within a step and unique within a run (`seg_1`, `cust_r1_17`).
   - `Evidence` (URL + excerpt) is built by **code**, from the API's citation objects or from the founder's pasted text.
   - The model refers to things by the IDs or labels we put in its prompt, and validators check every reference.
3. **Model output has its own schema.** Each LLM call parses into a module-private `*Draft` schema shaped for the model (for example, options keyed by label `"A"`, not by ID). Code then maps the draft to the contract. Contract schemas are never sent to the model as-is.
4. **Integrity rules fail; quality targets only warn.** A broken reference or a non-verbatim quote is dropped, or fails the step (see Validators). Counts (segments, lexicon size, hypotheses) are *targets*: missing one adds a warning, and the run continues in "thin evidence" mode. Thresholds are never schema constraints. (Structured outputs strip min/max anyway, and they allow no recursive schemas.)
5. **No `any`, no `unknown`, no untyped maps.** A `Record` is allowed only with a union of known keys (e.g. `Record<Dimension, number>`).
6. **Lineage lives in the envelope** (`inputArtifactIds`), never as ID fields inside payloads. **Artifacts are immutable**: round 2 creates new ones.
7. **Changing a contract:** adding an optional field is fine in place. A rename, removal, or new required field is breaking: bump `schemaVersion` and follow the process in COLLABORATION.md.

## Envelope

```ts
type ArtifactKind =
  | "business-brief" | "market-model" | "audience-sample" | "positioning-set"
  | "experiment-request" | "customer-responses" | "experiment-results" | "gtm-report";

interface Artifact<T> {
  id: string;                        // art_ + random; stored and served by this ID
  runId: string;
  kind: ArtifactKind;
  round?: 1 | 2; schemaVersion: 1;
  createdAt: string;                 // ISO 8601
  producer: { step: StepName; promptVersion?: string; model?: string };
  inputArtifactIds: string[];        // lineage
  warnings: string[];                // quality warnings (rule 4), shown in the UI
  data: T;
}
```

## Intake: BusinessBriefInput → BusinessBrief

```ts
interface BusinessBriefInput {        // what the start form sends; only description is required
  description: string;               // ≤ 4,000 chars
  businessName?: string;             // default: derived from description or URL
  websiteUrl?: string; pricing?: string;   // pricing is free text, e.g. "$29/month", "$6 a loaf"
  stage?: "idea" | "launched" | "established";      // default "launched"
  idealCustomerGuess?: string;       // a hypothesis to test, not a constraint
  currentMessage?: { headline: string; subheadline?: string };   // tested as a blinded option
  customerLanguage?: string;         // pasted reviews/emails/notes, ≤ 10,000 chars
}

interface BusinessBrief {             // normalized by INTAKE
  businessName: string;
  description: string;
  websiteUrl?: string; pricing?: string;
  stage: "idea" | "launched" | "established";
  idealCustomerGuess?: string;
  currentMessage?: { headline: string; subheadline?: string };
  customerLanguage: string[];        // split into snippets; emails, phone numbers, @handles removed
}
```

## MarketModel (Market Intelligence → everyone)

```ts
// Generic enough for business and consumer customers: "role" is a job or a life role.
type AttributeName =
  | "role" | "currentSolution" | "priceSensitivity" | "urgency" | "skepticism" | "buyingStage";

interface AttributeDistribution {
  name: AttributeName;
  values: Array<{ value: string; weight: number }>;    // code normalizes weights to sum to 1
}

interface CustomerSegment {
  id: string;                        // seg_
  name: string;
  description: string;
  isFounderGuess: boolean;           // matches BusinessBrief.idealCustomerGuess
  estimatedShare?: number;           // 0–1
  needs: string[]; pains: string[]; currentAlternatives: string[];
  purchaseTriggers: string[]; barriers: string[]; decisionCriteria: string[];
  attributes: AttributeDistribution[];
  evidenceIds: string[];             // target ≥ 2; empty = inference only, shown as such
}

interface Evidence {                  // built by code, never by the model
  id: string;                        // ev_
  origin: "web-citation" | "founder-text";
  sourceType: "review" | "forum" | "website" | "article" | "founder";  // from a domain allow-list
  url?: string;                      // web-citation only
  title?: string;
  excerpt: string;                   // verbatim cited_text or founder snippet; usernames/PII removed
  retrievedAt: string;
}

interface LexiconEntry {
  id: string;                        // lex_
  phrase: string;                    // ≥ 3 words, verbatim in its evidence excerpt (see Validators)
  kind: "pain" | "desired-outcome" | "alternative" | "objection" | "trigger";
  meaning: string;
  segmentIds: string[];
  evidenceId: string;                // evidence.sourceType must be review | forum | founder
}

interface Competitor {
  id: string;                        // comp_
  name: string; positioning: string;
  strengths: string[]; weaknesses: string[]; evidenceIds: string[];
}

interface MarketModel {
  segments: CustomerSegment[];       // target 3–5
  competitors: Competitor[];
  evidence: Evidence[];
  lexicon: LexiconEntry[];           // target ≥ 10 per segment
  evidenceStrength: "thin" | "ok" | "strong";   // computed by code from the counts above
  openQuestions: string[];
}
```

## AudienceSample (Audience → Experiments, Simulation)

```ts
interface AudienceConfig {
  sampleSize: number;                // default 48
  seed: number;
  strategy: "balanced" | "representative";   // default balanced: equal n per segment
  segmentIds?: string[];
}

interface SyntheticCustomer {
  id: string;                        // cust_r<round>_<n>
  segmentId: string;
  attributes: Partial<Record<AttributeName, string>>;
  needs: string[]; barriers: string[]; decisionCriteria: string[];
  voiceLexiconIds: string[];         // 3–5 real quotes this customer "talks like"
}

interface AudienceSample {
  config: AudienceConfig;
  samplerVersion: string;            // bump when the sampling algorithm changes
  role: "exploration" | "holdout";   // round 2 always uses a holdout sample
  customers: SyntheticCustomer[];
}
```

## PositioningSet (Positioning → Experiments, Report)

```ts
interface PositioningHypothesis {
  id: string;                        // hyp_
  round: 1 | 2;
  source: "generated" | "founder-current" | "refined" | "decoy";
                                     // decoy: a deliberately generic baseline built by code (POSITION) from a 1–3 word
                                     // category for the business ("fitness app"); never isControl, never recommended
  parentId?: string;                 // refined from this hypothesis
  isControl?: boolean;               // round-2 copy of the round-1 winner (new ID)
  angle: string;                     // "Confidence", "Speed", "Your current message"…
  targetSegmentIds: string[];
  headline: string;
  subheadline: string;               // ≤ 30 words; with headline, this is what customers see
  valueProposition: string; differentiator: string; callToAction: string;
  assumptions: string[];
  evidenceIds: string[];
  lexiconIds: string[];              // real phrases the copy borrows
}

interface PositioningSet {
  round: 1 | 2;
  hypotheses: PositioningHypothesis[];   // target 4–6 generated, + founder's current message if given, + one decoy (round 1)
}
```

## Experiments (Experiments ↔ Audience)

```ts
type Dimension = "relevance" | "credibility" | "differentiation" | "clarity" | "actionIntent";

interface Stimulus { label: string; candidateId: string; text: string }   // label "A"…; ID never shown

interface ExperimentRequest {
  id: string;                        // exp_
  round: 1 | 2;
  scenario: { context: string; decision: string; channel: "landing-page" | "ad" | "email" };
  stimuli: Stimulus[];               // same format for every option (headline + subheadline)
  orderings: string[][];             // Williams Latin square of labels; k = orderings.length (the number of options, or twice
                                     // that for an odd count). Within each segment, the j-th customer (j from 0, in
                                     // AudienceSample.customers order) sees orderings[(floor(s * k / S) + j) % k]. s is the
                                     // segment's position (from 0) among the segments with at least one customer in the
                                     // sample, in MarketModel.segments order; S is how many such segments there are. Each
                                     // segment starts at an evenly spaced row, so equal-sized segments keep the whole sample
                                     // within one showing per ordering (unequal sizes drift a little). j depends only on
                                     // position: skipped or retried calls keep their orderingIndex. Repeats don't advance
                                     // j: they keep the same orderingIndex and see that ordering reversed
  repeatCustomerIds: string[];       // ~10 customers asked again with their ordering reversed
  protocol: { version: string; instructions: string; dimensionDefinitions: Record<Dimension, string> };
  fingerprint?: string;              // opaque hash of everything else in the request, by code; compare, never recompute.
                                     // For skill files, which have no envelope; in the pipeline, inputArtifactIds does this
}

interface CustomerResponse {
  id: string;                        // resp_
  experimentId: string;
  customerId: string;
  segmentId: string;                 // copied so evaluation doesn't need a join
  orderingIndex: number; isRepeat: boolean;
  status: "answered" | "skipped";
  skipReason?: "refusal" | "timeout" | "invalid-output";
  choice?: string;                   // candidateId or "none"; mapped from the label by code
  ratings?: Array<{ candidateId: string; scores: Record<Dimension, 1 | 2 | 3 | 4 | 5> }>;
  objections?: Array<{ candidateId: string | null; text: string }>;
  reasoning?: string;                // simulated; never displayed as a real quote
  model: string;
  promptVersion: string;
}

interface CustomerResponses {
  experimentId: string;
  requestFingerprint?: string;       // copied from ExperimentRequest.fingerprint (skill files; see there)
  responses: CustomerResponse[];
}

type IcpVerdict = "guess-holds" | "different-segment" | "too-close-to-call" | "no-guess";
type MessageVerdict = "clear-winner" | "no-clear-winner" | "unreliable";   // unreliable: the decoy did too well
type MessageCheckId =
  | "decoy" | "winner" | "current-message" | "interest" | "consistency" | "sample-size" | "customer-group";

interface ExperimentResults {
  experimentId: string; protocolVersion: string;
  answered: number; skipped: number;
  candidates: Array<{
    candidateId: string;
    choiceCount: number;
    preferenceShare: number;         // "simulated preference", 0–1
    preferenceRange?: [number, number];   // [low, high]: 90% Wilson interval for preferenceShare over `answered` ("none"
                                     // included): how far it could move with new simulated customers. Says nothing about
                                     // real customers, and isn't the verdict's test (a 97.5% bootstrap bar)
    dimensionMeans: Record<Dimension, number>;
    segmentBreakdown: Array<{ segmentId: string; choiceCount: number; n: number }>;
  }>;
  noneCount: number;
  segmentRanking: Array<{            // computed in code; drives the recommendation
    segmentId: string; n: number; noneShare: number;
    bestCandidateId: string;         // "none" when nobody in the segment chose a message
    bestShare: number; actionIntent: number; score: number;
  }>;
  icpVerdict: IcpVerdict;
  stability: { bootstrapWinnerRate: number; repeatConsistency: number | null; modelAgreement?: number };
  confidenceFlags: Array<
    "small-sample" | "everyone-agreed" | "nobody-interested" | "unstable-winner" | "thin-evidence" | "many-skipped">;
  objectionThemes: Array<{ theme: string; count: number; candidateIds: string[]; simulatedQuotes: string[] }>;
  roundComparison?: { controlId: string; controlShare: number; bestRefinedId: string; bestRefinedShare: number; held: boolean };
  limitations: string[];
  messageVerdict?: MessageVerdict;   // computed in code. clear-winner: the decoy didn't fail; winner, current-message and
                                     // consistency pass; no interest or sample-size warning. A decoy or customer-group
                                     // warning doesn't block it. unreliable: the decoy failed. Otherwise no-clear-winner
  recommendedCandidateId?: string | null;   // absent: not computed; null: no clear winner. Never "validated"
  checks?: Array<{ id: MessageCheckId; status: "pass" | "warn" | "fail"; detail: string }>;
                                     // a check is listed only when it applies (interest and sample-size only as warnings;
                                     // only decoy can fail). detail: plain words written by code, about simulated customers;
                                     // the UI shows checks under a "simulated" label, never styled as quotes
}
```

## GTMReport (Strategy → UI)

```ts
interface GTMReport {
  headline: { whoToTarget: string; whatToSay: string; tryThisWeek: string };   // shown first
  icpComparison: {
    verdict: IcpVerdict;             // copied from ExperimentResults; the model only explains
    founderGuess?: string;
    recommendedSegmentId: string;    // top of segmentRanking
    explanation: string;
  };
  currentMessageResult?: { rank: number; of: number; beatenByIds: string[] };   // among all options shown, decoy included
  recommendedPositioning: Array<{
    hypothesisId: string; rationale: string; confidence: "exploratory" | "research-backed"; evidenceIds: string[];
  }>;
  topObjections: string[];
  validationRoadmap: Array<{
    priority: number; title: string; hypothesis: string; method: string;
    successMetric: string; cost: "free" | "low" | "medium"; timeToResult: string;
  }>;
  assets: Array<{ type: "landing-hero" | "cold-email" | "interview-script" | "ad-copy"; title: string; content: string }>;
  limitations: string[];
}
```

## Run status (platform → UI)

```ts
type StepName =
  | "INTAKE" | "RESEARCH" | "SAMPLE" | "POSITION" | "DESIGN" | "SIMULATE" | "EVALUATE" | "REFINE" | "REPORT";

interface PipelineError {
  code: "INVALID_INPUT" | "UNSAFE_INPUT" | "RESEARCH_FAILED" | "SCHEMA_INVALID" | "MODEL_REFUSAL"
      | "RATE_LIMITED" | "TIMEOUT" | "BUDGET_EXCEEDED" | "INTERRUPTED" | "INTERNAL";
  message: string;                   // safe to show the founder
  step?: StepName;
  round?: 1 | 2;
  retryable: boolean;                // false for BUDGET_EXCEEDED, UNSAFE_INPUT, INVALID_INPUT
}

interface Run {
  id: string;                        // 128-bit random, URL-safe: the only access control
  status: "queued" | "running" | "completed" | "failed";
  queuePosition?: number;
  steps: Array<{ name: StepName; round?: 1 | 2; status: "pending" | "running" | "done" | "failed" | "skipped";
                 startedAt?: string; finishedAt?: string }>;
  progress?: { step: StepName; done: number; total: number };
  costUsd: number; budgetUsd: number;
  artifacts: Array<{ id: string; kind: ArtifactKind; round?: 1 | 2 }>;
  isReplay: boolean;                 // the instant example run
  createdAt: string;
  expiresAt: string;                 // deleted after RUN_RETENTION_DAYS
  error?: PipelineError;
}
```

## Validators (`src/contracts/validate.ts`)

**Integrity (the item is dropped, or the step fails):**
1. Every `*Id` / `*Ids` reference resolves within the run. Dangling references are dropped, and a warning is added.
2. A lexicon `phrase` has ≥ 3 words and appears verbatim in its evidence `excerpt`. Matching ignores case, curly-vs-straight quotes, and whitespace. The evidence `sourceType` must be `review`, `forum`, or `founder`. Otherwise the entry is dropped.
3. A response's choice and ratings map to labels that were shown. Otherwise the response is marked `skipped: invalid-output`.
4. A round-2 experiment uses an audience sample with `role: "holdout"`.
5. `Evidence` only comes from citation objects or founder text (checked by `origin`).
6. SIMULATE fails if fewer than 80% of calls are answered; above that, skipped calls are noted in `limitations`.
7. When both are present, EVALUATE refuses `CustomerResponses` whose `requestFingerprint` differs from the request's `fingerprint` (answers to an older build: re-run SIMULATE). It warns when only the request has one.
8. `recommendedCandidateId` is set if and only if `messageVerdict` is `clear-winner`, and is never the decoy. `recommendedPositioning` never cites the decoy.

**Quality (adds a warning; the run continues):** fewer than 3 segments · fewer than 10 lexicon entries per segment · a segment with fewer than 2 evidence items (→ `evidenceStrength: "thin"`) · fewer than 4 `generated` hypotheses or duplicate angles · attribute weights off by more than 0.05 before normalizing.
