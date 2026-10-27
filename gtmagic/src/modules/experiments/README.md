# experiments

**Owner:** Positioning & Experiments · **Tasks:** [TASKS.md §4](../../../docs/TASKS.md)

```
designExperiment(brief: BusinessBrief, sample: AudienceSample, positioning: PositioningSet, ctx) → ExperimentRequest   // pure code
evaluate(marketModel, sample, request, responses: CustomerResponses, ctx) → ExperimentResults
```

Owns the **experimental method**: what customers are shown, in what order, what they're asked, and what the numbers mean. Audience runs the customers; this module designs the test and computes the answer.

## Design (pure code)

- **Stimuli:** every option as headline + subheadline, the same format, labeled A/B/C… (IDs never shown).
- **Orderings:** a cyclic Latin square over the labels; customer *i* sees `orderings[i % k]`, so every option appears in every position equally often.
- **Repeat subset:** ~10 customers, spread across segments, asked again with their ordering reversed.
- **Protocol:** instructions + `dimensionDefinitions` (relevance, credibility, differentiation, clarity, actionIntent) + the scenario for the channel.

## Evaluate (pure code, plus one LLM call)

- Counts, shares, the none-count, and dimension means, overall and per segment (show **n**).
- **Segment ranking:** `score = (1 − noneShare) × meanActionIntentOfChosen / 5`, per segment.
- **ICP verdict:**
  - The founder's segment is on top → `guess-holds`.
  - Another segment beats it by ≥0.10 *and* wins in ≥80% of bootstrap resamples → `different-segment`.
  - Otherwise → `too-close-to-call`.
  - No guess given → `no-guess`.
- **Stability:** bootstrap winner rate (500 seeded resamples); repeat consistency.
- **Confidence flags:** `small-sample` (segment n < 5), `everyone-agreed` (none-share 0%), `nobody-interested`, `unstable-winner` (bootstrap < 0.7), `thin-evidence`, `many-skipped`.
- **Objection themes:** one `ctx.ai.parse` call; example quotes go in `simulatedQuotes`.
- **Stretch:** `roundComparison` for round 2, computed in code.

## Layout

```
index.ts       export { designExperiment, evaluate, designMock, evaluateMock }
design.ts      stimuli, Latin square, repeat subset (pure)
stats.ts       counts, ranking, verdict, bootstrap, flags (pure, heavily unit-tested)
themes.ts      objection grouping (LLM)
prompts.ts     PROTOCOL_VERSION, THEMES_PROMPT_VERSION
*.test.ts
```
