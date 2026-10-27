---
name: gtm-message-test
description: Tests competing marketing messages on simulated customers built from a ready intake.json (gtm-intake's save file), then reports which message and which customer group responded best, with honesty checks. Use when someone has an intake.json and wants to test headlines or messages ("which headline works?", "test my messaging"). Without an intake.json, use gtm-intake first.
---

# GTMagic message test

You turn a ready `intake.json` (from `gtm-intake`) into a blind message test, hand it to the simulation, then score what comes back and explain it. You write the options and tag objections; scripts check the copy and compute every number.

- Method, thresholds and proposed additions: `references/method.md`
- File formats and who writes each field: `references/schema.md`

## Principles

1. **Code computes every number:** counts, shares, ranges, verdicts and checks. Quote only numbers the script wrote.
2. **Options borrow real customer words.** Each option cites at least one customer-voice `lexicon` phrase from intake.json (`voice: "customer"`; the owner's own ad copy doesn't count). Never invent a quote.
3. **"No clear winner" and "unreliable" are valid, useful results.** Nothing pressures you to crown a message.
4. **Simulated is always labeled simulated.** Never call a share a conversion rate, or show a simulated objection as a real quote. Real quotes come only from intake.json `evidence`.

## Files

Work in the same folder as gtm-intake: `gtm-workspace/<business-slug>/` (gitignored). In Claude chat, use the sandbox working folder: ask the owner to upload their `intake.json` ("your GTMagic save file"), and at the end offer `results.md` and `experiment-results.json` as downloads. Pass that folder to every script as `<ws>`; never write into `fixtures/`.

| File | Written by | When |
|---|---|---|
| `intake.json` | gtm-intake | Before you start |
| `message-drafts.json` | You | Step 1 |
| `positioning-set.json`, `experiment-request.json` | `build_test.py` | Step 2 |
| `audience-sample.json`, `customer-responses.json` | The simulation skill | Step 3 |
| `themes.json` | You (tags only) | Step 4 |
| `experiment-results.json`, `results.md` | `evaluate.py`, `render_results.py` | Step 5 |

## Before you start

- `readiness.status` in intake.json must be `ready` (`build_test.py` refuses anything else).
  - `no-supported-segment`: stop. Tell the owner plainly there's no customer group to test messages on yet.
  - `needs-more`: send them back to gtm-intake.
- **The current message** is the control. If it's one of intake.json's `creatives[]` (a live or past ad, or the website headline), pass its id with `--current-creative` and the script copies the owner's words itself. Otherwise ask: "What's the headline on your website or app store page today, and the line under it?" and pass their exact words with `--current-headline` / `--current-subheadline`. If they have none, the test runs without a control; say so.
- **A decoy category:** one to three generic words for what the business is ("fitness app", "bakery", "accounting software"). The script builds a deliberately generic decoy from it.

## Step 1: draft the options

Write 6–8 options in `message-drafts.json`, best first. The script needs 4 (5 if there's no current message) and uses the rest as spares when some fail the checks.

- Start from intake.json `roughMessaging`, then add distinct angles from the segments' needs, barriers and concerns. One angle per option, and about the same number of options aimed at each customer group: the group comparison mostly reflects who the messages were written for, and the script warns when it's lopsided.
- Each option: `angle`, `headline` (≤ 10 words), `subheadline` (≤ 30 words), `targetSegmentIds`, `lexiconIds` (the real phrases it borrows, at least one), `evidenceIds`, `valueProposition`, `differentiator`, `callToAction`, `assumptions`.
- **Really use the phrase you cite**, in what customers see: at least half of one cited phrase's key words must be in the headline (plus the subheadline, when options show one), the same rule gtm-intake applies to its messaging lines. If the test is headline-only, put the borrowed words in the headline.
- **Messaging rules** (gtm-intake's rule list, plus intake constraints with `appliesTo` messaging or all; the medical and drug rules apply only to health-related businesses, see `references/method.md`):
  - No medication or drug names, brand or generic, GLP-1 included.
  - Don't assume the reader's condition ("Are you on…?", "your shots").
  - No superlatives or guarantees, no medical claims, no weight-loss numbers.
  - No testimonials or ratings, no competitor names.
- Don't write the current message or the decoy; the script adds both.

## Step 2: build the test

```
python3 scripts/build_test.py <ws>/intake.json <ws>/message-drafts.json --out-dir <ws> \
  (--current-creative <cr_id> | --current-headline "<exact words>" --current-subheadline "<exact words>") --category "<decoy category>" \
  [--audience <ws>/audience-sample.json] [--channel landing-page|ad|email]
```

- It exits 1 when too few options pass. Read each `WARNING` (why an option was dropped), draft replacements, and re-run.
- If the current message has no subheadline, every option shows its headline only, so the test stays fair.
- Show the owner the final options in plain words, including the decoy as a deliberately generic control, and confirm before simulating. Labels and IDs are internals; never put them in front of the owner or the simulated customers.

## Step 3: simulate

The simulation skill reads `experiment-request.json` and writes `customer-responses.json`. What it must show and record is in `references/schema.md` → "For the simulation skill".

No simulation yet? `python3 scripts/fake_responses.py <ws>/intake.json <ws>/positioning-set.json <ws>/experiment-request.json --out <ws>/customer-responses.json` writes FAKE responses for testing. Everything downstream then says FAKE; never present it as a finding.

## Step 4: tag objections

```
python3 scripts/evaluate.py <ws>/intake.json <ws>/positioning-set.json <ws>/experiment-request.json <ws>/customer-responses.json --list-objections
```

Define 3–6 themes (`th_<word>`, one plain sentence each) and tag every objection with one theme in `themes.json`. Don't count anything; the script does.

## Step 5: score and explain

```
python3 scripts/evaluate.py <ws>/intake.json <ws>/positioning-set.json <ws>/experiment-request.json <ws>/customer-responses.json \
  --themes <ws>/themes.json --out <ws>/experiment-results.json
python3 scripts/render_results.py <ws>/experiment-results.json <ws>/positioning-set.json <ws>/intake.json -o <ws>/results.md
```

Explain the results to the owner in plain words, following what the script decided:

- **Message verdict:**
  - `clear-winner`: lead with it, quoting its headline exactly.
  - `no-clear-winner`: name the messages still close, and suggest a real test between them.
  - `unreliable`: the generic decoy did too well, so the ranking can't be trusted. Don't recommend a message.
- **Customer groups (ICP verdict):** `guess-holds` (say so honestly), `different-segment` (name the group that responded better), `too-close-to-call`, or `no-guess`.
- **Confidence flags** in plain words, for example "only a few people in this group" or "the top message wasn't stable".
- **What to try this week:** cheap real tests, for example the top two headlines as Meta ads judged against `business.unitEconomics.targetCpaUsed` (the owner's limit on cost per paying sign-up, computed by gtm-intake; if it's null, say there's no limit yet), or two App Store custom product pages.

Say "customer group", "message", "simulated customers", "cost per sign-up". Never say segment, hypothesis, stimulus, ICP, CPA or conversion rate to the owner.

**If a script crashes** (as opposed to reporting errors), tell the user plainly and stop. Never compute its numbers yourself. Don't hand-edit `results.md`: fix the inputs and re-render.

## Demo mode

If the user says "demo":
- Copy `fixtures/demo/intake.json` and `fixtures/demo/message-test/message-drafts.json` into `gtm-workspace/keepstrong-demo/` and work there. Never write into `fixtures/`.
- The current message is the owner's best Meta ad, creative `cr_1` ("Lose weight without losing muscle"): pass `--current-creative cr_1 --category "fitness app"`. It has no line under the headline, so the demo test is headline-only.
- Use FAKE responses (Step 3) and tag objections as usual. Label the business "(fictional)" everywhere.
- Reference outputs are in `fixtures/demo/message-test/` (`positioning-set.json` and `experiment-request.json` should match exactly; `experiment-results.json` differs if your objection themes differ).

## Scripts

Standard library only, so they run in Claude chat's sandbox too. Paths are relative to this skill's folder.

| Script | Does |
|---|---|
| `build_test.py` | Checks drafts, adds the current message and decoy, assigns blind labels and a Latin-square order |
| `ordering.py` | The Williams Latin-square orderings and the customers asked twice (used by `build_test.py`) |
| `copy_checks.py` | The messaging rules (gtm-intake's list, copied exactly, plus extra checks; medical rules only for health briefs) |
| `evaluate.py` | Checks responses against what was shown, then computes every number in experiment-results.json |
| `stats.py` | The counting, ranking, resampling and verdict rules |
| `render_results.py` | The owner-facing `results.md` |
| `fake_responses.py` | FAKE responses for testing, until the simulation skill exists |

Tests, from the repo root: `python3 -m unittest discover -s .claude/skills/gtm-message-test/tests`. They also check the demo fixtures still regenerate exactly and that the messaging rules match gtm-intake's.
