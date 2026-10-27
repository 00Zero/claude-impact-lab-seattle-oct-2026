# Creatives skill (`gtm-creatives`)

The optional third GTMagic skill. It writes **draft ad wording** (headline, the line under it, and a button) for the customer groups research backed, using GPT Sol through OpenRouter, guided by the headline principles in `gtm-ad-wording`. It's skipped when the owner already has creatives to evaluate.

> **Status:** design spec v0.3, 2026-10-25: revised after a senior-engineer design review, then built (`.claude/skills/gtm-creatives/`) and revised again after senior-engineer and GPT code reviews. Text only for v1. Claude Code only: the script needs network access and the Keychain. Not yet run against the live API.

**Principles.** The same four as intake and research: code computes every number and every decision (the model writes copy and nothing else); customer words come only from the brief's customer-voice `lexicon` (never from `evidence[].excerpt`); "too few clean drafts" is a valid result; everything the writer produces is a **draft**, labeled as one, and never ranked here.

## 1. Where it sits

| # | Step | Skill |
|---|---|---|
| 1 | Intake | `gtm-intake` |
| 2 | Research (may loop back to 1) | `gtm-research` |
| **3** | **Generate creatives (optional)** | **`gtm-creatives`** |
| 4 | Synthetic customer cohort | simulation skill (another teammate) |
| 5 | Evaluate and rank, with feedback | `gtm-message-test` or `gtm-evaluate` |
| 6 | Summary, with the assets to take to ad platforms | summary skill |

**Runs when** research recommends "Generate creatives" (RESEARCH.md §8, row 4), or the owner asks for ad wording.

**Doesn't run when** (the script refuses, with the reason):
- `readiness.status` isn't `ready` (back to `gtm-intake`).
- `research.decision` says **refine** or **fix setup** (back to `gtm-research`). The owner's recorded `ownerChoice` wins over the recommendation.
- **The owner already has creatives** (≥ 2 in `creatives[]`, or research recommended evaluating them), unless `--alongside`: the owner wants new drafts next to theirs. The demo brief has 3, so demo mode passes `--alongside`.

When `research.decision.focusSegmentIds` is set, drafts are written for those groups only.

## 2. Why a different model writes the copy

The simulated customers and the judges are Claude. Copy written by the same model family that judges it risks **self-preference**: models tend to rate their own family's writing higher. A GPT writer keeps the writer and the judges independent, and widens the range of styles in the test. This is a design hedge, not a measured effect. `generated.json` records the writer's model id so step 5 can report it.

## 3. What the writer sees (allow-listed by code)

`brief.py` builds the writer's brief from `intake.json`. Anything not listed is never sent.

| Sent | Never sent |
|---|---|
| Business name, description, price (amount, currency, period) | `evidence[]` (excerpts, URLs, titles), customer details |
| Per customer group: name, description, needs, barriers, decision criteria | Revenue goal, unit economics, ad spend and results figures |
| Concern labels and definitions, **ranked** by how often customers raised them (the counts stay local, so copy can't turn them into statistics) | Owner-voice lexicon entries |
| Customer-voice `lexicon` phrases, with their ids and groups | `imageDescription`, file names, `sources/` |
| `roughMessaging` angles and headlines (starting points, not to be copied) | Hypotheses, skeptic entries, findings |
| Messaging constraints (`appliesTo` messaging or all), in plain words | |
| The owner's past headlines: "worked: learn from it, don't copy it", "didn't work", or "no clear result" | |
| `gtm-ad-wording`'s headline principles, verbatim | |

The brief goes to OpenRouter, which forwards it to OpenAI. The skill tells the owner this once, before the first call. Each request refuses providers that store prompts or train on them (`provider.data_collection: "deny"`); that isn't zero data retention, which would rule out most GPT Sol endpoints.

## 4. Flow

1. **Gate** (code): §1. The principles file must exist.
2. **Estimate** (code): the worst case of every attempt this run could make (2 calls, each retried once at most, every completion token used) at the capped price, with the prompt counted as UTF-8 bytes ÷ 3 plus the schema and framing, and call 2's feedback capped in length, rounded up. Tell the owner the figure and get an OK. A run refuses to start above `--max-usd` (default 0.50; the demo's worst case is $0.41, a typical run a few cents).
3. **Call 1** asks for 8 options: one angle each, spread evenly across the customer groups (code sets how many per group), each borrowing a customer phrase by lexicon id, with its key words in the headline. Code checks at most each group's share; extras are ignored with a warning, so the handoff never exceeds `--count` (at most 12, gtm-evaluate's limit).
4. **Checks** (code, §5). Each option is kept or dropped with a plain reason. Nothing is rewritten.
5. **Call 2, only if fewer than 6 are kept or a group got none:** ask for each group's shortfall, sending the dropped headlines with their reasons (any headline that copied a quote is withheld, whatever else dropped it, so no evidence text reaches the prompt) and the kept headlines to avoid. Then stop: at most 2 calls a run. If call 2 fails, call 1's drafts stand; if the writer used more output than the cap, there is no call 2.
6. **Owner review:** show the kept drafts and the product claims each makes ("assumptions"), for the owner to confirm. The owner may drop any. Drafts are never edited: wording the owner wants is theirs, so it goes in through `gtm-intake` as their own draft creative.
7. **Hand off** (§6).

