# app (Founder Experience)

**Owner:** Founder Experience (pages, `src/components/`) · Lead (`src/app/api/`) · **Tasks:** [TASKS.md §5](../../docs/TASKS.md)

The owner-facing web app. It talks to the backend only through the HTTP API in [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) → HTTP API, using `Run` and artifact types from `@/contracts`.

## Screens

1. **Start:** **Try an example** (instant replay) and **Test my business** (description required; optional website, price, best-customer guess, current headline, pasted reviews/emails). Shows: *"Don't paste personal or confidential information."*
2. **Progress:** polls `GET /api/runs/:id` every 2s; plain-English step names; "You're #2 in line" when queued; errors with Retry when `retryable`.
3. **Live crowd:** one dot per synthetic customer, colored by choice, filling in from `GET /api/runs/:id/responses?after=N`. This is the "bot cloner" from the sketch and **our signature visual**.
4. **Results:** the three plain answers first, then a leaderboard with **counts and n**, a per-group breakdown, "your headline ranked N of M," and confidence flags in plain words.
5. **Report:** "your guess holds" or "evidence points to X," the test plan, draft assets with copy buttons, **Download (Markdown)**, **Delete my run**.

## Rules

- No jargon in the UI: "customer groups," not "segments"; "how customers talk," not "lexicon"; "how consistent the result is," not "stability."
- **Real vs simulated** must look different everywhere: real quotes as quote blocks with a source link; simulated words in a distinct style labeled "simulated."
- Every simulated number says "simulated preference." Show an **Example run** badge when `run.isReplay`. Assets show *Draft: verify before publishing*.
- Every screen that fetches data has a loading, empty, and error state; works on a phone.
- Render generated copy as text or Markdown, never as raw HTML.
- Build against the all-mock pipeline from hour one.
