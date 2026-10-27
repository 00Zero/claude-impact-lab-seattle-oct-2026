# positioning

**Owner:** Positioning & Experiments · **Tasks:** [TASKS.md §4](../../../docs/TASKS.md)

```
generatePositioning(brief: BusinessBrief, marketModel: MarketModel, ctx) → PositioningSet                       // round 1
refine(brief, marketModel, round1: PositioningSet, results: ExperimentResults, ctx) → PositioningSet          // stretch: round 2
```

Writes 4–6 competing positioning hypotheses with **distinct angles**, from the business brief and the market evidence, borrowing real customer phrases from the lexicon.

## Rules

- If the brief has `currentMessage`, add it as a hypothesis with `source: "founder-current"` and angle "Your current message", so it's tested blind like the others.
- Every hypothesis has a headline + subheadline (≤30 words) in the same format; that's what customers see.
- Cite `evidenceIds` and the `lexiconIds` you borrow. Parse into a `PositioningDraft`, then map to the contract (IDs from `ctx.ids`).
- **Refine (stretch):** use objections ranked in code from `results`; copy the round-1 winner as a control (new ID, `isControl: true`, `parentId` = original); round 2 tests only the control + refined options.

## Layout

```
index.ts       export { generatePositioning, refine, positioningMock, refineMock }
generate.ts
refine.ts
prompts.ts     POSITIONING_PROMPT_VERSION, REFINE_PROMPT_VERSION
*.test.ts
```
