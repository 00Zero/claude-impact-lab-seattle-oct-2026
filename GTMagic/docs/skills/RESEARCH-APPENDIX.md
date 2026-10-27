# Research skill appendix (`gtm-research`)

Detail behind [RESEARCH.md](RESEARCH.md): the Tavily parameters relied on, per-source terms, file and log formats, the schema delta, operational handling, the build plan and sources. Every threshold here is provisional until the Tavily-coverage spike.

## A1. Tavily facts the scripts rely on

`POST https://api.tavily.com/search`, `/extract`, `/map`, with `Authorization: Bearer tvly-…` [T1–T5].

- **Search:**
  - `search_depth`: `basic`, `fast` and `ultra-fast` cost 1 credit; `advanced` costs 2.
  - `max_results` ≤ 20; `chunks_per_source` 1–3; `include_domains` ≤ 300, with `include_domains_mode` `restrict` or `prefer`.
  - `exact_match` for quoted customer phrases; `country` from a geography lock; `topic` (`general`, `news`).
  - Recency: `time_range` (`day`…`year`) or `start_date`/`end_date`; `include_published_date` (beta); `filter_by_published_date` drops undated results, so use it only on recent-only queries.
  - `include_usage: true` so the script logs the credits Tavily reports. `days` isn't in the current docs. `auto_parameters` stays off (2 credits).
- **Extract:** ≤ 20 URLs per call (more → HTTP 400). With `query`, it returns the top `chunks_per_source` (1–5) chunks rather than whole pages. Basic costs 1 credit per 5 successful URLs, advanced 2. Failures are free and arrive in `failed_results` even on HTTP 200, and result order isn't guaranteed.
- **Map:** 1 credit per 10 pages (2 with `instructions`); `limit` defaults to 50. Map plus targeted extract on competitor sites; never crawl.
- **Limits:** 100 requests/min on development keys, 1,000 on production (crawl 100); HTTP 429 with `Retry-After`.
- **Known issue:** `include_raw_content` combined with `include_domains` has returned empty results [T6], so search snippets first, extract second.
- **Pricing:** free tier 1,000 credits/month; pay-as-you-go USD 0.008 per credit [T4].
- **Ownership:** Nebius acquired Tavily in 2026 [T7].

## A2. Sources: terms and limits in detail

- **Reddit.**
  - Data API Terms (rev. 2026-07-20): commercial use, or research beyond the rate limits, requires a separate agreement; AI training needs the rightsholders' permission; data not needed for the approved use must be deleted [R1].
  - Reported rate limits are 100 QPM per OAuth client (one source says 60) [R1, R6].
  - A Nov 2025 r/redditdev post (seen only on a mirror; **unconfirmed on official Reddit pages**) says self-service API access closed and new access needs approval under a "Responsible Builder Policy" [R2].
  - robots.txt has blocked most non-Google crawlers since July 2024 [R3].
  - Reddit sued Perplexity, SerpApi, Oxylabs and AWMProxy on 2025-10-22, alleging Reddit content was scraped through Google results and resold [R4].
  - **Adapter policy:** snippets plus query-focused extract only; no `/user/` URLs; no usernames; ≤ 2 quotes per thread.
- **Subreddit metadata.** Reddit replaced public member counts with 7-day visitors (a 28-day rolling average) and contributions [R5]. The API's `about` data needs approved OAuth. Without it, activity = dated threads found in our searches, labeled "observed in search".
- **Google Trends.**
  - The official API is an application-only alpha (since July 2025): consistently scaled values, a rolling 5-year window, daily to yearly aggregation, country and sub-region [G1, G2].
  - `pytrends` was archived on 2025-04-17 [G3].
  - Tavily finds articles that cite Trends, not the series. **Adapter:** an owner-uploaded CSV (`trends_csv.py`), and the alpha later.
