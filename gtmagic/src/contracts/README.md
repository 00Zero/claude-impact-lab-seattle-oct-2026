# contracts

**Owner:** Lead (changes need one non-author approval; see CODEOWNERS) · **Spec:** [docs/CONTRACTS.md](../../docs/CONTRACTS.md)

The shared language between modules: Zod schemas, inferred types, and validators. Every module depends on this folder; this folder depends on nothing.

## Layout (at scaffold time)

```
index.ts            re-exports everything below
envelope.ts         Artifact<T>, ArtifactKind
run.ts              Run, StepName, PipelineError
business-brief.ts   BusinessBriefInput, BusinessBrief
market-model.ts
audience.ts         AudienceConfig, SyntheticCustomer, AudienceSample
positioning.ts
experiments.ts      ExperimentRequest, Stimulus, CustomerResponse(s), ExperimentResults
report.ts
validate.ts         integrity rules (drop/fail) + quality rules (warnings): CONTRACTS.md → Validators
normalize.ts        quote/whitespace/case normalization for the verbatim check
```

## Rules

- No imports from `src/platform` or `src/modules`.
- Model-facing `*Draft` schemas do **not** live here; they're private to the module that makes the call.
- Every schema has a valid fixture in `fixtures/demo/`; tests check the fixtures still parse.
