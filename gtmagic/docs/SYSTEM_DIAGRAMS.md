# GTMagic system diagrams

## 1. How a run works

```mermaid
flowchart LR
  classDef in fill:#fff4e5,stroke:#e08a00,color:#000
  classDef stage fill:#e8f0fe,stroke:#3b6fd8,color:#000
  classDef code fill:#f3e8fd,stroke:#8a3bd8,color:#000
  classDef out fill:#e6f6ea,stroke:#2e9b57,color:#000

  IN["Owner<br/>'Here are my ads, which works better?'<br/>+ images or headlines"]:::in
  I["Intake<br/>gtm-intake skill<br/>brief, current ads, owner's guess"]:::stage
  R["Research → ICP<br/>Claude Opus + web<br/>customer groups, needs, barriers,<br/>verbatim quotes, sourced demographics<br/>(KFF, Gallup, Pew; else 'inferred')"]:::stage
  S["Sample the panel (code, seeded)<br/>quota on gender & age per group,<br/>1–2 personal pain points,<br/>3–5 real quotes per person"]:::code
  P["Simulated customer panel<br/>N × Claude Sonnet (high)<br/>each rates and ranks the ads,<br/>says why, would-tap or not"]:::stage
  D["Decide<br/>Claude Opus (high)<br/>panel is an input with stated reliability;<br/>concept ratings: 50/50 Opus + panel"]:::stage
  O["Result<br/>ranked ads · which group each ad wins ·<br/>reasons & objections · cheap real test plan"]:::out

  IN --> I --> R --> S --> P --> D --> O
  IN -->|ads| D
```

| Stage | Who | Output |
|---|---|---|
| Intake | `gtm-intake` skill | Business brief, the owner's current ads, the owner's guess at the customer |
| Research → ICP | Claude Opus + web search | Customer groups with weights, needs, barriers, verbatim quotes with URLs, sourced demographic distributions |
| Sample | Code (`evals/benchmarks/demographics.py`) | N simulated customers: quota sampling on gender and age, so no model "picks randomly" |
| Simulated panel | Claude Sonnet (high), one per customer | Per-customer rankings and ratings, would-tap, one-line reason |
| Decide | Claude Opus (high) | Final ranking. For concept-level audience ratings, a 50/50 blend of Opus and the panel |

## 2. What we benchmarked and where GTMagic wins

```mermaid
flowchart LR
  classDef bench fill:#fff4e5,stroke:#e08a00,color:#000
  classDef win fill:#e6f6ea,stroke:#2e9b57,color:#000
  classDef stage fill:#e8f0fe,stroke:#3b6fd8,color:#000

  P["Simulated panel"]:::stage
  D["Decide (Opus)"]:::stage
  B1["Twin-2K-500 Mega-Study, held-out test<br/>120 real people · 18 audience groups ·<br/>18 concepts, real 1–7 ratings"]:::bench
  B2["Upworthy A/B pairs<br/>100 real headline tests, real CTR"]:::bench
  P --> B1
  D --> B1
  D --> B2
  W1["Beats Claude Opus<br/>16% lower error predicting each group's ratings<br/>(0.274 vs 0.326); better on 13/18 groups"]:::win
  W2["Tops every published result<br/>on the Mega-Study benchmark<br/>(corr 0.87 vs best published 0.82)"]:::win
  W3["Picks the higher-CTR real headline<br/>68% vs 50% chance"]:::win
  B1 --> W1
  B1 --> W2
  B2 --> W3
```

Numbers, data sources and how to reproduce them: [evals/RESULTS.md](../evals/RESULTS.md). Every run, prompt, model and effort level: [evals/benchmarks/RUNLOG.md](../evals/benchmarks/RUNLOG.md).