- **App stores.** App Store Connect and the Play Developer API return reviews for your own apps only [A2, A3]. Apple's legacy public reviews RSS (about 500 recent reviews per storefront) is undocumented [A1]. **Adapter:** Tavily search/extract of store pages (rating and review count as printed, a few visible reviews), plus owner exports.
- **Google Places (New).** `reviews[]` holds at most 5, sorted by relevance; `rating` and `userRatingCount` are separate fields [P1]. The policies forbid pre-fetching or caching Places content beyond the exceptions (place IDs may be stored indefinitely), and require author attribution when reviews are displayed [P2]. **Adapter:** review text is used in memory during the run only. Concern tags are counted into `research.confidence`, and only place IDs are persisted. No `source` lines with Places text, so no Places quotes.
- **Trustpilot, G2.** Secondary sources say Trustpilot's terms ban text and data mining without permission; G2 is unconfirmed [TP]. **Adapter:** search snippets only.
- **Pew.** The social media fact sheet (2026 survey, n = 5,511) reports the share of each demographic group who use Reddit [D1]. It is not the age mix of Reddit's users; converting needs a sourced population mix (code, `platform-prior`).

## A3. File and log formats

**Log lines** (`research-log.jsonl`):
- Every line carries `kind`, `seq`, `at`, `runId`, `pass`, `writer` (`<script>@<version>`) and `prev` (SHA-256 of the previous line, starting at the first `run` line).
- `run`: `event` (`start`, `close`), status.
- `search`: `query` (as intake's validator expects), `params` (never the key), `requestId`, `credits`, `fetchId`, `resultCount`.
- `fetch`: `tool` (`extract`, `map`), `urls`, `requestId`, `credits`, `failed`, `error?`.
- `source`: `url`, `title`, `excerpt` (the verified quote), `evidenceId`, `fetchId`, `publishedAt`, `sourceKey`, `candidateHash`, `spliceRisk`.
- `reject`: `candidateHash`, `reason`.
- `merge`: `file`, `ops` (each `{target, before, after}`), `rejected`.
- `loop`: `event` (`questions-issued`, `answers-applied`, `resumed`, `stopped`), `questionIds`, `status`.

**`candidates.jsonl`** (model): `{fetchId, resultIdx, quote, segmentIds, concernIds, sentiment: {label, target}, stances: [{hypothesisId, stance}], demographicCues: [string]}`.

**`proposals.jsonl`** (model):
- Shape: `{op: "set" | "append" | "remove", target: {collection, id?, field?}, before, after, reason, evidenceIds}`.
- Collections: `segments`, `hypotheses`, `concerns`, `lexicon`, `findings`, `skeptic`, `interests`.
- Owner-owned fields (the intake schema's "Owner" rows) are refused.
- `op: "split" | "merge" | "drop"` on segments becomes an owner question.
- Appending a `findings` entry needs `runId`, `kind`, `derivation` and `evidenceIds`.

**`state.json`** (`loop.py` only): `{runId, pass, passesThisRun, maxPasses, status, creditsUsed, creditsCap, openTasks[], lastSeq, ownerAccepted?: {at, failingGates[]}, updatedAt}`.

**`owner-questions.json`:** `{schemaVersion: 1, questions: OwnerQuestion[]}` (interface in RESEARCH.md section 7). The `before` check uses the same JSON-equality function as `merge_proposals.py`.

## A4. Schema delta (to add to `gtm-intake/references/schema.md`)

All fields are optional, so the schema stays at version 1. A brief and log in this shape pass `validate_intake.py` on `main` and on `fix/demo-critical`.

```ts
interface Evidence {                          // + optional
  runId?: string; fetchId?: string; logSeq?: number;          // research-grade when fetchId + logSeq are present
  questionId?: string; sourceKey?: string;                    // e.g. "reddit:r/xyz", "owner:reviews.csv"
  publishedAt?: string | null; recencyWeight?: number;         // script
  spliceRisk?: boolean;                                       // script: chunk had comment markers
  sentiment?: { label: "negative" | "mixed" | "neutral" | "positive"; target: string };   // model
  stances?: Array<{ hypothesisId: string; stance: "supports" | "contradicts" }>;          // model
  demographicSignals?: Array<{ attribute: "age" | "sex" | "lifeStage" | "geography"; value: string; cue: string }>;
                                              // script-verified; never on health-topic briefs (aggregate tally only)
}
// sourceType gains "search-trend" (a Trends series): a one-line change to provenance.SOURCE_TYPES
interface Hypothesis { segmentId?: string }   // + optional
// skeptic[] entries + optional: id?: string (skp_), segmentId?: string, hypothesisId?: string
interface Finding { runId?: string }          // + optional; findings are append-only (no supersedes)
// InterestGroup.demographics[] + optional: basis: "self-disclosed" | "community-level" | "interpolated"; method?: string; n?: number
interface IntakeBrief { research?: ResearchBlock }

interface ResearchBlock {                     // loop state is NOT here; research/state.json is its only home
  schemaVersion: 1;
  runs: Array<{ runId: string; startedAt: string; endedAt?: string; passes: number; creditsUsed: number;
                stoppedAs?: "research-backed" | "owner-accepted" | "cap-reached" | "saturated" | "blocked" | "error" }>;
  communities: Array<{ id: string; sourceKey: string; segmentIds: string[]; breadth: number; meanScore: number;
                       threads: number; recentShare: number; rank: number; visitorsWeekly?: number;
                       evidenceIds: string[]; excludedReason?: string }>;
  products: Array<{ id: string; name: string; sourceKey: string; rating?: number; reviewCount?: number; evidenceIds: string[] }>;
  confidence: Array<{ subjectId: string; level: "low" | "medium" | "high";
                      gates: Array<{ gate: string; pass: boolean; value: number; threshold: number }> }>;
  sentiment: Array<{ segmentId: string; target: string; n: number; negative: number; mixed: number; neutral: number;
                     positive: number; weightedNet: number }>;
  demographics: Array<{ segmentId: string; attribute: string; bands: Array<{ value: string; n: number }>; suppressedBelow: 5 }>;
  trends: Array<{ term: string; geo: string; evidenceId: string; change12mo: number | null }>;
  decision?: { recommendation: "fix-setup" | "refine" | "evaluate-creatives" | "generate-creatives"; reasons: string[];
               focusSegmentIds: string[]; failingGates: string[];
               refineItems: Array<{ what: string; gate?: string; evidenceIds: string[] }>;
               ownerChoice?: string; decidedAt?: string };
}
```

**Who writes:**
- **Scripts:** every number above, all IDs, `fetchId`/`logSeq`, `publishedAt`, `recencyWeight`, `spliceRisk`, `demographicSignals`, the tally, `decision.recommendation`, `reasons` and `failingGates`.
- **Model**, via candidates and proposals only: labels, findings, skeptic entries, concern and lexicon additions, question wording, source exclusions, refine-item wording.
- **Owner:** answers, structural segment changes, acceptance, `ownerChoice` (recorded atomically with re-confirmation).

## A5. Operational handling

- **Idempotence:** `add_evidence.py` keys each candidate by `candidateHash` (fetchId + resultIdx + normalised quote); re-running a file skips logged hashes. `merge_proposals.py` skips ops whose `after` already holds.
- **Retries:** 429 waits for `Retry-After`. 5xx and timeouts get one retry with backoff, then a `fetch` line with `error`, and the pass continues. If more than half a pass's calls fail, the status becomes `error`, and the failed pass still counts toward the cap.
- **Worst-case budget**, checked before every call against `creditsCap − creditsUsed`:
  - Search: 2 credits.
  - Extract: ceil(urls ÷ 5) × 2.
  - Map: ceil(limit ÷ 10) × (2 with instructions, else 1).

  A refused call is logged, and the pass ends. Map credits count like any other.
- **Cache:** deleted on `run close`. A run start deletes cache folders older than 7 days (abandoned runs).
- **Turn-taking:** writers refuse while the status is `awaiting-owner`. Every write to `intake.json` is temp-file-then-rename.
- **Throttle:** 30 requests/min, under the development-key limit.

## A6. Build plan

Three people, about **9–10 person-days** for the full design (about 3.5 days elapsed), about **7** with the Today cuts: no G4/G6, no Trends, no interpolation, no label-agreement pass.

| # | Task | Days | Done when |
|---|---|---|---|
| 0 | **Day 1, all:** file contract (A3), schema delta (A4), SKILL.md skeleton, a hand-labelled fixture (~30 excerpts with expected gate results) | 1 | Every later task can build and test against it in parallel |
| 1 | **Spike + client:** `tavily_client.py`, `tavily_search.py` and `ledger.py` with `--replay`. Run 10 seed queries on the demo business against Reddit, app stores and Trustpilot; record the cassette; check Claude chat's egress to api.tavily.com and the sibling-skill path | 1.5 | Hit rate, dated share, splice frequency and credits per query written up; thresholds confirmed or revised. Tests: chain, no key in any output, 429/5xx, budget refusal |
| 2 | `add_evidence.py` + `import_owner_file.py` | 1.5 | Tests: verbatim, the `[removed]` rule, splice markers, dedupe and per-URL cap, idempotent re-run, owner-file personal details dropped; intake validator exits 0 |
| 3 | `merge_proposals.py` + `apply_addendum.py` (one shared merge core) | 1 | Stale `before` rejected; owner-owned fields refused; structural ops become questions |
| 4 | `communities.py`, `demographics.py`, query recipes | 1 | Ranks deterministic on the cassette; n < 5 suppressed; health briefs store no bands on records |
| 5 | `confidence.py` + `loop.py` (status, queue, resume, record-choice) | 1.5 | Gate numbers match the fixture; every status reachable in tests |
| 6 | `decide.py`, `validate_research.py`, `render_research.py`, `quote_overlap.py` | 1 | Fixtures hit each precedence row; plain-words render snapshot; overlap guardrail catches a 6-word reuse |
| 7 | Finish SKILL.md, rubric, source policy; offline end-to-end demo; senior-engineer and GPT review | 1 | End-to-end run from the cassette passes `validate_research.py` |

## A7. Sources (checked 2026-10-25)

- **Tavily:**
  - [T1] search: https://docs.tavily.com/documentation/api-reference/endpoint/search
  - [T2] extract: https://docs.tavily.com/documentation/api-reference/endpoint/extract
  - [T3] map: https://docs.tavily.com/documentation/api-reference/endpoint/map
  - [T4] credits and pricing: https://docs.tavily.com/documentation/api-credits
  - [T5] rate limits: https://docs.tavily.com/documentation/rate-limits
  - [T6] raw-content + domains issue: https://community.tavily.com/t/combining-include-raw-content-and-include-domains-leads-to-no-results/170
  - [T7] Nebius acquisition (Q2 2026 6-K): https://www.sec.gov/Archives/edgar/data/0001513845/000110465926094844/nbis-20260812xex99d2.htm
- **Reddit:**
  - [R1] Data API Terms (the page blocks automated fetching, so read via a summary): https://redditinc.com/policies/data-api-terms, https://vorplabs.com/agent-tools/reddit-data-api
  - [R2] Responsible Builder Policy post (mirror only, unconfirmed): https://r.datuan.dev/r/redditdev/comments/1oug31u/introducing_the_responsible_builder_policy_new/noc31sg
  - [R3] robots.txt block: https://searchengineland.com/microsoft-confirms-reddit-blocked-bing-search-444385
  - [R4] Reddit v. Perplexity, SerpApi et al.: https://searchengineland.com/reddit-sues-perplexity-serpapi-scraping-google-463681, https://www.bnnbloomberg.ca/business/2025/10/22/reddit-sues-ai-company-perplexity-and-others-for-industrial-scale-scraping-of-user-comments, https://www.sdnyblog.com/files/2025/10/25-Civ-8736-Reddit-Inc.-Complaint.pdf
  - [R5] visitors and contributions: https://www.socialsamosa.com/news-2/reddit-member-count-new-engagement-metrics-10067678
  - [R6] rate limits (secondary): https://www.socialcrawl.dev/blog/reddit-api-key-limits-alternatives-2026
- **Google Trends:**
  - [G1] https://developers.google.com/search/apis/trends
  - [G2] https://developers.google.com/search/blog/2025/07/trends-api
  - [G3] pytrends (archived): https://github.com/GeneralMills/pytrends
- **Reviews:**
  - [A1] Apple reviews RSS cap (secondary): https://dev.to/quantoracle/the-app-store-review-ceiling-nobody-mentions-and-how-to-get-8x-past-it-484h
  - [A2] App Store Connect customer reviews: https://developer.apple.com/documentation/appstoreconnectapi/customer-reviews
  - [A3] Play reviews API scope: https://aso.dev/google-play/metadata/reviews/
  - [P1] Places API (New) Place resource: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
  - [P2] Places policies: https://developers.google.com/maps/documentation/places/web-service/policies
  - [TP] Trustpilot terms (secondary, unverified): https://webscraping.ai/faq/trustpilot-scraping/what-are-the-alternatives-to-scraping-trustpilot-directly
- **Demographics and law:**
  - [D1] Pew social media fact sheet: https://www.pewresearch.org/internet/fact-sheet/social-media/
  - [L1] Washington My Health My Data Act summary: https://hunton.com/insights/legal/washington-becomes-the-first-state-to-enact-a-comprehensive-health-privacy-law
