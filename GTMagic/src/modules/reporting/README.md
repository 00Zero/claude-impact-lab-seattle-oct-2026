# reporting

**Owner:** Market Intelligence & Strategy · **Tasks:** [TASKS.md §2](../../../docs/TASKS.md) (items 6–8)

```
report(input: { brief, marketModel, positioningSets, experimentResults }, ctx) → GTMReport
toMarkdown(report: GTMReport, marketModel: MarketModel) → string
```

Turns everything into a decision a busy owner can act on. **The numbers decide, the model explains:** the recommended segment and the ICP verdict are copied from `ExperimentResults` (computed in code). The model writes the explanation, the three-line headline, and the test plan.

## Two calls, in parallel

1. **Report:** `headline` (who to target / what to say / try this week), the explanation for the computed verdict (including an honest "your guess holds"), positioning rationale, objections, and a validation roadmap ranked by cost and time.
2. **Assets:** landing hero, cold email, interview script for the top hypothesis.

## Rules

- Confidence is `exploratory` or `research-backed`, never `validated`. Never call a share a conversion rate.
- If `confidenceFlags` include `unstable-winner` or `everyone-agreed`, say plainly that the finding is weak.
- **Assets:** no testimonials, no statistics the founder didn't provide, no superlatives, no competitor names. A post-check strips violations. The UI labels every asset *Draft: verify before publishing*.
- Quote real customers only via lexicon/evidence IDs; never present simulated `reasoning` as a quote.

## Layout

```
index.ts       export { report, reportMock, toMarkdown }
prompts.ts     REPORT_PROMPT_VERSION, ASSETS_PROMPT_VERSION
report.ts
assets.ts      + post-check
markdown.ts
*.test.ts
```
