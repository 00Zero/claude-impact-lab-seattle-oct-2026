# Requirements

## Who it's for

**Small-business owners and founders** who are launching something, or who suspect their pitch isn't reaching the right buyer. Examples: a bakery adding catering, a two-person software company, a local gym repositioning.

They don't want "AI personas." They want plain answers:
- **Who** should I go after first?
- **What** should I say to them?
- **What** cheap, real-world test should I try this week?

**Core promise:** reduce the cost of being wrong about your market.

**How this differs from asking ChatGPT,** visible within 30 seconds of using it:
1. Every insight links to a **real source**.
2. The audience **talks like real customers**, using cited quotes.
3. The answer comes from **blind, counted choices** (with "none of these" allowed), not one model's opinion.

## The MVP flow

| Step | The owner does | GTMagic does |
|---|---|---|
| 1. Start | Clicks **Try an example** (instant), or describes their business: optionally a URL, price, their guess at the best customer, their current headline, and pasted customer reviews or emails | Cleans the input; removes emails and phone numbers; screens out harmful businesses |
| 2. Research | Watches progress | Finds 3–5 customer groups, competitors, and real customer wording, each with a source link |
| 3. Audience | Watches the crowd form | Samples ~48 synthetic customers, each "talking like" 3–5 real quotes |
| 4. Test | Watches customers pick | Writes 4–6 messages and adds the owner's current headline; customers choose blind, or pick "none of these" |
| 5. Decide | Reads three plain answers first | Who to target (compared with the owner's guess), what to say, what to try this week. Details, objections, starter copy and a test plan sit behind a click; Markdown download |

**Stretch:** a refinement round that rewrites the weaker messages to answer the top objections and retests them on a fresh audience.

## Inputs

| Input | Required | Notes |
|---|---|---|
| Description | Yes | ≤ 4,000 characters |
| Business name, website, price | No | Website is used as evidence |
| Guess at the best customer | No | Treated as a **hypothesis to test** |
| Current headline (+ subheadline) | No | Tested blind against our options: "your headline ranked 3rd of 6" |
| Pasted customer language | No | Reviews, emails, notes; ≤ 10,000 characters. The strongest real-language source, especially for local businesses |

## MVP acceptance criteria

A judge, starting from our public URL with no account or API key:

1. Opens the instant example and sees a complete result in under 10 seconds.
2. Starts a live run on their own business. It completes in **under 4 minutes**, under the per-run budget cap, and **without failing on a niche or local business** (thin evidence → a clear warning and a suggestion to paste reviews, not an error).
3. Sees segments with needs and barriers, and every real quote with its source link.
4. Watches ≥30 synthetic customers choose among ≥4 options, plus their current headline if given, with "none of these" allowed.
5. Sees **counts and n**, not just percentages, plus a stability indicator and any low-confidence flags.
6. Gets a recommendation **computed from the results**, including an honest "your guess holds" when it does.
7. Gets ≥3 ranked real-world tests and ≥2 starter assets labeled as drafts.
8. Never sees a simulated number called a conversion rate, or simulated words styled like a real quote.

## Product principles (non-negotiable)

1. **Four kinds of evidence never mix:** owner beliefs, research evidence, synthetic results, real-world results.
2. **Real quotes are real:** built by code from cited sources or the owner's own text, and checked word for word. Simulated words always look different and are labeled "simulated."
3. **Stateless audience:** rebuilt from the evidence every run; no persistent personas, no drift.
4. **The numbers decide, the model explains:** recommendations are computed from counts in code.
5. **Honest labels:** confidence is *exploratory* or *research-backed*, never *validated*.
6. **Drafts, not claims:** generated copy has no testimonials, no invented statistics, no superlatives, no competitor names, and is labeled *Draft: verify before publishing*.

## Out of scope for the hackathon

Accounts and login · persistent personas · running real ad campaigns · importing real campaign results (calibration, phase 2) · full landing-page generation · payments.

## Constraints

| Constraint | Target |
|---|---|
| Time per live run | < 4 minutes (~2.5 min with Haiku simulation) |
| Cost per live run | Hard cap `RUN_BUDGET_USD` (default $4) + daily cap; the example replay is free |
| Access | Public URL, no login; generous per-IP limit (judges share Wi-Fi); global cap of 2 live runs at once, with a queue |
| Reliability | The instant example never calls the API; a live run survives individual failed calls |

## Privacy, safety, and legal

- The start form says: *"Don't paste personal or confidential information."* Emails, phone numbers and @handles are removed automatically.
- Runs are reachable only by their unguessable link, can be deleted by the owner, and are auto-deleted after 7 days. Inputs are never used for training.
- Quotes from the web are short excerpts, always shown with a link to the source; we never republish whole reviews.
- Harmful businesses are declined at intake.
- No secrets in the repo; API keys live only in host env vars, with spend limits.

## How we score against the judging

Each criterion is scored 1–8, all equally weighted.

| Criterion | What gets us a 7–8 | Owner |
|---|---|---|
| Does it work | The instant example plus a live run from the URL; survives failed calls; thin-evidence mode | Platform |
| Ease for a small business | Hosted, no setup, an example button, plain-English labels (no "ICP", "lexicon", "stability score" in the UI) | Founder Experience |
| Impact on operations | A repeatable check before every campaign ("test my current headline"), plus a this-week test plan | Strategy |
| Creativity | Real-quote-grounded audience; the live crowd; blind counted choices; challenging (or confirming) the owner's guess | Audience + Experiments |
| Teamwork | Five distinct owners with visible PRs, plus named pitch and real-user-research roles; each person presents their part | Everyone |

## Open questions

- [ ] **Pre-event code:** do the organizers allow code or scaffolding before the start, or only planning? Get the answer in writing. *Until Nick says "go," this folder stays planning only.*
- [ ] **Hackathon length:** sets the checkpoint timing in TASKS.md.
- [x] **Framing:** both. Small businesses *and* founders, and both have to get a good answer. The pitch shows one of each (see TASKS.md → Demo plan), and the CP2 test set includes both.
- [ ] **Demo businesses:** one startup and one local small business that judges recognize instantly, ideally a real one willing to let us use its reviews.
- [x] **Simulation model:** Haiku 5.5.
- [x] **Refinement round:** a stretch goal we'll aim for (the first stretch item after CP2).
- [ ] **Hosting:** see TECH_STACK.md → Hosting.
- [ ] **Roles:** are all four teammates coding? See TASKS.md → "If a teammate isn't coding." Nick can pick up code in any workstream.
