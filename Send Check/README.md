<img src=".claude-plugin/icon.png" alt="Send Check logo" width="96">

# Send Check

**The missing skill: 44 skills in Claude for Small Business write for you. None of them score whether you should send it.**

Send Check is an open-source quality gate for AI-drafted email. Before a price increase, a win-back offer, an invoice reminder, or a cold email goes out, it scores the draft against the people who will actually read it and returns a verdict: **send, fix, or scrap**, with the evidence behind it and a fit-checked suggested fix you approve. It never sends anything.

> "Preventing AI-slop is critical because it makes you look like an amateur. I have not embraced full automation of many tasks because I don't trust or don't like the output."
> — small business owner, WA Small Business AI Survey, Oct 2026

## One email to many people is many emails

A small business rarely writes to one person. It sends one draft to a whole list, and the people on that list are in very different situations. Send Check splits the list into segments by facts the business already has (how long they've been customers, last visit, rate, payment history) and checks the draft from each group's side.

**Example** (a fictional business with synthetic data, like everything in this repo). Saltwind Kayak & Whale Tours, a two-person tour company, had its hired shuttle no-show twice in August. 31 guests missed tours they had paid for. The owners' AI-written apology, offering 20% off, was about to go to all 520 past guests. A style check passes it: Send Check scores it **100 for "sounds human"**. The writing isn't the problem. The list is:

| Segment (from the guest list) | People | Verdict | Why |
|---|---|---|---|
| Stranded by the August shuttle no-show | 31 | Fix | Offers 20% off when the owners' own policy promises a refund or a free rebook |
| Deposit paid on a 2027 trip | 58 | Fix | They weren't on the affected trips, yet the apology treats them as affected |
| Traveled this season, unaffected | 58 | **Scrap** | No shuttle problem, yet they get an apology and a discount |
| Last trip over a year ago | 336 | **Scrap** | Apologizing to 336 unaffected people spreads the bad news |

Overall: **scrap**. Each group that needs a fix gets its own version to approve. (Scores move a few points between runs; the findings stay the same. Scenario and guest list: [`corpus/fixtures/21-tour-operator-apology-to-whole-guest-list.md`](corpus/fixtures/21-tour-operator-apology-to-whole-guest-list.md) and [`saltwind-tours-guests.csv`](corpus/fixtures/data/saltwind-tours-guests.csv).)

## Try it

### The web page

```bash
git clone https://github.com/internexio/send-check && cd send-check
uv sync
cp .env.example .env        # then add ANTHROPIC_API_KEY
uv run python -m web.app    # open http://localhost:8000
```

1. **Your email:** paste the draft, or click an example (Price increase, Win-back, Cold email).
2. **Who it's for:**
   - **One person:** name, role, company, an optional company website, and what you know about them.
   - **A list:** upload a customer list (CSV or Excel), drop it on the box, or paste it, then press **Auto-segment**. Or add segments by hand. A synthetic 340-customer sample list is built in, and the Saltwind guest list is in `corpus/fixtures/data/`.
3. **Check draft.** Results are built to scan in seconds:
   - the verdict and score, then **one line on why**, right under it
   - for **fix**, the suggested version (Approve & re-check, Copy); for **scrap**, one line on what it needs
   - everything else (scores per dimension, evidence) collapsed under "Why this score"

   Lists show the same thing for every group.

**Your profile** (one tab, saved in your browser only): name, company, signature, what your business offers, and a few emails you've sent. Every check uses it. Suggested fixes end with your exact signature and cite only the facts you gave. "Sounds like you" compares the draft with your saved emails. The header has a ◐ Auto / ☀ Light / ☾ Dark theme switch.

Without an API key, the page still scores generic phrasing, style, and length, and estimates the rest.

### The Claude plugin

In Claude Code:

```bash
claude plugin marketplace add internexio/send-check
claude plugin install send-check@send-check
```

Then use Claude as usual:

- **It runs on its own.** Ask Claude to write a customer email or outreach, and Send Check scores the draft before Claude shows it to you.
- **Check a draft:** "Should I send this to Dana? Here's the email … and her bio …"
- **Check against your customer list:** "Check this price-increase email against customers.csv." Send Check profiles the file locally, proposes segments, and returns a verdict per segment.

The first time it runs, Claude Code asks you to allow the Send Check skill. That one approval lets it run its own check scripts for that turn. The plugin needs nothing else installed: its scripts use the Python standard library.

## How it scores

Three layers, cheapest first, merged into one scorecard:

1. **Deterministic checks** (`scorers/naive/mechanical.py`, `slop.py`, `voice.py`): generic phrases from Anthropic's and Cursor's own slop lists (`corpus/ATTRIBUTION.md`), length for the message type, the ask, AI style tells (uniform sentences and paragraphs, missing contractions), and an optional match against emails the owner actually sent.
2. **A Claude judge** (`scorers/naive/judge.py`): scores personalization and fit for this recipient or segment, names the fact behind every finding, and proposes a fit-checked suggested fix. It runs on its own model (`SENDCHECK_JUDGE_MODEL`, default `claude-opus-5-5`), separate from whatever drafted the email.
3. **One shared rubric** (`skills/send-check/reference/rubric.md`), used by both the page and the plugin. It includes:
   - **Facts, not personas.** Segments are judged only on observable facts, never invented personalities.
   - **Disqualifying tells** from the team's [humanization rubric](docs/humanization-rubric.md) cap a draft at scrap: an unfilled merge field, leftover assistant text ("Certainly! Here's a draft"), a fake "Re:", flattery as the only personalization.
   - **Stakes-based pass lines.** Cold outreach needs 82+ to send; client mail needs 75.
   - **Always-flag misses.** "Our costs went up" as the reason for a price increase does no better than giving no reason (2026 field experiment).
   - **"Don't send to this group"** is a valid fix.

For a list, every segment is scored in parallel. The worst segment decides the verdict, and scores are weighted by segment size.

## Privacy

- **Customer lists stay local.** Claude sees only column summaries (ranges, common values, counts). Names, emails, phone numbers, addresses, IDs, free-text columns, and protected characteristics are dropped before anything is summarized. Python applies the proposed segment rules to the rows of your file on the server. The plugin's `segment_csv.py` works the same way, and the skill tells Claude never to open the file itself.
- **No social media.** The company-website box reads a public business page only. It refuses LinkedIn, X, Instagram, and other social profiles, and any non-public address.
- **Nothing is sent.** Send Check measures; the owner approves every word.

## Does it work?

The first 20 synthetic small-business scenarios in `corpus/fixtures/` were scored per segment and graded against the problems each one is expected to raise. Those expected problems were written before the tool ran, and a separate Claude call does the grading. Scenario 21 (Saltwind) was added after this run.

**56 of 71 expected problems caught (79%). 6 of 7 clean cases passed without a false alarm.**

What this shows, and what it doesn't: Send Check finds the problems the team planted in realistic but synthetic scenarios. It doesn't yet show that higher scores lead to more replies, fewer complaints, or less churn with real customers. That needs real-world data (see Future scope).

Full results: [`corpus/validation/eval-results.md`](corpus/validation/eval-results.md). To rerun it (about 2.5 minutes and roughly 80 API calls):

```bash
uv run python scripts/eval_fixtures.py          # or pick fixtures: ... 1 9 12 16
uv run pytest -q                                # unit tests, no API calls
```

## About the data

Every business, person, email, and customer list in this repository is fictional and synthetic: the 21 test emails in `corpus/fixtures/`, the storage-renter and tour-guest lists in `corpus/fixtures/data/` (generated by `scripts/`, with `example.com`-style addresses), and the examples in the web page. No real customer data is included or needed to try Send Check. The quote at the top comes from the WA Small Business AI Survey; the statistics in `docs/` cite their sources.

## Why this exists when slop checkers exist

Cursor ships unslop, a rewrite skill. Anthropic's outreach-composer runs a slop self-test, a checklist the writer applies to itself. Lavender scores email structure. Each makes the writer its own editor, or checks style without the reader.

Send Check is the independent instrument: any draft from any source, measured against the actual recipients, returning a verdict you can gate on.

## Scoring backends (pluggable)

| Backend | What it measures | Status |
|---|---|---|
| `naive` (default) | The three layers above | Built. Needs only `ANTHROPIC_API_KEY` |
| `semalytics` | Audience fit against peer-reviewed personality and persuasion frameworks, reproducibly ([what it would add](docs/semalytics-backend-api.md)) | Not built. See Future scope |

Every backend implements `ScoringBackend` in `scorers/base.py`, and `scorers/segments.py` scores lists with any of them.

## Repository map

| Path | What's there |
|---|---|
| `web/` | FastAPI app and the single-page UI |
| `scorers/` | Scoring contract (`base.py`), naive backend, segments, auto-segmentation, website reader |
| `skills/send-check/` | The plugin skill: `SKILL.md`, the shared rubric, and the stdlib check scripts |
| `.claude-plugin/` | Plugin and marketplace manifests |
| `corpus/` | Phrase lists with attribution, 21 synthetic test emails, two sample lists (storage renters, tour guests), eval results |
| `docs/` | Use cases, humanization rubric, test recipients, SEMalytics notes, plan and demo script |
| `scripts/` | Fixture eval and sample-data generators |

## Status

Built at the Claude Seattle Impact Lab hackathon, Oct 2026. Scaffold (interfaces, docs, CI) prepared the night before kickoff; implementations built at the event.

**IP note:** the SEMalytics scoring API is pre-existing technology and is out of scope of hackathon-built work. This repository contains no SEMalytics internals. A future adapter would only call its public endpoint.

## Future scope

**Reach: no terminal, no setup**
- A hosted version anyone can open, with no API key or install.
- A listing in Anthropic's plugin directory, so owners add Send Check from **Customize → Plugins** in claude.ai or the desktop app, and it also works in Cowork.

**A gate where email actually gets sent**
- A send gate in Claude: when Claude is about to send through a connected Gmail or Outlook tool, a plugin hook runs Send Check first and holds anything marked scrap.
- Checks inside the tools small businesses already use: Gmail and Outlook add-ins, and Mailchimp, Klaviyo, and HubSpot campaigns.
- Customer lists straight from the systems that hold them (Square, Mindbody, QuickBooks, Shopify) instead of CSV exports.
- After approval, export each group with its own version, ready to send from the owner's email tool. The owner still presses send.

**Learning from outcomes**
- A private score log that tracks replies, unsubscribes, complaints, and cancellations after each send, to show whether higher scores lead to better outcomes.
- Per-business calibration of the weights and pass lines once there is outcome data, instead of one rubric for everyone.
- A pilot with real small businesses and an anonymized corpus of their real emails, to replace synthetic scenarios as the main evidence.

**Deeper measurement**
- The SEMalytics backend: reproducible audience-fit scores against validated frameworks, with confidence values, as a drop-in `ScoringBackend`.
- Rules per channel and language: SMS, LinkedIn, and non-English email.

**Speed and cost**
- Faster checks: cache draft-level results across segments, use a lighter model for simple groups, and show partial results as each group finishes.
- A visual scorecard inside Claude (artifacts, or an interactive MCP App) for owners who never leave the chat.

**Teams**
- Shared business profiles and brand voice for small teams, kept private to the business.

## License

MIT
