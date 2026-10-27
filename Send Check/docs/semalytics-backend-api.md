# The SEMalytics Backend: What It Adds

Send Check works out of the box. The built-in scorer runs mechanical checks,
slop detection against both ecosystems' own rule lists, and a recipient-aware
judge. The SEMalytics backend replaces the judge's opinion with measurement.

## The one-paragraph answer

The built-in judge answers "does this read like good outreach?" — a structured
opinion that varies run to run. The SEMalytics backend measures the draft
against personality and persuasion frameworks grounded in 860 peer-reviewed
papers: the same draft and the same recipient profile return the same scores,
each dimension traceable to a framework, each verdict explainable. Opinion
becomes instrument.

## Side by side

| | Built-in scorer | SEMalytics backend |
|---|---|---|
| Slop detection | Rule lists (Anthropic + Cursor, attributed) | Same, plus framework-level style fit |
| Recipient fit | LLM judge reads recipient context | Measured fit against a structured audience profile |
| Dimensions | 3 (slop, personalization, recipient fit) | 4 frameworks scored 0–10 with weighted dimension breakdowns: engagement, personality fit, strategic clarity, framing |
| Audience profile | None (raw context in the judge prompt) | Structured profile: personality scores with a confidence value, processing route (central/peripheral), recommended influence principle, vulnerability flags |
| Reproducibility | Varies run to run | Same inputs, same scores — comparable over time |
| Fix suggestions | Judge's rewrite suggestion | Prioritized rewrites tied to the measured gap, plus "the one thing" to change first |
| Ethics gate | None | `vulnerability_flags` marks audiences needing care before persuasion tactics apply |

## What the API actually returns

From the live tool surface (verified 2026-10-25):

- `analyze_content` — all four frameworks in parallel, 0–10 per framework,
  dimension breakdowns with weights, cross-framework insights
- `audience_profile` — personality scores **with a confidence value** (low
  confidence is reported, not hidden), ELM processing route, dominant moral
  foundations, vulnerability flags, recommended persuasion principle with
  rationale
- `optimize_email_for_prospect` — profile + draft scoring + prioritized
  rewrites + `one_thing` in a single call

The confidence value matters: when recipient signals are weak, the backend
says so instead of guessing harder. That is the facts-not-personas directive
implemented at the API level.

## One-to-many: segment profiles, not personas

For the batch use case, each segment (lapsed 6–12 months, active weekly,
complained once) gets a profile built from observable facts in the CSV —
tenure, frequency, spend, lapse length. The draft is measured against each
profile. Output: fit distribution across segments, verdict per segment,
variant suggestion per failing segment. No role-play personas anywhere in the
loop — profiles are framework measurements with confidence values.

## The demo contrast, scripted

1. Built-in scorer on the price-increase draft: passes style checks, judge
   says "fine" (7/10-ish).
2. SEMalytics backend, same draft, long-tenure segment: flags a framing
   mismatch — cost-based justification to a relationship-loyal audience —
   the exact pattern the 2026 Journal of Marketing experiment found performs
   no better than silence.
3. Line: "A vibes judge says it's good. A measurement instrument says it's
   wrong for *this* reader."

## What it does NOT add

The gate mechanics, verdict thresholds, score log, batch runner, skill, and
web UI are the open-source core and identical on both backends. The API
upgrades the judge; it never replaces the instrument. If the key is absent or
the API is unreachable, Send Check falls back to the built-in scorer and says
so in the scorecard notes. The demo never hard-fails on this path.

## Integration notes (build)

- Adapter: `scorers/semalytics/` — request in, Scorecard out, ~50 lines.
  No SEMalytics internals in this repo (pre-existing tech, out of hackathon
  scope — see README IP note).
- Config: `SENDCHECK_SEMALYTICS_KEY` and `SENDCHECK_SEMALYTICS_URL` in `.env`
  only. Never committed, never logged, never in a scorecard.
- Latency: full scoring on the refine path runs tens of seconds. For the demo,
  pre-run the SEMalytics calls on the corpus and cache the scorecards; the
  live paste-box demo uses the built-in scorer. Never run an uncached
  SEMalytics call on stage.
- Key hygiene: scoped event key, revoked Sunday night.
