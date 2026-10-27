# GTMagic: what we built and what we measured

```mermaid
flowchart LR
  classDef stage fill:#e8f0fe,stroke:#3b6fd8,color:#000
  classDef win fill:#e6f6ea,stroke:#2e9b57,color:#000
  classDef bench fill:#fff4e5,stroke:#e08a00,color:#000

  IN["Owner: 'Here are my ads,<br/>which works better?'<br/>+ images / headlines"]:::stage
  R["1 · Research → ICP<br/>Opus + web<br/>segments, needs, real quotes,<br/>sourced demographics (KFF, Gallup, Pew)"]:::stage
  S["2 · Code samples the panel<br/>quota on gender & age,<br/>personal pain points, real quotes<br/>(no LLM 'randomness')"]:::stage
  P["3 · Simulated panel<br/>N × Claude Sonnet (high)<br/>rate concepts per customer group,<br/>reasons, objections"]:::stage
  D["4 · Opus decides (high)<br/>panel = input with stated reliability<br/>+ 50/50 blend for concept ratings"]:::stage
  O["Output: ranked ads,<br/>which group each ad wins,<br/>why, cheap real test plan"]:::stage
  IN --> R --> S --> P --> D --> O
  IN --> D

  B1["Mega-Study held-out test<br/>120 real people · 18 groups · 18 concepts"]:::bench
  B2["Upworthy A/B pairs<br/>100 real headline tests, real CTR"]:::bench
  P -.-> B1
  D -.-> B1
  D -.-> B2

  W1["Pipeline beats Claude Opus (high)<br/>at predicting each group's ratings:<br/>error 0.274 vs 0.326 (−16%),<br/>corr 0.871 vs 0.831, 13/18 groups"]:::win
  W2["Tops every published model result<br/>on the Twin-2K-500 Mega-Study benchmark<br/>(corr 0.87 vs best published 0.82;<br/>error 0.27 vs best published 0.46)"]:::win
  W3["Decision step picks the higher-CTR<br/>headline 68% vs 50% chance"]:::win
  B1 --> W1
  B1 --> W2
  B2 --> W3
```

## Benchmarks run (all Claude, effort high; details in [RUNLOG.md](RUNLOG.md) and [../RESULTS.md](../RESULTS.md))

| Benchmark | Real ground truth | What it tests | Headline result |
|---|---|---|---|
| **Mega-Study** (Twin-2K-500, Apache 2.0) | 300 real US adults' 1–7 ratings of 18 news-post concepts, by demographic group | Panel + decision: how each audience rates different concepts | **Opus + panel beats Opus (high) on the held-out test: MAE −16%, 13/18 groups. Tops all 6 published model results** (re-scored with the same metric) |
| **Upworthy A/B pairs** (OSF, CC BY 4.0) | 100 real headline A/B tests, real CTR | Decision: "which of my two ads?" | Opus decision step 68% vs 50% chance |
