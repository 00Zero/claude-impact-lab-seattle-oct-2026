# Tasks

Five owners, three checkpoints. **MVP** tasks are required for the demo. **Stretch** tasks start only after Checkpoint 2 passes. Each task should take less than half a day.

## Checkpoints

The hackathon length is still to be confirmed, so timing is a share of the total.

| Checkpoint | When | Done means |
|---|---|---|
| **CP0: Before kickoff** | Pre-event (planning only) | Organizers' answer on pre-event code; roles, demo business and simulation model decided; everyone has read CONTRACTS.md; dev + demo API keys with spend limits (credits bought, to raise the rate tier); host account ready |
| **CP1: Contracts and mocks** | First ~15% | **Hour 1:** the lead merges the contracts plus frozen `StepContext`/`AiClient` signatures. **Then:** each owner merges *their own* fixture + mock. An all-mock run completes end to end in the browser, and CI runs it |
| **CP2: Live vertical slice** | By ~65% | Every step live; one full real run from the deployed URL; **a startup and 3 obscure/local businesses tested**, none fail. **MVP feature freeze** |
| **CP3: Hardening** | Last ~30% | Recorded example saved; README and demo script done; 2–3 real owners tried it; two full rehearsals; deploys frozen |

The rule: **main always runs.** If your live step isn't ready, main uses your mock.

---

## 1. Platform & Integration (Nick, lead)

MVP
1. **Hour 1:** scaffold (Next.js, TS, Vitest, ESLint boundary rule, CI) + Zod contracts + validators + frozen `StepContext`/`AiClient`/`IdAllocator` signatures.
   *Done when:* typecheck/lint/test pass on main, and a deliberate cross-module import fails lint.
2. **Orchestrator:**
   - `{name, round}` steps; persist-then-advance.
   - Per-run lock; retry only from `failed`; boot sweep → `INTERRUPTED`.
   - Mock/live per step, with `bindFixture()`.
   *Done when:* an all-mock run finishes in under 5s, a killed run resumes without re-running saved work, and CI runs the all-mock pipeline.
3. **Store:** artifacts by ID; per-run write queue with atomic writes; 7-day retention sweep; strict ID patterns.
4. **AI client:**
   - Env config validated at boot; `server-only`.
   - `parse()` and `research()` (CitedNotes; `pause_turn`; tool caps).
   - Process-wide limiter; retry once then a typed failure; refusals and fallbacks.
   - Cost + web-search fees, budget caps; cache warm-up helper; `calls.jsonl`.
   *Done when:* unit tests with a mocked SDK pass, and going over budget aborts with a non-retryable `BUDGET_EXCEEDED`.
5. **API routes** (ARCHITECTURE → HTTP API), including `/example` replay, `DELETE`, `report.md`, the per-IP limit, the global live-run cap + queue, and the team bypass token.
6. **Deploy:** an always-on instance with a volume, env vars, spend-limited demo key.
   *Done when:* a teammate runs both the example and a live run from their phone.
7. **Recorded example:** save one excellent real run to `fixtures/recorded-run/` and replay it with original timing.
8. **`scrubPii()`** shared utility (emails, phones, @handles), unit-tested.

Stretch: live cost meter · model-agreement pass on a 10-customer subset.

## 2. Market Intelligence & Strategy

MVP: intake and research (needed early)
1. **Fixture + mock** for `market-model.json` (CP1).
2. **Intake:** defaults, snippet splitting, `scrubPii()`, safety check → `UNSAFE_INPUT`.
3. **Research call** → `CitedNotes`; **code builds `Evidence`** from citations and founder snippets, setting `sourceType` from a domain allow-list (review sites, forums, Q&A for the lexicon).
   *Done when:* the demo business returns ≥10 sources with URLs and excerpts.
4. **Structure call** → `MarketModelDraft` → `MarketModel`. The founder's guess is flagged; the lexicon references evidence IDs only.
   *Done when:* the verbatim validator keeps ≥80% of proposed phrases on the demo business.
5. **Thin-evidence mode:** warnings plus `evidenceStrength`; never fail for low counts.
   *Done when:* a tiny local business completes with "thin."

MVP: reporting (after research is live)

6. **Report call:** explains the *computed* verdict and segment, writes the three-line headline, positioning rationale, objections and validation roadmap.
7. **Assets call** (in parallel): landing hero, cold email, interview script. No testimonials, invented stats, superlatives or competitor names, enforced by a post-check.
8. **`toMarkdown(report)`** for export.

Non-code duty: run the **known-answer test**. Pick a company whose winning positioning is public, and check whether GTMagic recovers it. Present the result in the pitch either way.

