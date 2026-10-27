# audience

**Owner:** Synthetic Audience · **Tasks:** [TASKS.md §3](../../../docs/TASKS.md)

```
sampleAudience(marketModel: MarketModel, config: AudienceConfig, ctx) → AudienceSample        // pure code
simulate(sample: AudienceSample, request: ExperimentRequest, ctx) → CustomerResponses
```

Builds a **stateless** synthetic audience from the market model (identical for the same market model + seed), then runs each customer through the experiment that the Experiments module designed.

## Sampling (no LLM)

Seeded random-number generator → segment (`balanced` by default) → 6 attributes from the segment's distributions → subsets of needs/barriers/criteria → 3–5 **voice quotes** from that segment's lexicon. IDs come from `ctx.ids`. Bump `SAMPLER_VERSION` when the algorithm changes.

## Simulation (one call per customer, plus the repeat subset)

You own *running* customers; Experiments owns *what they're shown and asked*. The protocol, dimension definitions, stimuli, and orderings all come from `ExperimentRequest`.

```
[protocol + dimension definitions]          ← request.protocol (identical for every call)
[scenario + stimuli in ordering k]          ← request.orderings[i % k]
[customer card]                             ← card.ts (varies)
```

- `ctx.ai.warmCache(...)` with one request per ordering, **then** fan out (the limiter is in `ctx.ai`).
- Parse into `SimulationDraft` keyed by label (`choice: "A" | … | "none"`), then map labels → candidate IDs in code. Bad output or a refusal → `status: "skipped"`; never throw for a single customer.
- Append each response to the JSONL stream as it lands. On retry, skip customers already saved.

## Layout

```
index.ts       export { sampleAudience, simulate, sampleMock, simulateMock }
sampler.ts     seeded sampling (pure)
card.ts        customer → prompt text (pure)
simulate.ts    calls, draft mapping, skip handling, resume
prompts.ts     SIMULATION_PROMPT_VERSION
*.test.ts      same seed → same sample; card snapshots; draft-mapping tests
```
