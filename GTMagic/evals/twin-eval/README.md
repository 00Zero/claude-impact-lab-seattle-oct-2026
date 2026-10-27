# twin-eval: does a simulated customer answer like a real one?

A simulation-realism check for GTMagic, using [Twin-2K-500](https://huggingface.co/datasets/LLM-Digital-Twin/Twin-2K-500) (2,058 real US adults, about 500 survey questions each, CC BY 4.0, Toubia et al. 2025, arXiv 2505.17479).

Each simulated person is paired with one real survey taker (their "twin"), built from the twin's earlier answers (waves 1–3), and scored against what the twin actually answered two weeks later (wave 4).

It answers the "Why not just use Claude?" question for the simulation step, comparing five ways of building the simulated person:

| Arm | What the simulated person knows | Stands for |
|---|---|---|
| `vanilla` | Nothing. "A randomly selected US adult." | Plain Claude |
| `invented` | Demographics Claude makes up first | LLM-sampled personas |
| `demographics` | The twin's real 14 demographic answers, set by code | Programmatic sampling from real data |
| `voice` | The above, plus their spending habits and their own words describing themselves | Real quotes on top of demographics |
| `gtmagic` | The twin as a GTMagic customer: customer group, core attributes, 3–5 of their own sentences as quotes. No demographics. | **GTMagic's actual customer card** |

## What gets measured

- **Pricing (40 grocery products, "would you buy it at this price?")**: how often the simulated person makes the same call as their twin, and whether the simulated buy rate per product tracks the real one.
- **Framing (13 experiments)**: the same decision worded two or three ways, for example "200 saved" vs. "400 die", or $10 off a $30 calculator vs. a $250 jacket. Real people saw one version each, and the real difference between versions is a wording effect. Each simulated person sees the version their twin saw. The check: does the simulated audience shift in the same direction, by a similar amount?
- **Spread**: are the simulated answers as varied as real people's, or does everyone give the same answer (the "LLM averaging" risk)?
- **Invented personas**: when Claude makes up the people, how far their demographics drift from the real population.

Every score sits between a **ceiling**, the twin's own answer to the same question two weeks earlier (84% on pricing), and a **floor**, the most common answer for everyone (55% on pricing).

## Run it

```bash
cd evals/twin-eval                       # from the repo root
pip install -r requirements.txt          # only needed for live runs
python3 -m twin_eval download            # 3 files, ~26 MB, pinned revision
python3 -m twin_eval run --mock --n 50 --out out/mock   # FAKE random answers, no key needed
```

Live (needs `ANTHROPIC_API_KEY`; a Claude Max plan doesn't cover API calls):

```bash
python3 -m twin_eval run --n 200 --out out/haiku-200
```

- Default model is `claude-haiku-5-5` (the team's simulation model), at effort `low`. Use `--model`, `--effort`, `--arms vanilla,gtmagic`, and `--concurrency` to change it.
- One call per person per arm (plus one more for `invented`). The 40 pricing questions sit in a cached system prompt.
- On Haiku 5.5, 200 people × 5 arms is roughly $1.50–2.50, and all 2,058 people is roughly $20. These are estimates; the report prints the actual cost.
- Responses are saved as they arrive (`out/<run>/responses-<arm>.jsonl`). Re-running the same command resumes: answered people aren't asked again, skipped ones are retried, and a line half-written by a crash is skipped with a warning. Adding arms to a run is fine, but a resume with a different model, effort, `--n`, seed, prompt version, or (once the `gtmagic` arm has answers) a different or edited `--card-module` stops and asks for a new `--out`.
- Failed or refused calls, and responses that answer fewer than half the pricing questions (`skipReason: "incomplete"`), are recorded as skipped and shown in the Skipped column. Tokens billed for them still count toward the reported cost.
- `python3 -m twin_eval report --out out/haiku-200` re-scores saved responses without calling the API, for the same people (`n` and seed from the run's `run.json`).
- `python3 -m twin_eval preview --arm voice` prints exactly what one simulated person sees.

Output: `report.md` (scorecard first) and `report.json` (every number, with counts and n).

## How it fits GTMagic

Lives in `evals/twin-eval/` and needs nothing else from the repo. Checked against `main` after the creatives intake (#6), and against the gtm-message-test skill (`.claude/skills/gtm-message-test/`). Exported lexicon entries carry `voice: "customer"`, since the simulation reads only customer voice.

- **Same customer shape.** On `main`, the simulation skill reads intake.json `segments[]` and `lexicon` and builds `SyntheticCustomer`s (docs/CONTRACTS.md): six core attributes, needs/barriers/criteria, and real quotes. The `gtmagic` arm builds each twin in that shape (`twin_eval/gtmagic.py`):
  - **Group:** household income band (three groups).
  - **Role:** employment, marital status, household size.
  - **Price sensitivity:** from the tightwad–spendthrift scale.
  - **Quotes:** 3–25-word sentences, verbatim from the twin's own self-description, held as lexicon entries backed by evidence, under the same rules intake uses.
  - Current solution, urgency, skepticism and buying stage have no source in Twin, so they're left out.
- **Use the real card renderer.** Once the simulation skill has its own card renderer, point the eval at it: `--card-module path/to/card.py`, where the file defines `render_card(customer, intake) -> str`. Until then, the default card follows ARCHITECTURE.md (group, attributes, needs, voice).
- **Run the twins through the real simulation.** `python3 -m twin_eval export-audience --n 200` writes:
  - `audience-sample.json` (CONTRACTS `AudienceSample`, `cust_r1_N` IDs);
  - `twin-intake.json`, which holds only the intake fields the simulation skill reads;
  - `twin-map.json`, mapping customer IDs back to twins.

  These files are for running the twins through the simulation skill once it exists. They aren't meant for gtm-message-test's `build_test.py`: the twins' groups are income bands, not a business's customer groups, and `twin-intake.json` holds only the simulation's fields (no `readiness`), so the message test would refuse it.
- **Team conventions followed:** Haiku 5.5 by default; no temperature (the API rejects it); effort set explicitly; a `PROMPT_VERSION`; every simulated number labeled simulated; `schemaVersion: 1`, with a `_note` starting `FAKE` on mock output; the mock and the tests use the standard library only.
- **What to watch in a live run:** if `demographics` or `voice` beat `gtmagic`, the customer card is missing signal. intake.json already has `interests[].demographics`, which could feed the card.

## Tests

```bash
python3 -m unittest discover -s tests
```

No key or network is needed. The tests run on an 80-person slice of the real data in `tests/fixtures/` (rebuild it with `python3 tests/make_fixture.py`). Among other things, they check that a responder giving the twin's exact answers scores 100%, and that scoring the twin's earlier answers reproduces the ceiling.

## Limits

- Answers are stated survey responses from a general US sample buying groceries. They are not ad clicks, and not a business's niche (GLP-1 users, for example).
- This tests the simulation step only. It doesn't test research, positioning, or which message GTMagic recommends. For that, use a real headline A/B dataset such as the Upworthy Research Archive.
- Live mode hasn't been run yet; it was built on a machine with no API key. The mock run and the tests cover everything except the API call itself.
