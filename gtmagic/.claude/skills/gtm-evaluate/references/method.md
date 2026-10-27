# gtm-evaluate: method

What the step does, why, and what its numbers can and can't say. Prompt wording lives in `scripts/prompts.py` under `PROMPT_VERSION`; this file explains the design around it.

## What runs

| Role | Calls | Sees | Answers |
|---|---|---|---|
| Simulated customers | N draws (default 48), balanced across the brief's customer groups | the scenario, all ads, one customer card | a 1–5 rating per ad for "how likely would you tap Learn More", one pick or "none", a one-line reason |
| Repeats | 10 of those draws again, with the ads in reverse order | the same | the same; used only for the consistency check, never in scores |
| Judge who read the brief | one call per ordering (k for k ads) | the scenario, all ads, the same brief content the cards are built from | a full ranking |
| Judge with no brief | one call per ordering | the scenario and all ads | a full ranking |
| Plain crowd (optional, `--crowd`) | N draws | the scenario and all ads, no card | the same as the simulated customers |

Model `claude-haiku-5-5`, `output_config.effort: "low"` set explicitly, adaptive thinking left at its default, JSON-schema structured output, no temperature/top_p/top_k, no tools of any kind.

## Sampling (code, seeded)

- Every random choice comes from `Random.random()` seeded by `sha256("<seed>:<purpose>")`, so the same seed gives the same draws, orders and tie-breaks on any Python 3 version (tested on 3.9, 3.13 and 3.15).
- **Balanced, not representative:** equal draws per customer group (remainder to groups in a seeded order). The brief's `sampleShare` is ignored on purpose: comparing groups needs equal n, and it keeps the owner's own ranking of groups out of the result.
- Each draw: one value per core attribute by the brief's weights, 2 needs, 2 barriers, 2 decision criteria, one concern bundle by weight, and up to 4 real customer phrases (lexicon `voice: "customer"` only; the owner's own wording never poses as a customer).

## Presentation

- **Blind labels that follow position.** The first ad shown is "A", the second "B", and so on. Letter bias and position bias become the same thing, and the Latin square balances both. Code keeps the label → ad map for every call.
- **Cyclic Latin square** on a seeded base order: k orderings for k ads, so every ad sits in every position equally often. Draw g sees ordering g mod k (within and across groups, imbalance at most 1). With 2 ads this is AB and BA.
- Images: each ad is a promoted post in a Reddit-style feed, advertiser hidden, the image and a "Learn More" button, **no headline**. Headlines: a text-only promoted post with the headline as the title and the same button. The owner's own button text isn't tested.
- Calls run in a seeded shuffled order, so a spend cap or a burst of rate limits thins every group and ordering evenly instead of cutting one off.

## Scoring (code only)

- Simulated customers and crowd: per ad, rating counts 1–5, mean rating, picks, pick share (picks ÷ answered draws), and the "none" count. **Ranking: mean rating, then pick share, then a seeded coin flip.** Means are exact fractions, so a tie is a real tie.
- Judges: Borda points (k−1 for first place down to 0), summed over orderings; ties by a seeded coin flip.
- A tie settled by the coin is marked `tied` with an average rank, and the summary says so in words.
- Consistency: of the repeats that could be compared, how often the pick stayed the same, next to the agreement two independent picks from the run's own pick mix would reach (Σp² over each ad and "none"), and how far ratings moved on average.
- Flags (warnings, never failures): `aborted`, `no-answers`, `many-skipped` (under 80% of draws answered), `budget-cap-reached`, `position-imbalance` (skips left an ad shown in some positions noticeably more than others), a judge that lost orderings (its points are no longer position-balanced), and a judge that ranked whichever ad was shown first as best every time (position-driven).

## Failure and cost

- One retry on rate limits, overload, server errors and network failures, then the call is skipped and the run goes on. Refusals, cut-off replies and drafts that don't check out (every ad rated 1–5 exactly once, a pick that was shown, a ranking that uses every label once) are skipped too, with the reason recorded.
- Two things stop a run early: a 4xx that will fail every call the same way (a bad request, a bad key, an image too large), and an unexpected error in the code. No further calls are sent; the rest are recorded as `aborted`; the files are still written and sealed; the ledger says `aborted`; the command exits 2.
- The estimate comes from code: image tokens by the API's patch formula (⌈w/28⌉ × ⌈h/28⌉ after downscaling, at most 4,784), text from characters, 1,000 output tokens a call expected. The worst case per call covers both attempts (a lost first attempt may still be billed), each at twice the estimated input plus every output token `max_tokens` (4,000) allows, at $0.10 / $0.50 per million tokens. It's a ceiling, not a forecast: expect the expected figure. A live run needs `--max-usd` and refuses when the expected cost is above it (under `--blind`, when the worst case is). Each call reserves its worst case before it's sent, calls are admitted in the seeded order, and an attempt that returns no usage counts at its worst case (every charge stays within the call's reservation), so the cap holds and the calls it cuts are always the last ones in the seeded order.

## Outputs

`run.json` (every parameter, the design, the sha256 of the brief, the scenario, every ad and every script, the Python version, the model check, cost), `personas.jsonl`, `responses.jsonl` (raw reply text, the parsed draft and the mapped result for every call, answered or not), `results.json`, `summary.md`, and `outputs.sha256` (written last; its last line is one digest for the whole run). Every run start and end is appended to `ledger.jsonl` in the folder above the run.

`verify <folder> [--digest <hex>]` trusts nothing derived in the folder: it re-checks every hash (and the published digest, if given), rebuilds the call plan from the seed and checks every record against it, re-derives every answer from its raw reply text with the same code the run used, and recomputes `results.json`. Without a digest published outside the folder, someone who rewrites the files and re-seals them can't be caught; with one, they can.

## What this is not

- **Not people.** 48 draws are 48 correlated outputs of one model reading cards built from one brief. More draws narrow the noise in the simulation, not the gap between the simulation and a market.
- **Not a forecast, not a click-through rate, not validated.** It's a structured, reproducible way to say which ads are worth real-money testing first.
- **Side by side, not a feed.** Everyone sees all the ads at once and is asked to compare; in a real feed each person sees one ad, once, while scrolling.
- Images are shown without their titles; real image ads usually have one.
- The cyclic Latin square balances positions but not which ad comes right before which (carryover).
- No confidence intervals or bootstrap in v1; small gaps can be noise. Read the counts.

## Before a known-answer test

A known-answer test (ranking real ads blind, then comparing with sealed real results) only means something if the analysis is fixed before anything runs. Before the one live run on real ads, commit a protocol that names:

1. the primary instrument and metric (for example: simulated customers, mean rating; the judges and crowd as secondary), and the comparison statistic with its chance rate (a top-1 hit with 2 headlines is a coin toss, so that arm is weak by design);
2. how the real figure per ad is computed from the sealed data, and how real near-ties are handled;
3. the seed, N, `PROMPT_VERSION`, the commit and `codeSha256`, and the sha256 of the brief (pass it as `--intake-sha256`), the scenario and every ad;
4. that there is exactly one live run, with `--blind` and a `--max-usd` that covers the worst case, and no dry runs on the real ads (mock runs are fine: they call no model);
5. that the outputs digest is published (committed or sent) right after the run, before anything is unsealed, and that the comparison starts with `verify <folder> --digest <that digest>`;
6. what a run that stops early means: an `aborted` run (a setup fault such as a bad request or key) is not a result, and whether one re-run is allowed after fixing the fault. Every attempt stays in the ledger either way.

The ledger, the digest and `verify` make the run auditable; keeping the real results sealed (and out of this machine's prompts) is the protocol owner's job, not this script's.
