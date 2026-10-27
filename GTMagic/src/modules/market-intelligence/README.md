# market-intelligence

**Owner:** Market Intelligence & Strategy · **Tasks:** [TASKS.md §2](../../../docs/TASKS.md)

```
intake(input: BusinessBriefInput, ctx) → BusinessBrief
research(brief: BusinessBrief, ctx) → MarketModel
```

Finds customer groups, competitors, and **real customer language**, each traced to a source. This is the evidence everything else is built on, so code (not the model) decides what counts as real.

## How it works

1. **Intake:** defaults, split pasted text into snippets, `scrubPii()`, one cheap safety check → `UNSAFE_INPUT` for clearly harmful businesses.
2. **Research call:** `ctx.ai.research(…)` (Opus + web search/fetch, ≤5 searches) → `CitedNotes`. Ask specifically for how *customers* talk: reviews, forums, Q&A threads.
3. **Build Evidence in code:** one record per citation (`url`, `cited_text`) and per founder snippet. Assign IDs with `ctx.ids`; set `sourceType` from a domain allow-list (review sites, forums, Q&A → `review` / `forum`); scrub usernames.
4. **Structure call:** `ctx.ai.parse(MarketModelDraft, …)` with the evidence list (IDs + excerpts) and the brief. Segments and lexicon entries **reference evidence IDs**; they never write quotes.
5. **Validate:** keep lexicon phrases that are ≥3 words and verbatim in their referenced excerpt from a review/forum/founder source. Compute `evidenceStrength`; add warnings, never fail on counts.

## Layout

```
index.ts       export { intake, research, intakeMock, researchMock }
intake.ts
prompts.ts     INTAKE_PROMPT_VERSION, RESEARCH_PROMPT_VERSION, STRUCTURE_PROMPT_VERSION
research.ts    step 2
evidence.ts    citations → Evidence (pure, tested); domain allow-list
structure.ts   step 4 + MarketModelDraft → MarketModel mapping
*.test.ts
```

## Watch out for

- Web search errors come back as HTTP 200 with an error object; `ai.research` surfaces them as a typed failure.
- Local or niche businesses will be thin. That's a warning and a "paste your reviews" nudge, never a failed run.
- The founder's guess becomes a segment with `isFounderGuess: true`, to be *tested*, not assumed.
