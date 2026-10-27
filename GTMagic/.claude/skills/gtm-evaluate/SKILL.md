---
name: gtm-evaluate
description: Ranks a small-business owner's existing set of ads (images, or headlines) against each other using GTMagic's simulated customers built from their intake brief. Use after gtm-research recommends evaluating existing creatives, or when someone asks which of their own ads or headlines simulated customers would tap.
---

# GTMagic evaluate

You rank one set of the owner's existing ads, all of one type (images, or headlines), by asking simulated customers drawn from their brief which they'd tap, plus two judges and an optional plain crowd as cross-checks. The scripts do all sampling, ordering, counting and ranking; you choose the inputs, get the owner's OK on cost, run the script, and explain the result in plain words.

- Method, what the numbers mean, limitations, and running a known-answer test: `references/method.md`
- Every prompt and schema: `scripts/prompts.py` (`PROMPT_VERSION`)

## Honesty rules (non-negotiable)

- **Everything is simulated.** Say "simulated customers" or "simulated draws", never people, respondents or users. Draws are correlated outputs of one model.
- Never call a number a click-through rate, a conversion rate, a prediction, a forecast, or "validated". It's which ad simulated customers preferred, in this setup.
- Always show counts with shares ("picked by 14 of 46 simulated draws"), never a bare percentage.
- The simulated one-line reasons are model text: never put them in quotation marks or attribute them to anyone.
- Don't tune. Pick the seed before running and keep the first run; don't re-run with new seeds, wording or settings to get a different winner. Every run (mock or live) is logged in `ledger.jsonl` next to the run folders.

## Keep it blind

- **Images must be the original ad files**, not screenshots of a live post or an ads dashboard. Look at each image before a live run. If it shows vote counts, comments, likes, view counts or any results, stop and ask the owner for the original file. Say this to the owner plainly, once.
- **The scenario says only where and when** someone sees the ads (platform, device, moment, what they were reading). Never results, never which ad the owner likes. The script warns if the scenario mentions results-like words; fix the scenario rather than ignoring the warning.
- Don't tell the script which ad is the owner's favorite, and don't add anything to the brief or scenario after seeing results.
- The script reads only allow-listed brief fields (customer groups' description, attributes, needs, barriers, decision criteria, concerns, and real customer phrases). It never sends ad results, the owner's copy, file names or anything else from `intake.json`. If the brief already holds ad results, it warns that the run isn't blind (the groups may have been shaped by them); `--blind` turns that into a refusal.

## Flow (Claude Code)

1. **Inputs.** Find `gtm-workspace/<slug>/intake.json`. Choose one asset set:
   - images: copy the owner's original files into `gtm-workspace/<slug>/sources/` and pass them with `--images`;
   - headlines: write them one per line to a text file in the workspace, verbatim, and pass `--headlines`;
   - or the brief's own creatives: `--creatives image` or `--creatives text` (optionally `--creative-ids cr_1,cr_3`).
   Text ads are shown as the headline only, with a "Learn More" button; images are shown with no headline. 2 to 12 ads.
2. **Scenario.** Write `gtm-workspace/<slug>/evaluate/scenario.txt`: one or two sentences on where and when the person sees the ads. Confirm it with the owner.
3. **Seed.** Choose an integer and tell the owner before running.
4. **Estimate and OK.** Run `estimate`, then tell the owner in plain words what will run, the expected cost, and the cap that covers every call even in the worst case. **Get an explicit OK and agree a spend cap before any live run.** Recommend the worst-case figure as the cap, so no calls get cut. No OK, no live run.
5. **Run.** `run --max-usd <cap>` into a new folder `gtm-workspace/<slug>/evaluate/<type>-seed<seed>/` (keep every run under that `evaluate/` folder, so they share one ledger). Add `--crowd` if the owner wants the plain crowd too (it doubles the cost). A live run first checks through the Models API that the model takes effort "low", structured outputs, and images (for an image run), and stops clearly if not. If the API rejects a request outright (a bad request, a bad key, an image too large), the run stops sending at once, still writes and seals its files, and exits 2: tell the owner what went wrong instead of re-running blindly.
6. **Verify.** Note the outputs digest printed at the end of the run, then run `verify <folder> --digest <it>`; it must print "verified". For a known-answer test, publish (commit or send) that digest before anything is unsealed (`references/method.md`).
7. **Explain** (from `summary.md` and `results.json` only; never compute numbers yourself). If the run stopped early, say so and what went wrong, and present no ranking: it's incomplete, not a result. Otherwise, in this order:
   1. which ad the simulated customers preferred, with its counts, and how close the next one was;
   2. whether the two judges and the crowd agreed or not;
   3. the consistency check, against its chance level;
   4. flags and warnings that matter, in plain words (thin customer voice, skipped draws, ties settled by a coin flip);
   5. the disclaimer, and what to do next: the ranking says what to test first with real money, not what will win.

## Scripts

Paths are relative to this skill's folder. Python 3.9+ standard library only.

```
python3 scripts/evaluate.py estimate --intake <intake.json> --scenario-file <scenario.txt> --seed <n> --images <files...>
python3 scripts/evaluate.py run  --intake ... --scenario-file ... --seed <n> --images <files...> --out <new folder> --max-usd <cap>
python3 scripts/evaluate.py verify <run folder>
```

Asset options: `--images FILE...` | `--headlines FILE` | `--creatives image|text [--creative-ids ...]`. Others: `--n 48` draws, `--repeats 10`, `--crowd`, `--blind` with `--intake-sha256 <hex>` (a blind run: refuses a brief that carries ad results or isn't exactly the frozen one, a scenario with results-like words, and a cap below the worst case). `verify <folder> --digest <hex>` also checks the run against its published digest. Exit code 2 means bad input, bad setup, or a run that stopped early, with the reason printed; tell the owner plainly and don't work around it.

**API key:** read from `GTMAGIC_ANTHROPIC_API_KEY`, else the macOS Keychain item `gtmagic-anthropic` for the current user. Never ask anyone to paste a key into the chat, and never print it. If it's missing, the script says how to add it.

## Demo mode

If the user says "demo", run with `--mock` on the fiction in `fixtures/demo/evaluate/` (see its README) against `fixtures/demo/intake.json`. Mock replies are seeded noise: say so, and never present a mock ranking as a finding. The demo brief carries fictional ad results, so the "not a blind test" warning is expected.
