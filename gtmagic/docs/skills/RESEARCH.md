# Research skill (`gtm-research`)

The second GTMagic skill. After intake, it goes out to the communities and products closest to the owner's customer groups, collects recent real customer language, sentiment and demographic signals, and keeps looping (with the owner in the loop) until the target market and ICP are well supported or honestly unsupported. It ends by handing back a recommendation in plain words: **refine** specific things, or **proceed** to generate creatives or evaluate an existing set.

> **Status:** design spec v0.2, 2026-10-25, revised after a senior-engineer and a devil's-advocate review. No code yet. **Today** marks the hackathon slice; **full** is the target after. Every threshold here is **provisional until the Tavily-coverage spike** (build task 1) measures how much Reddit and review content Tavily returns and how often `published_date` is missing. Numbers in this spec describe tools and limits; they are never evidence. Details (Tavily parameters, file formats, schema delta, operations, build plan, sources) are in [RESEARCH-APPENDIX.md](RESEARCH-APPENDIX.md).

**Principles.** Intake's four carry over: code computes every number (the model labels; scripts count, weight, rank, gate and decide); evidence comes only from logged tool results or the owner's words and files (verbatim, ≤ 25 words, personal details removed); "not supported yet" is a valid result; every claim traces to evidence through `findings[]`. **New in research:** scripts write the research log and every change to `intake.json`. The model writes only plans, quote candidates and proposals; it can't add a source by saying it saw one, or edit the brief directly.

## 1. Purpose, inputs, outputs, handback

| | |
|---|---|
| **Runs after** | `gtm-intake` hands off `intake.json` with any readiness status (`needs-more` included; research is how gaps close) |
| **Inputs** | `gtm-workspace/<slug>/intake.json`, the existing `research-log.jsonl` and `sources/`, and the **owner's own customer voice**, asked for up front (below), plus optional Google Trends CSVs and a `creatives/` folder |
| **Outputs** | The same `intake.json`, grown (new evidence, appended findings, revised segments and lexicon, a `research.decision`); the log, grown; `research/` working files; `research-brief.md` for the owner |
| **Handback** | Leads with the recommendation in plain words, then why, then what changed, then quotes and figures (section 8) |

