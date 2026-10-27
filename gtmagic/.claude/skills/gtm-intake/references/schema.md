# Intake Brief schema (`intake.json`, schema v1)

This is the schema's single source of truth (spec v1.1; `docs/skills/INTAKE.md` links here). Column names for importing ad exports are in `imports.md`.

```ts
type Bucket = "locked" | "preference" | "hypothesis" | "unknown";
type Confidence = "low" | "medium" | "high";
type CoreAttribute = "role" | "currentSolution" | "priceSensitivity" | "urgency" | "skepticism" | "buyingStage";
type Channel = "meta" | "google" | "reddit" | "tiktok" | "email" | "website" | "other";   // "website": a landing page
type ConversionType = "paying" | "trial" | "unknown";
type Verdict = "worked" | "didnt-work" | "inconclusive";

interface IntakeBrief {
  schemaVersion: 1;
  mode: "live" | "demo";
  business: { name: string; description: string; websiteUrl?: string; stage: "idea" | "launched" | "established";
              pricing?: { amount: number; currency: string; period: "one-time" | "month" | "year"; purchasesPerYear: number };
              revenueGoal12mo?: number;          // minimum revenue needed in a year to sustain or grow the business
              adoptionRate?: number;             // 0–1, owner's estimate of the share of a group they could win in a year (no default)
              targetCpa?: number;                // owner-stated max cost per paying sign-up; omit if they don't know
              costToServeShare?: number;         // 0–1, owner-confirmed share of a customer's revenue spent serving them; sets the break-even
              acquisitionShare?: number;         // 0–1, owner-confirmed share of first-year revenue they'll spend to win a customer
              unitEconomics?: { annualRevenuePerCustomer: number | null; maxCac: number | null; breakEvenCac: number | null;
                               firstYearMarginShare: number | null; firstYearMargin: number | null;
                               targetCpaUsed: number | null; targetCpaSource: "owner" | "derived" | "none" } };  // script-computed
                                                 // money fields use the same currency as pricing
  baseline: { ownerFirstDescription: string; promptVersion: string; icps: string[]; taglines: string[]; frozenAt: string };
  priorExperiments: PriorExperiment[];
  creatives: Creative[];                                                  // [] if the owner has none (older files may omit it)
  constraints: Constraint[];
  interests: InterestGroup[];                                             // ≤ 5 (today ≤ 3)
  overlaps: InterestOverlap[];
  hypotheses: Hypothesis[];                                               // 1 primary + ≤ 2 alternates
  concerns: Array<{ id: string; label: string; definition: string }>;     // con_
  segments: Segment[];
  icp: { statement: string; mustHaves: string[]; disqualifiers: string[]; segmentId: string } | null;
  roughMessaging: Array<{ angle: string; headline: string; subheadline: string; segmentId: string; lexiconIds: string[] }>;
                                        // each line must cite ≥ 1 customer-voice phrase and really use it (see below)
  lexicon: Array<{ id: string; phrase: string; segmentIds: string[]; evidenceId: string;     // phrase verbatim in the excerpt
                   voice: "customer" | "owner" }>;   // script-computed: "customer" only for reviews and forum posts;
                                        // downstream steps read ONLY voice "customer" entries as how customers talk
  evidence: Evidence[];
  findings: Finding[];
  skeptic: Array<{ claim: string; kind: "motivation" | "incumbent-gap" | "size" | "other"; queries: string[];
                   result: "unresolved" | "resolved" | "nothing-found"; evidenceIds: string[] }>;   // all three main kinds required
  readiness: { status: "ready" | "no-supported-segment" | "needs-more"; checks: Array<{ check: string; pass: boolean; note?: string }> };
  openQuestions: string[];
}

interface Evidence {                    // from tool results or owner files only
  id: string;                           // ev_
  origin: "web" | "owner-file" | "owner-text";
  sourceType: "first-party" | "official-stats" | "survey" | "news-report" | "review-aggregate" | "review" | "forum-post" | "competitor-site";
  url?: string; title?: string;
  excerpt: string;                      // verbatim, ≤ 25 words, personal details removed
  sampleSize?: number;                  // survey n, review count, ad clicks
  segmentIds: string[]; concernIds: string[];      // tags the script counts
  confidence: Confidence; limitations?: string; retrievedAt: string;
  creativeId?: string;                  // cr_: excerpt copied word for word from this creative's headline, body or CTA;
                                        // then sourceType "first-party" and origin "owner-text" (typed in chat) or
                                        // "owner-file" (from an export or screenshot): the owner's words, not a customer's.
                                        // A review or forum excerpt found word for word in a creative's copy is an error.
}

interface Finding {
  id: string; claim: string; segmentId?: string;
  kind: "observed" | "estimated" | "inferred";
  derivation: string;                   // the calculation or reasoning from evidence to claim
  evidenceIds: string[]; confidence: Confidence; limitations?: string;
}

interface Constraint {
  dimension: "geography" | "age" | "sex" | "income" | "lifeStage" | "healthCondition" | "audienceType"
           | "price" | "channel" | "language" | "regulatory" | "ethics" | "interest";
  bucket: Bucket;
  rule: { op: "include" | "exclude" | "range"; values?: string[]; min?: number; max?: number };  // e.g. range 35–54; include ["US-WA"]
  appliesTo: "research" | "targeting" | "messaging" | "all";
  source: "stated" | "website" | "file" | "inferred";
  pushback?: { evidenceIds: string[]; ownerKept: boolean };   // at most one, ever
}

interface Hypothesis {
  id: string; kind: "primary" | "alternate";
  segment: string; action: "buy" | "switch"; motivation: string; insteadOf: string; price: string;
  wrongIf: string; confidence: 1 | 2 | 3 | 4 | 5;
  status: "untested" | "supported" | "weakened" | "refuted"; evidenceIds: string[];
}

interface InterestGroup {
  id: string; name: string;
  researchDefinition: string;           // may name a health condition (research only)
  targetableProxies: string[];          // never names a condition; "verify platform policy before use"
  demographics: Array<{ attribute: string; distribution: Array<{ value: string; share: number }>;
                        evidenceIds: string[]; isEstimate: boolean; logic?: string }>;
}

interface InterestOverlap {
  groupIds: [string, string];
  summary: string;
  strongest: Array<{ attribute: string; value: string; shareLow: number; shareHigh: number }>;
  isEstimate: boolean; logic: string; evidenceIds: string[];
}

interface Segment {
  id: string; name: string; description: string; isOwnerGuess: boolean; ownerRank?: number;
  sampleShare?: number;                 // share of the synthetic audience; default = equal; rough relative numbers are fine (script normalizes)
  attributes: Array<{ name: CoreAttribute | string; values: Array<{ value: string; weight: number }> }>;
                                        // all 6 CoreAttributes required; locks already applied; weights normalized by the script
  needs: string[]; barriers: string[]; decisionCriteria: string[];
  channels: string[];                   // where they gather and could be reached
  concernBundles: Array<{ concernIds: string[]; observedCount: number; weight: number; confidence: Confidence }>;  // script-computed
  serviceability: {
    incumbents: Array<{ name: string; rating?: number; reviewCount?: number; evidenceIds: string[] }>;
    unresolvedConcernIds: string[]; switchingEvidenceIds: string[];
    size: { population: number | null; isEstimate: boolean; logic: string; evidenceIds: string[] };
    sizeMath: { customersNeeded: number | null; adoptionRate: number | null; minPopulation: number | null };   // script-computed; null when an input is missing
    motivation: string;
    verdict: "serviceable" | "marginal" | "not-serviceable" | "insufficient-evidence";
    confidence: Confidence; reasoning: string;
  };
}

interface PriorExperiment {             // one campaign or ad result; never person-level rows
  id: string;                           // px_
  channel: Channel;
  hypothesis?: string; audience: string;
  message: { headline?: string; body?: string };   // as the export or the owner gave it
  spend?: number;                       // spend and metrics: finite numbers ≥ 0; anything else is an error
  metrics: { impressions?: number; clicks?: number; conversions?: number };   // copied, never computed; see imports.md
                                        // a missing figure is "not recorded", never 0
  conversionType?: ConversionType;      // ask the owner; only "paying" results are judged
                                        // "sign-ups" in an ad export may be free trials, not paying customers: ask the owner which
  verdict: Verdict;                     // script-computed vs unitEconomics.targetCpaUsed
  verdictReason?: string;               // script-computed: why, in plain words
  creativeIds?: string[];               // cr_ creatives these results cover; must mirror creatives[].experimentIds
  source?: "file" | "manual";           // "manual": numbers the owner typed or read out (default "file")
  sourceFile?: string;                  // the export it was copied from; REQUIRED when source is "file" (the default):
                                        // a file result with no sourceFile is an error
}

interface Creative {                    // something the owner already made: an ad, a landing-page headline, an email, a draft
  id: string;                           // cr_
  format: "text" | "image";             // "image": the owner gave an image or a screenshot of it
  channel?: Channel;                    // where it ran or would run
  status: "live" | "past" | "draft";    // "draft": never used, so it has no results
  headline?: string; body?: string; cta?: string;   // the owner's words, verbatim (title/headline, main text, button)
  imageFile?: string;                   // relative path under the workspace's sources/, e.g. "sources/spring-ad.png";
                                        // must resolve (symlinks included) inside sources/; a missing file only warns
  imageDescription?: string;            // MODEL-WRITTEN: what is visible in the image (people, setting, any text on it,
                                        // the button); never the owner's words, never a guess about how it did
  source: "owner-text" | "owner-file" | "website";  // where the wording came from
  sourceFile?: string;                  // the upload it came from (export or screenshot)
  experimentIds: string[];              // px_ results for this creative; [] when there are none
  guardrailFlags?: string[];            // script-computed: messaging rules it breaks (a warning; the owner's call)
  performance?: CreativePerformance | null;   // script-computed from the linked results; null when none are linked
}

interface CreativePerformance {         // script-computed; never typed
  basis: "own" | "shared" | "partly-shared";   // "shared": every linked result also covers other creatives, so it
                                        // can't be split; "partly-shared": some do, so totals mix own and shared results
  sharedWith: string[];                 // those other cr_ ids
  channels: Channel[];                  // channels of the linked results; more than one means the totals blend channels
  spend: number | null; impressions: number | null; clicks: number | null;   // summed; null if any result lacks it
  conversions: number | null;           // summed; null if any result lacks it, and always null when "mixed"
  ctr: number | null;                   // clicks ÷ impressions
  costPerSignup: number | null;         // spend ÷ conversions; null when "mixed"
  conversionType: ConversionType | "mixed";   // "mixed": paying and other sign-ups can't be added up, so inconclusive
  verdict: Verdict; verdictReason: string;    // same rule as priorExperiments (economics.judge_ad)
}
```

