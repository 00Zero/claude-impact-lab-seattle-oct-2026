# Architecture

## Shape

One Next.js app. The backend is a **fixed pipeline of steps**: a workflow run by code, not a swarm of autonomous agents. Each step is a plain async function owned by one person:

```ts
type Step<In, Out> = (input: In, ctx: StepContext) => Promise<Out>;

interface StepContext {
  runId: string;
  round: 1 | 2;
  ai: AiClient;          // the only way to call Claude
  ids: IdAllocator;      // ctx.ids.next("seg") → deterministic, run-unique IDs
  log: Logger;           // structured: { runId, step, round, event, ...fields }
  seed: number;          // run seed; steps derive sub-seeds from it
  signal: AbortSignal;   // aborted on budget exceeded, timeout, or cancel
}
```

Steps never import each other. They take and return **contract types** (see [CONTRACTS.md](CONTRACTS.md)), and the orchestrator in `src/platform` passes them along.

## Pipeline

```
BusinessBriefInput ─► INTAKE ─► BusinessBrief ─► RESEARCH ─► MarketModel
                                                                │
                                ┌───────────────────────────────┴───────────────┐
                                ▼ (in parallel)                                 ▼
                     SAMPLE ─► AudienceSample                     POSITION ─► PositioningSet
                                └───────────────┬───────────────────────────────┘
                                                ▼
                     DESIGN ─► ExperimentRequest (stimuli, Latin-square orderings, protocol)
                                                ▼
                     SIMULATE ─► CustomerResponses (~58 calls, streamed to the UI)
                                                ▼
                     EVALUATE ─► ExperimentResults (counts, segment ranking, ICP verdict, stability)
                                                ▼
              [stretch] REFINE ─► SAMPLE(holdout) ─► DESIGN ─► SIMULATE ─► EVALUATE   (round 2)
                                                ▼
                     REPORT ─► GTMReport (report + assets in parallel)
```

| Step | Function | Input → Output | Owner | LLM |
|---|---|---|---|---|
| INTAKE | `intake` | BusinessBriefInput → BusinessBrief | Market Intelligence | 1 small safety check |
| RESEARCH | `research` | BusinessBrief → MarketModel | Market Intelligence | Opus + web tools, then Opus |
| SAMPLE | `sampleAudience` | MarketModel + AudienceConfig → AudienceSample | Audience | None |
| POSITION | `generatePositioning` | BusinessBrief + MarketModel → PositioningSet | Positioning | Opus |
| DESIGN | `designExperiment` | BusinessBrief + AudienceSample + PositioningSet → ExperimentRequest | Experiments | None |
| SIMULATE | `simulate` | AudienceSample + ExperimentRequest → CustomerResponses | Audience | Simulation model |
| EVALUATE | `evaluate` | MarketModel + AudienceSample + ExperimentRequest + CustomerResponses → ExperimentResults | Experiments | 1 call (objection themes) |
| REFINE *(stretch)* | `refine` | BusinessBrief + MarketModel + PositioningSet + ExperimentResults → PositioningSet | Positioning | Opus |
| REPORT | `report` | BusinessBrief + MarketModel + PositioningSets + ExperimentResults[] → GTMReport | Strategy | Opus (2 parallel calls) |

**Refinement is a stretch goal** (`ENABLE_REFINEMENT=false` by default). The loop from the sketch is there, but round 1 has to be solid first. When it's on, round 2 tests only the control (a new-ID copy of the round-1 winner) and the refined options, on a **fresh holdout audience**.

## Orchestrator (`src/platform/orchestrator`)

**Steps and rounds:** each step entry is `{ name, round }`, so retry and resume always know exactly where they are. Artifacts are stored and served **by artifact ID**, so round-2 outputs never collide with round 1.

**Persist, then advance:** each step's output is written as an immutable artifact before the next step starts.

**Partial failure is normal:**
- Within a step, each LLM call is retried once, then **skipped**.
- SIMULATE fails only if fewer than 80% of calls are answered. Otherwise the gap goes into `limitations`.
- On resume, SIMULATE skips responses already saved, keyed by `(experimentId, customerId, orderingIndex)`, so a retry never pays twice.

**Retry rules:**
- Allowed only from `failed`, with a per-run lock so a double-click can't start two pipelines.
- `BUDGET_EXCEEDED`, `UNSAFE_INPUT` and `INVALID_INPUT` can't be retried.

**Crash safety:**
- Live run state sits in a registry on `globalThis`, shared across Next.js route bundles.
- Each run's `run.json` is written through a **per-run write queue** as an atomic write (temp file, then rename), so a poll never reads half-written JSON.
- A top-level `catch` marks the run failed.
- **On boot**, any run left `running` is marked failed with `INTERRUPTED`, which can be retried.