## 3. Synthetic Audience

MVP
1. **Fixtures + mock** for `audience-sample.json` and `customer-responses.json` (CP1).
2. **Seeded sampler** (pure code): `balanced` (default) and `representative`; 6 attributes; 3–5 voice quotes.
   *Done when:* the same market model + seed gives an identical sample (snapshot test), with equal n per segment ±1.
3. **Customer card renderer** (customer → prompt text).
   *Done when:* a snapshot test passes.
4. **Simulation call:** layered prompt (protocol and stimuli come from `ExperimentRequest`); `SimulationDraft` keyed by label → mapped to `CustomerResponse`; failures → `skipped`.
   *Done when:* 58 calls finish in ≤25s on the chosen model at concurrency 16, and ≥95% are answered.
5. **Cache warm-up:** one call per ordering, then fan out.
   *Done when:* `cache_read_input_tokens > 0` on the fan-out calls.
6. **Resume-safe streaming:** append to JSONL as calls land; on retry, skip responses already saved.

Stretch: "Ask this customer why": one stateless follow-up question to a customer card.

## 4. Positioning & Experiments

MVP
1. **Fixtures + mocks** for `positioning-set.json`, `experiment-request.json` and `experiment-results.json` (CP1).
2. **Positioning generator:** 4–6 distinct angles from the brief + market model, borrowing real lexicon. The founder's current message is added as `source: "founder-current"`.
3. **Experiment design** (pure code): stimuli in the same format; cyclic Latin-square orderings; a repeat subset spread across segments; protocol text + dimension definitions.
4. **Evaluation** (pure code): counts, shares, segment ranking, **ICP verdict**, bootstrap winner rate, repeat consistency, confidence flags.
   *Done when:* unit tests on fixture responses give the expected numbers, including a `guess-holds` case and a `too-close-to-call` case.
5. **Objection themes:** one LLM call; quotes marked simulated.

Stretch (first stretch item for the team): **refinement round**. `refine()` uses objections ranked in code; the control gets a new ID; it runs on a holdout sample; `roundComparison` is computed in code.

## 5. Founder Experience

MVP
1. **Start screen:** **Try an example** (instant) and **Test my business** (form + privacy note: "Don't paste personal or confidential information").
2. **Progress screen:** polls `Run`; plain-English step names; queue position; errors with Retry when allowed.
3. **Live crowd** (the "bot cloner" from the sketch): one dot per customer, colored by choice, filling in live. **The signature visual.**
4. **Results:**
   - Three plain answers first; the leaderboard with **counts and n**; per-group breakdown; "your headline ranked N of M"; confidence flags in plain words.
   - Real quotes styled as quotes with source links; simulated words styled differently, labeled "simulated."
5. **Report view:** the guess comparison (including "your guess holds"), the test plan, assets labeled *Draft: verify before publishing* with copy buttons, Markdown download, Delete my run.
6. **Loading, empty and error states;** works on a phone; no jargon in the UI.
7. **User README:** "How to use GTMagic in 3 steps," with screenshots.

Non-code duties (Teamwork criterion): **pitch lead** (story, slides, timing), and **real-user research**: put GTMagic in front of 2–3 real small-business owners during the event and capture their reactions for the pitch.

Stretch: stream research sources into the progress screen as they're found.

---

## Demo plan (Teamwork criterion)

We show both audiences: the recorded example is a **startup**, and the live run is a **local small business**.

- **Before speaking:** start the live run on the local business from the team device (bypass token).
- **While it runs:** narrate the **recorded startup example** as each owner presents their part.
- **At the end:** reveal the live result.

## If a teammate isn't coding

The workstreams stay the same; someone else (often Nick) writes that workstream's code. Two non-code roles carry visible weight for the Teamwork criterion:

- **Pitch and research lead:** picks the demo businesses, interviews 2–3 real owners during the event, and owns the story, the slides and the wording in the app.
- **Prompt and quality lead:** writes and tunes prompt text (plain strings in each `prompts.ts`), hand-writes fixtures, and runs the known-answer test and the CP2 test set.

| Order | Who | Shows (~30–45s each) |
|---|---|---|
| 1 | Founder Experience (pitch lead) | The problem, what real owners said, and the start screen |
| 2 | Market Intelligence | Real quotes with source links: "not one model's opinion" |
| 3 | Audience | The crowd forming; one customer card with its real quotes |
| 4 | Positioning & Experiments | Blind counted choices, "your headline ranked 4th," stability, the guess verdict |
| 5 | Lead | One architecture slide, cost per run, the known-answer test, how the five of us split the work → reveal the live run |