**Message lines must really use a customer phrase.** Each `roughMessaging` line must cite at least one lexicon entry with `voice: "customer"` whose phrase it uses in substance: at least half of the phrase's content words (lowercased, common words like "the" and "my" ignored) appear in the headline plus subheadline. Otherwise it's an error.

### Why creatives are separate from results

- **Wording and numbers are different things with a many-to-many link.** One ad can run in two campaigns, one campaign row can cover several ads, and drafts or landing-page headlines have no numbers at all. So wording lives in `creatives[]`, numbers stay in `priorExperiments[]`, and the link is explicit on both sides (`experimentIds` ↔ `creativeIds`). The validator fails when the two sides disagree, so numbers never get attached to wording by accident.
- **The script computes each creative's results** by summing its linked results and judging them with the same rule as the experiments, so the two can't disagree. A sum with any figure missing stays null (a partial sum would understate the cost per sign-up), and a missing figure is never read as zero. Paying and trial sign-ups are never added together. `basis` says when a result can't be split per creative, and `channels` says when totals blend channels.
- **`imageDescription` is kept apart from the copy fields** and is model-written, so later steps (simulating customers seeing the ad) never mistake Claude's description for the owner's words.
- **`headline`, `body` and `cta` match the positioning contract's** `headline`, `subheadline` and `callToAction`, so an existing set can be tested later as-is.
- **The owner's creatives are theirs.** Guardrail risks become `guardrailFlags` and warnings, never errors or rewrites. Their wording can feed `lexicon[]` only through a `first-party` evidence record with `creativeId`, and the script tags those phrases `voice: "owner"`. Owner copy can't pose as customer voice: a review or forum excerpt, or a customer-voice lexicon phrase, found word for word in a creative's copy is an error. Downstream steps (the simulation) read only `voice: "customer"` lexicon entries as customer language.