**Load control:**
- At most `LIVE_RUN_CONCURRENCY` live runs at once (default 2). Others queue, and the UI shows "You're #2 in line."
- One process-wide AI limiter (default 16 calls in flight) is shared by all runs.

**Mock or live per step:** `STEP_MODE_<STEP>=mock|live`. A mock returns its fixture **rebound to the real inputs** by `bindFixture()`, which maps fixture `seg_`/`lex_`/`ev_`/`cust_` IDs onto the input's IDs by position. So a live RESEARCH followed by a mock POSITION still produces valid references. Validators run in warn mode on mock output. CI runs the all-mock pipeline end to end on every PR.

## AI client (`src/platform/ai`, server-only)

All Claude calls go through one wrapper:

- **Config:** model and effort per step come from env, validated with Zod at boot; a missing value fails fast. The `server-only` import guard keeps the wrapper (and the key) out of browser bundles.
- **Calls:** `ai.parse(draftSchema, request)` for structured output, and `ai.research(request)` for web-search calls, which returns `CitedNotes` (text + citation objects).
- **Retries and failures:** one retry, then a typed failure so the step can skip the item. Refusals are checked via `stop_reason`. Opus gets server-side fallbacks; a Haiku refusal becomes a skipped respondent.
- **Web tools:** `web_search` `max_uses: 5`; `web_fetch` with `max_content_tokens` capped. `pause_turn` is resumed automatically, up to 2 times.
- **Cache warm-up:** for SIMULATE, one call per ordering runs first, then the fan-out. Otherwise the first concurrent wave all misses the cache.
- **Cost:** tracked from `usage`, plus web-search fees. A hard per-run cap aborts with `BUDGET_EXCEEDED`, and a daily cap stops new live runs.
- **Call log:** every call is appended to `runs/<runId>/calls.jsonl` (step, round, model, prompt version, tokens, cost, latency).

## Intake and Market Intelligence

**INTAKE** normalizes the form input:
- Applies defaults and splits pasted text into snippets.
- **Strips emails, phone numbers and @handles** (a shared `scrubPii()` in platform).
- Runs one cheap safety check on the business description. Clearly harmful products get `UNSAFE_INPUT` and a friendly message.

**RESEARCH** is two calls, because structured outputs can't be combined with citations:

1. **Research call** (Opus + web search/fetch). It looks for segments, alternatives, competitors, and how *customers* describe the problem in reviews, forums and Q&A threads. It returns `CitedNotes`.
2. **Code builds `Evidence`** from each citation's `url` and `cited_text`, and from each founder snippet. Code assigns the IDs and sets `sourceType` from a domain allow-list. Usernames are scrubbed from excerpts.
3. **Structure call:** the evidence list (with IDs) + the brief → a `MarketModelDraft`. Segments and lexicon entries *reference* evidence IDs; they never write quotes. A lexicon phrase must appear verbatim in its referenced excerpt (see Validators).
4. **Thin evidence:** if the targets aren't met (niche or local businesses), the run continues with `evidenceStrength: "thin"`, and the UI suggests pasting real reviews or customer emails and running again.

## Synthetic Audience

**Sampling is plain code; no LLM.** It's instant and free, and exactly reproducible *for the same market model and seed*:

1. A seeded random-number generator picks each customer's segment. The default is `balanced`: equal n per segment, because comparing segments is the headline.
2. Within the segment, it draws the 6 attributes from their distributions, so attributes correlate *through* the segment.
3. It draws subsets of the segment's needs, barriers and decision criteria.
4. It attaches 3–5 **real lexicon quotes** from that segment as the customer's *voice*.

**SIMULATE** makes one call per customer, plus the repeat subset. The prompt is layered for caching:

```
[protocol + dimension definitions]            ← from ExperimentRequest; identical for every call
[scenario + stimuli in ordering k]            ← identical per ordering (k = number of orderings: the number of options, ×2 if odd)
[customer card: attributes, needs, voice]     ← varies per customer
```

- The options are blinded labels A/B/C… with no business name.
- "None of these" is always allowed.
- Each response is appended to a JSONL file as it lands, which drives the live crowd.
- The model answers in a `SimulationDraft` keyed by label, and code maps it to the contract.

## Experiments

**DESIGN** (pure code) builds the experiment:
- **Stimuli:** every option in the same format (headline + ≤30-word subheadline), including the founder's current message if one was given.
- **Orderings:** a Williams Latin square, counted within each segment, with each segment starting at an evenly spaced row. Every option appears in every position and right after every other option about equally often, every segment with at least as many customers as orderings sees every ordering, and with equal-sized segments the whole sample sees each ordering within one showing of the others.
- **Repeat subset:** ~10 customers, spread across segments, are asked again with their ordering reversed.
- **Protocol:** the instructions and the dimension definitions. The experimental method lives here, not in the Audience module.

