# GTMagic evals

Benchmarks behind the claims in [RESULTS.md](RESULTS.md). System and benchmark diagrams: [../docs/SYSTEM_DIAGRAMS.md](../docs/SYSTEM_DIAGRAMS.md). Every run, prompt, model and effort level: [benchmarks/RUNLOG.md](benchmarks/RUNLOG.md).

| Folder | What |
|---|---|
| `benchmarks/megastudy/` | Twin-2K-500 Mega-Study `infotainment`: real people's ratings of 18 concepts by audience group (claims 1 and 2) |
| `benchmarks/upworthy-pairs/` | 100 real Upworthy headline A/B pairs with real CTR (claim 3) |
| `benchmarks/demographics.py` | Code-only quota sampling of simulated customers from sourced demographic distributions |
| `src/megastudy/`, `scripts/` | Data prep and scorers |
| `twin-eval/` | Gwen's simulation-realism check (separate tool) |

## Reproduce

```bash
npm install && npm test                      # offline
python3 scripts/prep_megastudy.py            # needs pandas + pyarrow; downloads into data/ (gitignored)
npm run megastudy -- prep && npm run megastudy -- report
python3 scripts/pipeline_blend.py            # claim 1 (needs numpy)
python3 benchmarks/upworthy-pairs/pairs.py score   # claim 3 (data prep: pairs.py prep)
```

Model outputs are produced by Claude subagents using the exact prompts and wrappers in RUNLOG.md, and are saved under each benchmark's `predictions/`.