**Owner's own data first.** Before the first search, the run asks once (through the intake addendum, section 7) for reviews exported from the owner's own app store, Google Business Profile or Shopify; support emails; survey answers; sales-call notes. `import_owner_file.py` turns them into `origin: "owner-file"` evidence: verbatim excerpts, customer names and emails dropped (intake's rule). This is the cleanest source there is (no terms-of-service risk, and it's the owner's actual customers), so it counts toward every gate.

Intake's own capped research turn stays as it is. It draws the first picture; `gtm-research` deepens and tests it.

## 2. Where the growing body of research lives

**Decision:** one append-only log plus the existing save file. No separate research database.

| File | Writer | Role |
|---|---|---|
| `research-log.jsonl` | Scripts only, from the first `run` line on | **The ledger.** One JSON line per event: `run`, `search`, `fetch`, `source`, `reject`, `merge`, `loop`. Never edited |
| `intake.json` | Scripts only during research | The current picture. `evidence[]` and `findings[]` only grow (script-assigned IDs, `runId` on each); segments and lexicon change only through merged proposals |
| `research/state.json` | `loop.py` | **The single source of truth for loop state:** run, pass, passes this run, credits, status, open tasks |
| `research/owner-questions.json` | `loop.py`, `apply_addendum.py` | The owner-question queue and each question's lifecycle (section 7) |
| `research/plan.json`, `candidates.jsonl`, `proposals.jsonl` | Model | The only files the model writes during research (formats in appendix A3) |
| `research/cache/` | `tavily_search.py` | Result text kept only to verify quotes; deleted when the run closes, or after 7 days if a run is abandoned |

**Why this shape:**
- **The intake validator already reads this log.** `provenance.load_log` builds sources from `kind:"source"` lines and skeptic queries from `kind:"search"` lines, and ignores other kinds and extra fields. **Rule:** after every merge, `validate_research.py` first runs `validate_intake.py --log research-log.jsonl --write`, which must exit 0. A brief and log in the proposed shape were checked against both the `main` and `fix/demo-critical` validators: both exit 0.
- **One save file** for the owner and for the simulation skill, which already reads `segments`, `lexicon` and `constraints` from it.
- **Append-only** gives the "growing body" and lets any pass be replayed from the log.

**Intake-era evidence** (written by intake, logged by the model) stays in the brief and still feeds intake's `concernBundles`. It does **not** count toward research gates G1–G4 and is shown as "from the first interview's research". Research can upgrade a record by re-fetching its URL through the script; if the quote is found verbatim, the record gains `fetchId` and `logSeq` and starts counting.

**When research changes the confirmed brief,** the merge script flips the "Owner confirmed the brief" check to `pass: false`, and the handback opens with a one-screen **what changed** summary (at most 5 lines, before → after in plain words, generated from the merge diffs). The owner re-confirms when choosing the next step (section 8).

## 3. Provenance made real

```
python3 scripts/tavily_search.py search --plan research/plan.json    # or: extract --urls ... --query ...
python3 scripts/add_evidence.py research/candidates.jsonl            # model-proposed quotes → verified evidence
python3 scripts/merge_proposals.py research/proposals.jsonl          # model-proposed changes → checked merge
```

- **Calls:** `tavily_search.py` sends each call, logs a `search`/`fetch` line with the parameters (never the key), Tavily's `request_id` and the credits Tavily reports, caches the result text under a `fetchId`, and prints a numbered digest for the model to read.
- **Quotes:** the model proposes `{fetchId, resultIdx, quote, segmentIds, concernIds, sentiment, stances, demographicCues}`. `add_evidence.py` accepts one only if all of these hold:
  - The quote is verbatim in that cached result.
  - It stays inside one paragraph and doesn't cross a comment marker (Tavily chunks can splice several commenters together; markers are listed in `references/source-policy.md`).
  - It's ≤ 25 words and passes intake's personal-details regex.
  - Each `[removed]` replaces 1–4 words that match the personal-details regex, look like a capitalised name, or contain a digit. Never a negation ("not", "never", "no", "n't") or a run of stopwords, so redaction can't flip a meaning.
  - It isn't a duplicate (same URL and normalised excerpt), and the URL has fewer than 2 accepted quotes.

  The script then assigns `ev_<n>`, writes the `source` line (with `evidenceId`, `fetchId`, `seq`), and merges the record, carrying `fetchId` and `logSeq`. Re-running the same candidates file is a no-op. A chunk with comment markers sets `spliceRisk: true`: that quote counts toward themes but never feeds the lexicon or the handback's quotes. Single-comment permalinks are preferred for extraction.
- **Changes to the brief:** each proposal names its target by ID (`{collection: "segments", id: "seg_2", field: "barriers"}`, never `/segments/0`) and carries the `before` value. `merge_proposals.py` applies it only if the current value still equals `before`, refuses owner-owned fields, turns structural changes (split, merge, drop a segment) into owner questions, and logs a `merge` line with the diff. New findings are appended with `runId`; earlier findings are never rewritten.
- **Checks in `validate_research.py`:**
  - After the first `run` line, any log line without a script `writer` is an error.
  - Every research evidence record's `logSeq` points at a `source` line with the same ID, URL and excerpt; in reverse, every script-written `source` line's `evidenceId` exists in `intake.json`.
  - No file in the workspace matches `tvly-[A-Za-z0-9_-]+`.
  - The hash chain is intact. Each line carries `prev` = SHA-256 of the previous line, starting at the first `run` line. That's low value against anyone determined (it can be recomputed) but cheap, and it catches accidental edits.
- **Threat model, stated honestly:** this stops habitual or hallucinated sourcing, not a deliberately adversarial operator. Tavily `request_id`s let a human audit a run against Tavily's usage logs. A verbatim match also doesn't prove one person said the words (see splicing above).

**API key.** `tavily_client.py` reads `TAVILY_API_KEY` from the environment, else the macOS Keychain (`security find-generic-password -s gtmagic-tavily -a "$USER" -w`, read through a pipe, never through argv). It never prints, logs or caches the key, and every message passes a `tvly-…` redactor. No key → status `blocked` with "No Tavily key found; run the GTMagic key setup script" (that script exists separately). Standard library only, like the intake scripts.

**Provider coupling, honestly.** A swap away from Tavily (now owned by Nebius [T7]) touches more than the client: `request_id` auditing, credit accounting, `published_date` semantics (recency), chunking (the splice check) and the replay cassette all depend on Tavily. Keep those behind `tavily_client.py`'s return type and expect a swap to take about a day, not one file.

## 4. Sources: access and the terms that shape the design

| Source | Access path | Constraint that shapes the design (detail: appendix A2) |
|---|---|---|
| **Owner's own customer voice** | Owner files | None beyond intake's rules: drop names and emails. First-class; asked for up front |
| **Reddit threads** | Tavily search with `include_domains: ["reddit.com"]`, snippets + query-focused extract | Reddit sued Perplexity, SerpApi, Oxylabs and AWMProxy on 2025-10-22 over Reddit content obtained through search results [R4]. Commercial use needs a separate agreement [R1]. Non-Google crawlers blocked since July 2024 [R3], so coverage may be partial. Short quotes only; never usernames or `/user/` URLs. Hosted use is decision (c) |
| **Subreddit size** | Tavily extract of the community page, if shown | Public member counts were replaced by 7-day visitors and contributions [R5]. Otherwise activity is "observed in search" (dated threads found), never a size |
| **Google Trends** | Owner-uploaded CSV; official alpha API later | The official API is an application-only alpha [G1, G2]; `pytrends` is archived [G3]; never scrape |
| **App-store reviews** | Tavily search/extract of store pages | The official review APIs cover your own apps only [A2, A3]; owners export their own |
| **Google Maps reviews** | Places API, full version only | At most 5 reviews; no caching of Places content [P1, P2]. **So Places text never enters the append-only log or the brief:** only place IDs and counts taken during the run, so Places gives themes, never quotes |
| **Trustpilot, G2** | Tavily search snippets only | Reported text-mining bans [TP]; no extract or crawl |
| **Platform demographics** | Tavily search of Pew and similar | Copied figures with n and date [D1]; converting "share of each age group who use Reddit" into the users' age mix needs a sourced population mix, done by code |

## 5. Discovery, extraction and labeling

**Seeds come from intake:** segment descriptions, needs and barriers, `lexicon[]` phrases (real customer words make the best queries), `interests[].researchDefinition` (may name a condition), `targetableProxies`, incumbents, and locks (geography → Tavily `country`).

**Discovery** (pass 1, and whenever the diversity gate fails):
1. The model writes `plan.json`: queries with an `intent` (`discover-community`, `voice-of-customer`, `incumbent-reviews`, `demographics`, `skeptic`, `momentum`) and the segment each serves.
2. `communities.py` derives a **`sourceKey`** per result URL: `reddit:r/<name>`, `appstore:<id>`, `play:<package>`, `trustpilot:<domain>`, `owner:<file>`, else the domain. **A "source" everywhere in this spec means a distinct `sourceKey`.**
3. Per candidate source, code computes `breadth` (share of seed queries that hit it), mean Tavily score, distinct threads and `recentShare`. **Rank = breadth × meanScore × (0.5 + 0.5 × recentShare)**, a versioned heuristic, not a business assumption.
4. The model may exclude an off-topic source with a logged reason. The top 5 communities and top 5 products go forward.

**Extraction** (each pass): per selected source, `voice-of-customer` queries from needs, barriers, lexicon and switching language ("switched from", "cancelled", "gave up on"), restricted to that source, with `time_range: "year"` first. If that returns fewer than 5 usable results, the script widens to 3 years and logs the widening.

**Labels per excerpt** (model, using the versioned rubric `prompts/label-rubric.md`):
- `segmentIds` and `concernIds`, as in intake.
- `sentiment: {label: negative | mixed | neutral | positive, target}`, where the target is `problem`, `category`, `incumbent:<name>` or `offer-concept`.
- `stances: [{hypothesisId, stance: supports | contradicts}]`.
- Verbatim `demographicCues`.

Code aggregates per segment × target, recency-weighted. In Claude Code, a separate subagent re-labels a 20% sample (minimum 10) and code reports the agreement.

**Recency.** `publishedAt` comes from Tavily's `published_date` only, else `undated`. Weight = 0.5^(age in months ÷ 12). Undated excerpts weigh 0.25, count toward themes, and never count toward the recency gate. Customer voice older than 36 months isn't added; official statistics may be up to 5 years old. If the spike shows dates missing for most Reddit results, the recency gate is redesigned before build, not loosened silently.

**Demographic signals,** each labeled with its `basis`:
- **`community-level`:** a sourced figure about the platform or community (a Pew table, a subreddit's own census post), copied with its evidence ID and n.
- **`self-disclosed`:** `demographics.py` extracts bands with fixed patterns ("52F" → 50–54, F; "I'm 34" → 30–34), plus verified model cues. Only age band, sex, life stage, and country or state.
  - **Health-topic briefs: off until decision (b).** If enabled, bands live only in an aggregate tally per segment, never on a record that carries a thread URL, and exact ages are redacted from quotes.
  - Other briefs may keep bands on the evidence record.
- **`interpolated`:** computed by code with a named method, its inputs and evidence IDs in `logic`: `self-disclosed-sample`, `platform-prior`, or `blend` = w × sample + (1 − w) × prior, with w = n ÷ (n + 20).
- **Small cells:** any band with n < 5 is suppressed. The model never types a share.

## 6. Confidence model: when the research backs a customer group

Gates are **validation thresholds** in `confidence.py`: versioned constants, provisional until the spike. They measure the evidence, not the market; owner economics never enter them. They count only **script-sourced web evidence and owner-file evidence** (not intake-era records), and only customer voice (`review`, `forum-post`).

| Gate (per segment) | Pass when (full · Today) | What a failure tells the next pass |
|---|---|---|
| G1 Volume | High at ≥ 30, medium at ≥ 10 tagged excerpts (the same breakpoints as intake's `concernBundles`) | Run more voice-of-customer queries |
| G2 Recency | ≥ 50% dated within 24 months, and recency-weighted volume ≥ 15 · 8 | Re-query with `time_range: "year"` |
| G3 Diversity | ≥ 3 · 2 sources, none over 40% · 60%, ≥ 2 source types | Discover another community or product |
| G4 Corroboration | Each of the top 3 concerns appears in ≥ 2 sources; each hypothesis's support (by `segmentId`) comes from ≥ 2 sources | Look for the uncorroborated concern elsewhere |
| G5 Skeptic | ≥ 1 skeptic entry for the segment, its queries logged in this run, none `unresolved` unless the owner answered it | Owner question or disconfirming queries |
| G6 Labels | Second-label agreement ≥ 80% (Claude Code only) | Revise the rubric; confidence capped at medium |
| G7 Owner alignment | No open `contradiction` question for the segment | Owner question |

**Segment confidence (code):** `high` = all gates pass; `medium` = G1 medium, plus G3, G5 and G7; else `low`.

**Why the counts can differ from intake's:** intake's `concernBundles` still counts every customer-voice record (theme weights for the simulation); G1 counts only research-grade records (confidence). The brief labels both.

**Hypotheses and skeptic entries** gain `segmentId` (skeptic entries also an `id`). Code counts distinct-source support and contradiction. The validator errors on `supported` when contradictions ≥ supports or support comes from fewer than 2 sources, and on `refuted` without ≥ 5 contradicting excerpts from ≥ 2 sources or a cited "wrong if" match.

**How each pass narrows the ICP.** `loop.py` turns failing gates into research tasks and owner questions. Proposals revise model-owned fields (needs, barriers, decision criteria, attribute weights, concerns, lexicon); structural changes become owner questions (decision 10). **Saturation** is the share of a pass's new excerpts that introduced a new concern ID. A pass below 1 in 10, or with zero new accepted quotes, counts as a saturated pass.

## 7. Closing the loop with the owner

After every pass, `loop.py evaluate` looks for owner-facing gaps:
- **Contradictions** between research and intake answers (an age lock of 35–64 while most self-disclosed ages are 25–34).
- **Gaps** that block a gate and only the owner can fill.
- **Low-confidence segments:** narrow, keep researching, or drop?
- **Unverified locked constraints** that block a gate.
- **Narrowing** send-backs when a target is crowded or vague.
- At run start only, **owner data** (section 1).

**Option A: intake gains an `addendum` mode.** Research writes the queue and stops; `gtm-intake` (same conversation, invoked by name) asks only those questions under its interview rules, then `apply_addendum.py` applies the answers.
- **For:** one interviewer and one rulebook (plain words, the vagueness check, one pushback then gospel); only intake writes owner-owned fields. **Against:** a skill switch mid-conversation (reliable in Claude Code, less certain in chat).

**Option B: a second-pass interviewer inside `gtm-research`.**
- **For:** seamless, with the evidence already in context. **Against:** duplicated interview rules that drift, and research gains write access to owner-owned fields.

**Recommendation: A** (decision 5). If `gtm-intake` isn't installed, the status is `blocked`; research never asks owner questions itself.

**Handoff contract** (`research/owner-questions.json`; full format in appendix A3):

```ts
interface OwnerQuestion {
  id: string; pass: number;   // q_<n>, script-assigned; the pass that raised it
  kind: "owner-data" | "contradiction" | "gap" | "low-confidence" | "locked-unverified" | "narrowing";
  target: { collection: "constraints" | "segments" | "hypotheses" | "business" | "icp"; id?: string; field?: string };
  before: string;             // JSON of the target's value when asked; the answer applies only if it still matches
  ask: string; why: string;   // plain words; `why` cites what research found
  evidenceIds: string[]; findingIds: string[];   // at least one; validated
  blocking: boolean;          // blocks a gate
  status: "open" | "asked" | "answered" | "skipped" | "withdrawn";
  answer?: { evidenceId: string; mergeSeq: number };   // owner-text evidence + the log line holding the diff
}
```

- **Selection (code):** at most 4 per round, blocking first, then by the number of gates a question would unblock. A locked constraint that already has a `pushback` is never raised again; a contradiction on a locked constraint *is* its one pushback.
- **Answers:** each becomes `origin: "owner-text"` evidence (a verbatim ≤ 25-word excerpt, plus `questionId`; the full answer goes to `research/answers/q_<n>.txt`). `apply_addendum.py` uses the same ID-targeted, `before`-checked merge as proposals, logs a `merge` line, and runs `validate_intake.py`, which must exit 0.
- **Turn-taking:** while the status is `awaiting-owner`, `add_evidence.py` and `merge_proposals.py` refuse to run.
- **Resume:** `loop.py resume` re-plans only the affected tasks; discovery reruns only if G3 fails.

```
 gtm-research
 ┌──► plan ─► tavily_search.py ─► add_evidence.py ─► validate_research.py (gates)
 │                                                            │
 │                                                    loop.py evaluate
 │            ┌───────────────────────────┬───────────────────┴─────────────────┐
 │   research tasks only           owner questions                     T1–T4 stop gate met
 │            │                (owner-questions.json)                           │
 ├────────────┘                           │                            decide.py ─► owner
 │                 gtm-intake addendum: asks ≤ 4, records answers
 │                                        │
 │                          apply_addendum.py: diff → log
 │                                        │
 └──── loop.py resume ◄───── validate_intake.py exits 0
```

**Termination, computed as validation gates** (`loop.py status`; also `researching` and `awaiting-owner` while running):

| Gate | Stops when | Status |
|---|---|---|
| T0 Setup or integrity | No key, Tavily out of credits, `gtm-intake` missing | `blocked` |
| | Network failing after retries, the validator failing after a merge, a script crash | `error` |
| T1 Research-backed | Primary segment `high` (Today: `medium`), every alternate has a verdict, no blocking question open | `research-backed` (never "validated") |
| T2 Owner says good enough | The owner accepts; the script records the gates still failing, so later skills see "accepted at medium" | `owner-accepted` |
| T3 Pass cap | Passes this run reach 3 (Today: 2), failed passes included, or credits reach the run cap | `cap-reached` |
| T4 Saturation | Two saturated passes in a row with gates still failing | `saturated` |

The cap limits owner time and credit spend; it says nothing about the market. Every stop hands off with the failing gates translated into plain words.

## 8. End-of-run decision and handoffs

`decide.py` computes the recommendation; the model explains it; the owner chooses (decision 4). Readiness is judged with intake's checks **excluding** "Owner confirmed the brief", because research has just invalidated it. Rows apply in strict precedence: the first match wins.

| # | Recommendation | When (code) | Next skill receives |
|---|---|---|---|
| 1 | **Fix setup** | Status `blocked` or `error` | Nothing; the owner is told what to fix |
| 2 | **Refine** | Primary confidence `low`; a blocking question open; an `unresolved` skeptic claim on the primary motivation; intake readiness failing; or stopped as `saturated`/`cap-reached` with gates failing | A new `gtm-research` run resumes from `state.json` |
| 3 | **Evaluate existing creatives** | Otherwise, if the owner supplied ≥ 2 creatives (text or images) | `intake.json`, `research.decision`, `creatives/manifest.json` |
| 4 | **Generate creatives** | Otherwise | `intake.json` and `research.decision` |

**Creatives get customer phrases and themes, never quotes.** Next skills receive lexicon phrases (≤ 6 words when used in copy), concern themes with counts, and sentiment summaries; never `evidence[].excerpt`.
- **Overlap guardrail** (reusable by both creative skills): reject any line that shares ≥ 6 consecutive words with a stored excerpt, other than an exact lexicon phrase.
- **No testimonial framing:** reject copy that puts customer words in quotation marks or attributes them to a person. Real-sounding testimonials invite FTC endorsement trouble, and long quotes invite copyright trouble.
- **Image creatives** must supply their on-image text so the same checks run.

**The handback, in this order, in plain words** (no gate names, no "net sentiment"; `render_research.py` maps each gate to a fixed plain sentence):
1. The recommendation in one line ("Go ahead and make ads for midlife strength protectors", or "Before making ads, let's settle two things").
2. Why, in 2–3 sentences.
3. What changed (one screen) if the confirmed brief changed.
4. Per customer group: the 3 strongest recent quotes with links (no links in `--public` renders) and plain figures from the script ("Most of the 34 recent comments were frustrated with…").
5. The other options.

**Recording the choice:** `loop.py record-choice` writes the owner's choice and, unless they chose to refine, the re-confirmation check in **one atomic write**, so a brief can't be re-confirmed without a recorded next step, or the reverse.

## 9. Health topics, copyright, compliance, retention and budget

**Health and sensitive topics.** Intake's rules carry over unchanged. Additions:
- Queries, `researchDefinition` and `research.communities[]` may name a condition: they're research.
- `segments[].channels` lead to targeting, so they get intake's proxy check (no condition terms) and the "verify platform policy" suffix.
- Never infer a person's health status. Self-disclosed signals never include health attributes. See decision (b) for whether they run at all on health topics.
- Findings about drug effects never become messaging claims.

**Copyright:** ≤ 25-word excerpts with a source link; never whole reviews or threads; creatives never reuse quotes (section 8); cached text deleted with the run.

**ToS:** enforced by adapter policy (appendix A2): snippet-only domains, blocked `/user/` paths, no Places text in the log, no Trends scraping, no CAPTCHA or login bypass.

**Retention:**
- Claude Code: the owner's machine, under intake's rules.
- **Hosted product:** excerpts and log lines expire after 12 months unless re-verified by a fresh fetch, and are deleted with the workspace. Reddit-sourced excerpts also follow whatever decision (c) settles.

**Budget per run** (worst case checked before every call; appendix A5): per pass ≤ 20 advanced searches (~40 credits) + ≤ 3 extracts (≤ 12) + optional map (≤ 5); per run 3 passes under a 200-credit cap (≈ USD 1.60 at pay-as-you-go rates [T4]). Time: about 5–8 minutes per pass, plus owner rounds.

## 10. Skill layout and build plan

```
.claude/skills/gtm-research/            requires gtm-intake installed alongside
  SKILL.md · prompts/label-rubric.md · references/source-policy.md · references/query-recipes.md
  scripts/tavily_client.py              key loading, HTTP, throttle, retries, redaction, worst-case budget, --replay
  scripts/tavily_search.py, ledger.py   plan → calls → log + cache; hash chain, verify, close-run, cache TTL
  scripts/add_evidence.py, import_owner_file.py   verified quotes and owner files → evidence; idempotent
  scripts/merge_proposals.py            ID-targeted, before-checked merges of model proposals
  scripts/communities.py, demographics.py      sourceKeys, metrics, rank; bands, interpolation, small cells
  scripts/confidence.py, loop.py, decide.py    gates, saturation; queue, resume, status, record-choice; precedence
  scripts/trends_csv.py · validate_research.py · render_research.py · quote_overlap.py (creative guardrail)
.claude/skills/gtm-intake/scripts/apply_addendum.py   (Option A) answers → owner-owned fields, same merge rules
```

`validate_research.py` imports the intake validator from `../gtm-intake/scripts/` and fails clearly if it's missing; the spike confirms that sibling path works in Claude chat. The schema delta (all optional fields, so schema v1 holds, plus a one-line `search-trend` source type) is in appendix A4.

**Build plan** (detail in appendix A6): about **9–10 person-days** for the full design, about **7** with the Today cuts. **Day 1** produces the file contract and schema delta, a SKILL.md skeleton, and a hand-labelled fixture, so the script tasks can run in parallel. **The spike and the Tavily client are one task**, because the client is what the spike needs.

**Today slice:**
- Tavily plus owner files; 2 passes and 1 owner round.
- Gates G1–G5 and G7 at the Today thresholds; no label-agreement check, so confidence is capped at medium.
- Community-level demographics only.
- The demo runs from a recorded cassette.

Decision (a) asks whether v1 should be slimmer still.

## 11. Questions to grill the product owner on

The first four came out of the reviews, which disagree with the design or with the owner's brief. Each records both reviews' view and a recommendation.

1. **(a) v1 scope: the full design, or the reviewers' slim v1?** *Senior engineer and devil's advocate:* ship one bounded pass plus one optional owner round, owner reviews first-class, three gates (volume, sources, recency) and a proceed/refine choice; add demographics and multiple passes after the spike. *Owner's brief:* "as much demographic information as possible" and a loop "until we feel we are confident". **Recommendation:** build the slim v1 on the full design's plumbing (script-written log, proposals, question queue, `state.json`), so more passes is a cap change (1 → 3), not a rewrite. Include sourced community-level demographics in v1; they're cheap and safe. Defer self-disclosed extraction and G4–G6 until the spike shows Reddit coverage and date availability. Building seven gates on unmeasured data is waste.
2. **(b) Self-disclosed demographics on health topics: on or off for v1?** *Owner:* asked for as much demographic information as possible. *Devil's advocate:* off for v1. Health-data laws such as Washington's My Health My Data Act cover data linking a person to a health status, including inferences, and allow private lawsuits [L1]; verbatim quotes can be searched back to their author. *Senior engineer:* allow it, aggregates only, never on a record with a thread URL. **Recommendation:** off for health-topic briefs in v1 (community-level sourced figures only); on, as aggregates, for other briefs; revisit after a legal read. The demo business is exactly the case those laws target, and sourced community figures still give the age skew.
3. **(c) Reddit via Tavily in the paid hosted product?** *Both reviews:* don't assume it's fine. Reddit sued Perplexity, SerpApi, Oxylabs and AWMProxy on 2025-10-22 over Reddit content obtained through search results [R4] (verified), and Tavily is that kind of intermediary. The Nov 2025 closure of self-service API access comes from a mirrored r/redditdev post and is **unconfirmed on official Reddit pages** [R2]. **Recommendation:** keep it for Claude Code and the demo (owner-run, short excerpts with links). For hosted, first get Tavily's sourcing and commercial-use terms **in writing**, then a legal read, and apply for Reddit access in parallel. Launch hosted without Reddit if either is unresolved; owner reviews, app stores and other forums fill in.
4. **(d) "Generate vs evaluate": keep it as an owner choice, or collapse it into routing?** *Reviews:* collapse it. Research decides only proceed vs refine; whether to generate or evaluate follows from whether creatives exist. *Owner's brief:* names three outcomes. **Recommendation:** research computes proceed/refine; on proceed, routing defaults to evaluate when ≥ 2 creatives were supplied, else generate, and the handback offers the other as a one-click alternative. Always stop for the owner's choice; never auto-continue, since the next skills cost money and the brief needs re-confirming.
5. **Owner loop: intake "addendum" mode (A) or an interviewer inside research (B)?** Default **A**: one interviewer and one rulebook, and only intake writes owner-owned fields. B is smoother to build, but it duplicates the interview rules and blurs field ownership.
6. **Which surface ships first: Claude Code only, or Claude chat too?** Default **Claude Code**. The scripts need an env or Keychain key and outbound network; if chat's sandbox blocks api.tavily.com, the model would be writing the log again, which breaks script-written provenance.
7. **Whose Tavily key and credits?** Default: the owner's own key in Claude Code (free tier 1,000 credits a month, about 5 full runs); our key with hard per-run caps only in the hosted product. This changes billing, the setup flow and abuse risk.
8. **How recent is "recent"?** Default: 12-month half-life, a 36-month window for customer voice, 5 years for official statistics; undated posts count toward themes, not toward recency. A shorter window gives fresher sentiment but thin evidence for niche and local businesses. All provisional until the spike measures date coverage.
9. **What bar is "research-backed"?** Default: the gates in section 6 (30 research-grade excerpts for high, ≥ 3 sources, none over 40%, top concerns corroborated, a skeptic pass per group), provisional until the spike. A higher bar costs credits and owner time; a lower one risks blessing an echo chamber.
10. **May research change customer groups itself (split, merge, drop), or only propose?** Default: **propose**. Structural changes become owner questions; proposals update only model-owned fields, with each `before` value checked and the diff logged.
11. **Non-Tavily sources: Google Trends (owner CSV now, alpha application), Apple's public reviews RSS, the Places API?** Default: Trends via owner CSV plus an alpha application, never `pytrends` or scraping. RSS and Places only after a terms check; Places can supply themes, never quotes.
12. **Should recency weighting flow into the simulation's concern weights, or stay in confidence and sentiment only?** Default: confidence and sentiment only for v1, so the intake validator stays unchanged and concern counts stay comparable across runs. Revisit once simulations show it matters.