**EVALUATE** is pure code, plus one LLM call:
- Raw counts and shares overall and per segment, the none-count, and dimension means. The UI always shows **n and counts**, never bare percentages.
- **Segment ranking and ICP verdict, computed in code:**
  - For each segment: `score = (1 − noneShare) × meanActionIntentOfChosenOption / 5`.
  - The founder's segment is on top → `guess-holds`.
  - Another segment beats it by ≥0.10 *and* wins in ≥80% of bootstrap resamples → `different-segment`.
  - Otherwise → `too-close-to-call`.
  - No guess given → `no-guess`.
- **Stability:** a bootstrap winner rate (500 seeded resamples) and repeat consistency (the share of repeated customers who chose the same option).
- **Confidence flags:** for example, a 0% none-share → `everyone-agreed`, shown to the founder as low confidence.
- **Objection themes:** one LLM call; quotes are labeled *simulated*.

## Report

- The model **explains** a recommendation that code already computed. It never picks the segment.
- The report and the starter assets are two parallel calls.
- **Shown first:** who to target, what to say, what to try this week. Evidence sits behind a click.
- **Asset rules (enforced in the prompt and checked after):** no testimonials, no statistics or numbers we didn't get from the founder, no superlatives ("best", "#1"), no competitor names. Every asset is labeled *Draft: verify claims before publishing*.
- **Markdown export:** `toMarkdown(report)` produces a file to download, since there are no accounts.

## HTTP API (`src/app/api`)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/runs` | Live run. Body: `BusinessBriefInput`. Returns `{ runId }`, or a queue position |
| POST | `/api/runs/example` | Instant **replay** of the recorded example, with responses re-streamed at their original timing. $0, can't fail |
| GET | `/api/runs/:id` | `Run`. The UI polls every 2s |
| GET | `/api/runs/:id/responses?after=N` | New responses, for the live crowd |
| GET | `/api/runs/:id/artifacts/:artifactId` | One artifact |
| GET | `/api/runs/:id/report.md` | Markdown export |
| POST | `/api/runs/:id/retry` | Only when status is `failed` and the error is retryable |
| DELETE | `/api/runs/:id` | The founder deletes their run now |

- `:id` and `:artifactId` must match strict patterns (no path traversal).
- **Rate limit:** per IP (`RUNS_PER_IP_PER_HOUR`, generous because judges share venue Wi-Fi), plus a global live-run cap. The team's demo device sends `X-Team-Token` to bypass the limit.

## Storage

```
runs/<runId>/
  run.json                          Run status (atomic writes through the per-run queue)
  artifacts/<artifactId>.json       Immutable Artifact<T> envelopes
  responses-<experimentId>.jsonl    Live response stream; sealed into a customer-responses artifact
  calls.jsonl                       Every Claude call: model, prompt version, tokens, cost
fixtures/demo/                      Hand-checked fixtures (mocks and tests)
fixtures/recorded-run/              One real run, used by /api/runs/example
```

- Hosted on **one always-on instance with a persistent volume**.
- A daily sweep deletes runs past `RUN_RETENTION_DAYS` (default 7).
- **Deploys are frozen during judging**, because a redeploy restarts the process.

## Time and cost budget

| Step | Target |
|---|---|
| INTAKE | ≤ 5s |
| RESEARCH (≤5 searches, then structure) | ≤ 75s |
| SAMPLE ∥ POSITION | ≤ 25s |
| SIMULATE (~58 calls, 16 at a time) | ≤ 25s on Haiku / ≤ 90s on Opus |
| EVALUATE | ≤ 15s |
| REPORT ∥ assets | ≤ 30s |
| **Total** | **~2.5 min (Haiku) / ~3.5 min (Opus)**, under the 4-minute target |

Per-run costs are in [TECH_STACK.md](TECH_STACK.md). Measure both on day one.

## Security and privacy

- Run IDs are 128-bit random values and are the only access key, so we never list runs.
- Founders can delete a run now; everything is deleted after 7 days. The start form says: *"Don't paste personal or confidential information."*
- Secrets live only in host env vars. Separate API keys for development and the demo; both with spend limits.
- Web pages and founder text are passed to the model as **data**, in delimited blocks. No tool the model can call has side effects.
- Lexicon excerpts are short (the API's cited text) and always shown with their source link. We never republish whole reviews.
- Simulated words are **always visually distinct** from real quotes. Generated copy is rendered as text or Markdown, never as raw HTML.