## 5. Checks (code)

The copy rules are `gtm-message-test`'s `copy_checks.check_copy` (which carries gtm-intake's messaging list), loaded from the sibling skill by path, so a draft that passes here also passes `build_test.py`. `checks.py` adds rules for generated copy only.

**Every field is cleaned first:** wrong types become empty (so a malformed reply drops, never crashes), text is NFKC-normalized (fullwidth letters and digits become plain ones), zero-width and other format characters are removed, and whitespace is collapsed. The cleaned values are what's checked and what ships.

| Check | Drops the option when |
|---|---|
| Shape | Headline, line under it or button missing; a line break inside any of them; headline over 10 words or 90 characters; line under it over 30 words or 240 characters; button over 5 words or 40 characters |
| Customer group | `targetSegmentId` isn't a group the brief was written for |
| Real customer words | It cites no customer-voice lexicon id, or the **headline** doesn't really use one (gtm-intake's `uses_phrase`: half the phrase's key words). Headline only, because both evaluators may show the headline alone |
| Copy rules | `check_copy` returns `block` (superlatives, guarantees, ratings, testimonials, invented statistics, competitor names; on health briefs medication names, condition assumptions and medical claims), for the copy and the button separately |
| Body results (health briefs) | Metabolism, fat-burning, detox, "for good", "permanent" |
| Invented statistics | "Hundreds / thousands / millions / dozens of", "percent" |
| The owner's exclusions | A messaging constraint's excluded value appears word for word |
| Quote overlap | 6 or more consecutive words shared with any evidence excerpt, unless the run lies inside a customer phrase's own words (RESEARCH.md §8). A reworded phrase stays allowed |
| Testimonial framing | Quotation marks (double, guillemets, ‘ and others; not ’, the usual apostrophe); first person (I, I'm, me, my) anywhere in the headline or the line under it, customer phrases included ("I'm barely eating as it is" in an ad reads as a customer talking, so the writer turns phrases into second person); third person (she, he, her, his), because principles 1, 4 and 12 pull a writer toward "a retired nurse who…" |
| Numbers | Digits the owner didn't give: only those in the business description, the price, or a customer phrase the copy really uses (citing a phrase without using it unlocks nothing) |
| Duplicates | Same headline (case and punctuation ignored) as another draft, an owner creative, or a `roughMessaging` line |

**Cautions** (kept, shown to the owner): `check_copy`'s cautions; offers the brief may not support (free, trial, cancel anytime, money back); number words ("three", "twice", "half"). **Warnings:** two drafts with the same angle; customer groups unevenly covered; the writer ran out of room; extra options ignored.

**Known gap:** a made-up person with no pronoun ("Retired nurse Linda kept muscle…") still passes; names can't be told from ordinary capitalised words reliably. The prompt forbids it, and the owner review is the backstop.

## 6. Outputs

All in `gtm-workspace/<slug>/creatives/` (gitignored). A run never writes over an earlier one without `--replace`, and refuses any `--out` under `fixtures/`.

| File | For |
|---|---|
| `generated.json` | The run record: writer model, `promptVersion`, seed, intake, principles and brief SHA-256, every call (failed ones too) with its OpenRouter generation id, tokens and cost, and every option, kept or dropped, with reasons. The total cost is `null` (unknown) when any attempt may have been billed without a figure |
| `message-drafts.json` | Kept options in `gtm-message-test`'s draft format. `targetSegmentIds` and `evidenceIds` are filled by code from the lexicon, never by the writer |
| `headlines.txt` | Kept headlines, one per line, for `gtm-evaluate --headlines` |
| `creatives.md` | The owner's view: drafts grouped by customer group, the customer words each borrows (the phrase, never the quote), the claims to confirm, and what was dropped and why |
| `raw/call-<n>.json` | The writer's replies as they came, for audit and for re-recording the demo fixture |

**Order.** `build_test.py` takes the first drafts that pass and keeps the rest as spares, so code orders kept drafts round-robin across customer groups, in the writer's order within each (the prompt says order doesn't matter, so that's not a ranking). It decides which drafts are tested first, not which is better.

**Enough drafts:** `run` exits 0 at 5 or more kept. gtm-message-test needs 4 beside the owner's current message and 5 without one, and which the owner picks isn't known yet.

Generated options are **not** added to `intake.json`'s `creatives[]`: that list is the owner's own work, and mixing in model copy would let it pose as theirs.

## 7. The model call

- **Model:** `openai/gpt-6.1-sol`, pinned rather than the `~openai/gpt-sol-latest` alias so runs stay reproducible; `--model` overrides it. At start, the script reads the model from OpenRouter's public models list and stops if it's missing, lacks `structured_outputs`, or has no price.
- **Routing:** `provider.require_parameters: true` (skip endpoints that would ignore the schema), `data_collection: "deny"`, and `max_price` set to the model's list price, because GPT Sol's endpoints range from $2 to $12 per million input tokens and $10 to $60 per million output tokens. That cap is what makes the estimate a real ceiling.
- **Request:** structured output (`response_format` JSON schema, strict, with enums for group, lexicon and principle ids); `reasoning.effort: "medium"`; a `seed`; `max_completion_tokens` 8000 (reasoning tokens count against it); `usage.include: true`. No `temperature` or `top_p` (reasoning models reject them) and no tools or web search; the client refuses to send them. **Check on the first live run:** that OpenRouter honours `max_completion_tokens` for the routed endpoint (if a reply ever reports more, the run warns and makes no call 2).
- **Prompt:** `scripts/prompts.py`, with `PROMPT_VERSION`; bump it whenever the text changes. It sends only the numbered principles (not the file's comparison procedure, which is about ranking). It adapts the news-headline principles to ads: 1 and 12 mean the reader's own scene in second person, never a made-up character; 4's payoff is what the reader gets to do; 5's first-person reactions and 10's numbers are off unless the brief supplies the number.
- **Failures:** one retry on rate limits, server errors and network failures. A rejected request (bad key, out of credit, no matching provider, bad request) stops the run with a plain message, and the files are still written. A reply that doesn't parse counts as a call with 0 options.
- **Key:** `GTMAGIC_OPENROUTER_API_KEY` (deliberately not `OPENROUTER_API_KEY`, so a stray shell key is never billed; the same rule as gtm-evaluate), else the macOS Keychain service `gtmagic-openrouter` for the current user (the onboarding script, PR #11, stores it there). Read through a pipe and checked to be one well-formed `sk-or-…` line before it reaches a header (a stray newline would make http.client print it). Never printed or logged; every message passes a redactor; redirects are never followed; an unexpected error prints a redacted one-line message, never a traceback.
- **Mock:** `--mock` replays `fixtures/demo/creatives/writer-reply.json`, a hand-written stand-in marked FAKE, through the same checks, with no key and no network. Four of its options break a rule on purpose, so call 1 keeps 5 and the mock exercises call 2. Replace it with a recorded reply after the first live run.

## 8. Honesty labels

- Every option carries `isDraft: true` and is shown as a draft, not tested yet. Mock output says FAKE and never claims GPT Sol wrote it.
- `principlesUsed` is the writer's own claim, shown as "the writer says it uses…", never as a score.
- No ranking or "best" here; step 5 ranks.
- The principles are a checklist, not a predictor: on 400 held-out tests they showed no significant edge over plain Claude Opus (gtm-ad-wording's provenance).

## 9. Layout

```
.claude/skills/gtm-creatives/          needs gtm-message-test and gtm-ad-wording alongside
  SKILL.md
  scripts/openrouter_client.py          key loading, model price, chat call, retry, redaction
  scripts/brief.py                      gate, the allow-listed writer brief, per-group allocation
  scripts/prompts.py                    PROMPT_VERSION, system and user prompts, reply schema
  scripts/checks.py                     field cleaning and §5, loading gtm-message-test's copy_checks by path
  scripts/generate.py                   estimate | run [--mock]; gate, cost cap, files
  scripts/writer.py                     the request, the cost ceiling, the two-call loop
  scripts/render.py                     generated.json, message-drafts.json, headlines.txt, creatives.md
  tests/test_checks.py, test_writer.py  brief, gate, checks; call loop, client, mock run through build_test.py
fixtures/demo/creatives/writer-reply.json
```

Standard library only (Python 3.9+), like the other skills.

## 10. Decisions and open items

**Decided** (review agreed with the defaults): text only for v1; read the principles from the sibling `gtm-ad-wording` folder (`--principles` overrides; the file's SHA-256 is recorded), so Sean's branch merges first; show the writer the owner's past headlines with their verdicts.

**Open, for the owners of the neighbouring skills:**
1. **`gtm-ad-wording` overlap.** It also writes copy and recommends 3 to test (a ranking). Agree a split with Sean in his PR, so the two skills don't trigger on the same requests. Proposal: ad-wording screens and explains the owner's own variants; gtm-creatives writes new ones in the pipeline.
2. **`gtm-message-test` pointer.** Its Step 1 tells Claude to draft `message-drafts.json` itself. One line there ("if `creatives/message-drafts.json` exists, use it") would make the handoff work when message-test is invoked on its own. Gwen's file.
3. **`gtm-evaluate` wording.** It describes its inputs as the owner's existing ads, and `headlines.txt` can't carry a draft label. Its SKILL.md should say generated drafts are labeled as such in the explanation. Its owner's file.
