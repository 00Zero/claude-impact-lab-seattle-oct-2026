# Run log (runs behind the claims in ../RESULTS.md)

Rules: Claude models only; `reasoning_effort: high` on every subagent; prompts are frozen files; truth files are never shown to models; each split is scored by code. Runs that aren't part of the published claims were moved out of the repo.

## Mega-Study (claims 1 and 2)

**Data prep (code):** `python3 scripts/prep_megastudy.py`, then `npm run megastudy -- prep`. This builds `benchmarks/megastudy/` (people split 120/60/120 train/val/test, stratified by party × age, seed 20261025; truth files, blind batches, and the published reference runs from the dataset's `results.zip` as `predictions/ref-*`).

**Claude Opus (high), asked for each group's average** (`predictions/vanilla-opus-high/`):
- Model: `claude-opus-5.5`, high, 3 subagents × 6 groups.
- Prompts: `megastudy/runs/vanilla-opus/<group>.md` (template `prompts/vanilla-segment-v1.md`).
- Wrapper (verbatim; ids and part letters vary):
```
Strict rules: read ONLY the files named below. Do not open any other file, do not list directories, do not search the web, do not run code, and do not start sub-agents or delegate. Treat each prompt file as a separate, independent question: answer each one only from what that file says.

For each segment id below, read /home/sean/Documents/claude-hacathon/GTMagic/evals/benchmarks/megastudy/runs/vanilla-opus/<id>.md and answer it exactly as it asks.
Segment ids: all, party-rep, party-dem, party-ind, ideo-con, ideo-mod

Write one JSON object to this new file with the create tool, mapping each segment id to the JSON object you returned for it:
/home/sean/Documents/claude-hacathon/GTMagic/evals/benchmarks/megastudy/predictions/vanilla-opus-high/segments-part-a.json
For example {"all": {"c01": 2.4, ...}, "party-rep": {...}}. Then reply "done".
```
- Parts are in `predictions/vanilla-opus-high/parts/`, merged by code into `segments.json`.

**Simulated panel** (`predictions/sonnet-persona-demo/`):
- Model: `claude-sonnet-5.5`, high, 10 people per subagent: 6 subagents on val, 12 on test.
- Prompts: `megastudy/runs/persona-demo/<id>.md`, using the Twin-paper template `prompts/vanilla-twin-v1.md` with only the person's demographics section.
- Wrapper (verbatim; ids and file numbers vary):
```
Strict rules: read ONLY the files named below. Do not open any other file, do not list directories, do not search the web, do not run code, and do not start sub-agents or delegate. Each file describes a different person: answer each one only as that person, independently of the others.

For each id test-p001 through test-p010, read /home/sean/Documents/claude-hacathon/GTMagic/evals/benchmarks/megastudy/runs/persona-demo/<id>.md and answer it exactly as it asks.

Write one JSON object to this new file with the create tool, mapping each id to the JSON object you returned for it:
/home/sean/Documents/claude-hacathon/GTMagic/evals/benchmarks/megastudy/predictions/sonnet-persona-demo/test-1.json
For example {"test-p001": {"c01": 2, ...}, ...}. Then reply "done".
```

**Scoring (code):**
- `scripts/pipeline_blend.py`: claim 1, the 50/50 blend fixed in advance.
- `npm run megastudy -- report` → `megastudy/RESULTS.md`: claim 2.
- Results (test): pipeline card r 0.871 / MAE 0.274 vs Opus 0.831 / 0.326. Panel alone 0.86 / 0.34. Best published 0.82 correlation / 0.46 error.

## Upworthy pairs (claim 3)

**Data prep (code):** `python3 benchmarks/upworthy-pairs/pairs.py prep`.
- Source: the `Yanjo/headlines-ctr` holdout pairs, with ledes from the OSF archive.
- Selection: 100 pairs, one per article, |z| > 1.96, at least 1,000 impressions each; A/B order randomized (seed 20261025).
- Output: `truth.json`, `tasks.json`, `batches/pairs-1..4.json`.

**Claude Opus (high)** (`predictions/vanilla-opus/`):
- Model: `claude-opus-5.5`, high, 2 subagents × 2 batches of 25.
- Prompt: `prompts/vanilla-v1.md`.
- Wrapper (verbatim; X/Y = 1/2 and 3/4):
```
Strict rules: read ONLY the files named below. Do not open any other file in the repository, do not list directories, do not search the web, do not run code, do not start sub-agents or delegate, and do not try to look up these headlines anywhere. Use only your own judgment.

Instructions file: /home/sean/Documents/claude-hacathon/GTMagic/evals/benchmarks/upworthy-pairs/prompts/vanilla-v1.md — follow the prompt in it exactly.

Do it separately for each of these files:
1. /home/sean/Documents/claude-hacathon/GTMagic/evals/benchmarks/upworthy-pairs/batches/pairs-X.json → write the JSON object to /home/sean/Documents/claude-hacathon/GTMagic/evals/benchmarks/upworthy-pairs/predictions/vanilla-opus/pairs-X.json
2. /home/sean/Documents/claude-hacathon/GTMagic/evals/benchmarks/upworthy-pairs/batches/pairs-Y.json → write the JSON object to /home/sean/Documents/claude-hacathon/GTMagic/evals/benchmarks/upworthy-pairs/predictions/vanilla-opus/pairs-Y.json

Each output must contain only the JSON object, with every pair id of its file. Create each with the create tool. Then reply "done".
```

**Scoring (code):** `python3 pairs.py score`. Result: 68/100 picked the higher-CTR headline [58, 77]; chance 50%.
