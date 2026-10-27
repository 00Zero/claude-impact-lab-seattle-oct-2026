---
name: gtm-creatives
description: Writes draft ad wording (headline, the line under it, a button) for a small business's researched customer groups, using GPT Sol through OpenRouter and the headline principles from gtm-ad-wording, then checks every draft and hands the clean ones to the evaluation step. Use after gtm-research recommends generating creatives, or when someone with a ready intake.json asks for ad copy or headlines to test. Optional: skip it when the owner already has creatives to evaluate.
---

# GTMagic creatives

You run a script that asks GPT Sol (through OpenRouter) for draft ad wording, built from the owner's brief and the headline principles learned from real A/B tests. Scripts build what the writer sees, check every draft, and write the files. You get the owner's OK on cost, run the script, and explain the result in plain words. You never write or edit the drafts yourself.

- Design, the checks and why a different model writes the copy: `docs/skills/CREATIVES.md`
- The principles: `../gtm-ad-wording/references/headline-principles.md` (this skill needs gtm-ad-wording and gtm-message-test installed alongside it)

## Honesty rules (non-negotiable)

- Every draft is a **draft, not tested yet**. Never call one "best", "winning", "proven" or "validated", and never rank them: the evaluation step does that.
- "The writer says it uses principle 3" is the writer's own claim, not a score.
- The principles are a checklist, not a predictor: on 400 held-out tests they showed no clear edge over plain Claude.
- A dropped draft stays dropped. Never rewrite one to get it past the checks, and never edit a kept one. If the owner wants their own wording, add it through gtm-intake as their own draft creative, so it's tested as theirs.

## Where this fits

1. `gtm-intake` → 2. `gtm-research` → **3. this skill (optional)** → 4. simulated customers → 5. `gtm-message-test` or `gtm-evaluate` → 6. summary.

**Skip it** when the owner already has creatives to compare (2 or more in `intake.json`, or research recommended evaluating them): say so and go to step 5. The script refuses in that case unless you pass `--alongside`, which you do only if the owner wants new drafts next to theirs.

**Don't run it** when `readiness.status` isn't `ready` (back to gtm-intake) or research said to refine or fix its setup (back to gtm-research). The script checks both and says why.

## Flow (Claude Code)

Work in `gtm-workspace/<business-slug>/` (gitignored). Paths below are relative to this skill's folder.

1. **Tell the owner what leaves their machine**, once: "To write drafts, I'll send a summary of your brief to GPT Sol through OpenRouter: your business description and price, your customer groups' needs and worries, and the short customer phrases from research. No customer quotes, links, or your sales figures."
2. **Estimate and OK:**
   ```
   python3 scripts/generate.py estimate <ws>/intake.json [--alongside]
   ```
   Tell the owner the plan and the worst-case cost the script printed, in plain words ("8 drafts; at most 41 cents, and usually a few cents"), and get an explicit OK. No OK, no live run.
3. **Run:**
   ```
   python3 scripts/generate.py run <ws>/intake.json --out <ws>/creatives [--alongside] [--max-usd 0.50]
   ```
   Exit 0: enough clean drafts (5 or more). Exit 1: too few passed (files are still written; show the owner what was dropped and why, and offer one more run into a new `--out`). Exit 2: bad input, bad setup, or the first call failed, with the reason printed. Tell the owner plainly and don't work around it. If only the second call failed, the first call's drafts are kept and a warning says so.
4. **Show the drafts** from `<ws>/creatives/creatives.md`: grouped by customer group, each with the customer words it borrows and the product claims it makes ("Claims to confirm are true"). Say they are drafts. Ask the owner to confirm the claims and whether to drop any before testing. To drop one, remove its option from `message-drafts.json` and its line from `headlines.txt`.
5. **Hand off** to the evaluation step the owner chose:
   - `gtm-message-test`: skip its Step 1 (drafting) and pass `<ws>/creatives/message-drafts.json` as the drafts file to `build_test.py`. It's the format it expects; the first options are spread across customer groups, and the rest are spares.
   - `gtm-evaluate`: pass `--headlines <ws>/creatives/headlines.txt`. Tell the owner these are drafts written by GPT Sol, not their own ads; the file itself can't carry that label.

Say "customer group", "draft", "the line under the headline", "button". Never say segment, lexicon, hypothesis, ICP or CPA to the owner.

## Files it writes (`<ws>/creatives/`)

| File | What |
|---|---|
| `generated.json` | The run record: writer model, prompt version, input hashes, each call (failed ones too) with its OpenRouter id, tokens and cost, and every draft, kept or dropped, with the reason. Later steps read the writer's model from here |
| `message-drafts.json` | Kept drafts in gtm-message-test's format |
| `headlines.txt` | Kept headlines, one per line, for gtm-evaluate |
| `creatives.md` | The owner's view |
| `raw/call-<n>.json` | The writer's replies as they came, for audit |

Generated drafts never go into `intake.json`'s `creatives[]`: that list is the owner's own work.

## Scripts

Python 3.9+ standard library only. Claude Code only: the script needs network access and your Keychain.

| Script | Does |
|---|---|
| `generate.py` | `estimate` and `run`: the gate, the cost cap, the files |
| `writer.py` | The request, the cost ceiling, and at most 2 calls with the checks between them |
| `brief.py` | The gate, and the allow-listed brief the writer sees (nothing else is ever sent) |
| `prompts.py` | The writer's prompts and reply schema (`PROMPT_VERSION`) |
| `checks.py` | Cleans every field the writer returns, then every check a draft must pass, using gtm-message-test's copy rules |
| `render.py` | The output files |
| `openrouter_client.py` | Key loading, the model's price, the call, one retry, key redaction |

**API key:** read from `GTMAGIC_OPENROUTER_API_KEY`, else the macOS Keychain item `gtmagic-openrouter` for the current user (the README's key setup script stores it there). Never ask anyone to paste a key into the chat, and never print it. If it's missing, the script says how to add it.

**Model:** `openai/gpt-6.1-sol` by default (`--model` to change it). Each call caps the price at the model's list price (some GPT Sol endpoints cost 6 times more), refuses providers that store prompts or train on them (this isn't zero data retention), and requires structured output, so the estimate is a real ceiling.

Tests, from the repo root: `python3 -m unittest discover -s .claude/skills/gtm-creatives/tests`.

## Demo mode

If the user says "demo":
- Copy `fixtures/demo/intake.json` into `gtm-workspace/keepstrong-demo/` and work there. Never write into `fixtures/`.
- The demo owner already has 3 ads, so pass `--alongside`. Run with `--mock`: it replays a hand-written stand-in reply (`fixtures/demo/creatives/writer-reply.json`) through the real checks, with no key and no network. Say it's a stand-in, and label the business "(fictional)".
- The stand-in includes four drafts that break a rule on purpose (a quotation, an invented number, a superlative, a copied customer quote), so the owner sees the checks working and the second call being made.