## Who writes each field

- **Script:** `scripts/validate_intake.py --write` computes it. You leave a placeholder and never type the value.
- **Model:** you write it, but only from evidence (tool results, the owner's text and files) and the rules in SKILL.md.
- **Owner:** you draft it, the owner confirms it in plain words, and you record what they said.

| Field | Written by | Notes |
|---|---|---|
| `segments[].concernBundles` | Script | Leave `[]`. Counts and weights come from evidence tags. |
| `segments[].serviceability.sizeMath` | Script | Leave it out. Uses `revenueGoal12mo` (the minimum revenue needed in a year), `pricing`, and the owner's `business.adoptionRate`. No defaults: null when an input is missing, and size isn't judged. |
| `business.unitEconomics` | Script | Leave it out. `annualRevenuePerCustomer` = price × purchases per year; `breakEvenCac` = that × (1 − `costToServeShare`), the most a new customer can cost before year one loses money; `maxCac` = that × `acquisitionShare`; `firstYearMarginShare` = 1 − `costToServeShare` − `acquisitionShare` (and `firstYearMargin` in dollars; the script warns at zero or below); `targetCpaUsed` = the owner's `targetCpa` if stated, else `maxCac`, with `targetCpaSource` saying which. Nulls where an input is missing; never a default. |
| `priorExperiments[].verdict`, `verdictReason` | Script | Leave `"inconclusive"`. Judged against `unitEconomics.targetCpaUsed`; the reason says why. Ask the owner whether ad "sign-ups" are free trials or paying customers. |
| `creatives[].performance` | Script | Leave it out. Summed from the linked `priorExperiments` and judged by the same rule; null with no linked results. Never type a CTR, cost per sign-up or verdict for a creative. |
| `creatives[].guardrailFlags` | Script | Leave it out. The messaging rules the owner's copy (or what the image shows) breaks. Tell the owner; never rewrite their creative. |
| `lexicon[].voice` | Script | Leave it out. `customer` for reviews and forum posts, `owner` for the owner's own words (and for a dangling evidence id). Only `customer` entries are read downstream as customer voice. |
| `segments[].attributes[].values[].weight` | Script normalizes | You give rough relative weights; the script makes them sum to 1. |
| `segments[].sampleShare` | Model (rough) + script normalizes | Default equal across segments. You may set rough relative numbers from the owner's ranking (e.g. 7 and 3); the script normalizes them. |
| `readiness.checks` | Script + model | The script fills the checks it can compute; you add the rest (including owner confirmation). |
| `readiness.status` | Script | Set from all checks. Never `ready` while a check fails or before the owner's confirmation is recorded. |
| `baseline` | Fixed prompt | Frozen in step 2 from `prompts/baseline.md`; never edited. |
| `business.*` (name, description, stage, pricing, `revenueGoal12mo`, `websiteUrl`) | Owner | Drafted from the pre-read, marked "please confirm". |
| `business.targetCpa` | Owner | Only when the owner states a number. Never derived or guessed. |
| `business.costToServeShare`, `acquisitionShare` | Owner | From the cost-per-sign-up walk-through, confirmed as fractions. Ask cost to serve first (help the owner estimate it from their own cost lines); it sets the break-even. Then the owner picks `acquisitionShare` knowing the break-even. Never suggest a benchmark share. |
| `constraints[]` (bucket, rule, `pushback.ownerKept`) | Owner | You sort answers into buckets; the owner confirms must-haves and decides on pushback. A `hypothesis`-bucket constraint carries no "wrong if" or confidence; those live on `hypotheses[]`. |
| `segments[].ownerRank`, `isOwnerGuess` | Owner | Ranked in session 2. |
| `hypotheses[]` wording | Owner | Converged with the owner; `status` and `evidenceIds` are model-written from research. |
| `icp` | Owner | Final statement confirmed at handoff; `null` with `no-supported-segment`. |
| `priorExperiments[]` metrics, `message`, `audience`, `spend` | Owner file or owner | Copied from the upload (campaign or ad level, never person-level rows; column names in `imports.md`), or typed exactly as the owner says them with `source: "manual"`. Never estimated. |
| `priorExperiments[].creativeIds`, `creatives[].experimentIds` | Model | Link a result to the creatives it covers, on both sides. Match by the export's headline or ad name, and confirm with the owner. |
| `creatives[]` `headline`, `body`, `cta`, `format`, `channel`, `status`, `source`, `sourceFile`, `imageFile` | Owner | Copied verbatim from the owner's text, upload or website; status confirmed with the owner. Uploads are copied into `sources/`. |
| `creatives[].imageDescription` | Model | Written only from an image you actually viewed: what is visible, including any text on it. Never from memory, never for an image you haven't seen. |
| `evidence[]` | Model (copied) | From the research log or the owner's text and files only. Excerpts verbatim, at most 25 words, personal details removed. |
| `lexicon[]` | Model (copied) | Each `phrase` appears word for word in its evidence excerpt. A creative's wording may be used only through `first-party` evidence with `creativeId` (origin `owner-text` or `owner-file`); the script tags it `voice: "owner"`. |
| `concerns[]`, evidence `segmentIds` / `concernIds` tags | Model | Stable IDs; the script does the counting. |
| `findings[]`, `skeptic[]` | Model | Every claim cites evidence; skeptic queries match the log. |
| `interests[]`, `overlaps[]` | Model | Estimates marked `isEstimate` with `logic`; proxies never name a condition. |
| `segments[]` descriptions, needs, barriers, criteria, channels, other attributes | Model | From evidence and owner answers. |
| `serviceability` (incumbents, unresolved concerns, switching evidence, size, motivation, verdict, confidence, reasoning) | Model | Incumbent ratings copied from sources; verdict written after the script fills `sizeMath`. |
| `roughMessaging[]` | Model | Cites `lexiconIds`, at least one a customer-voice phrase the line really uses; passes the messaging check. |
| `openQuestions[]` | Model | Unresolved unknowns and research tasks. |
| `schemaVersion`, `mode` | Model | `1`; `"demo"` only in demo mode. |
