# Send Check — build plan (9 hours)

## The one-sentence spec
Paste a draft + who it's for; get a verdict (send/fix/scrap), evidence, and a suggested fix — from a Claude skill or a web page.

## Why this wins on the rubric
| Criterion | Our answer |
|---|---|
| Does it work | Vertical slice by H3; naive backend has zero external dependencies |
| Ease of implementation | Install as a Claude skill or open the web page; README written for an owner, not a dev |
| Impact | Outreach is the revenue motion; survey evidence from the event's own data |
| Creativity | 44 official skills write for you; we built the one that scores whether to send |
| Teamwork | Four distinct, demo-visible roles; non-code roles present the corpus and the story |

## Hour-by-hour
| Hour | Milestone | Owner |
|---|---|---|
| H0 (20 min) | Roles on whiteboard, demo script agreed, interface walkthrough | all |
| H1 | `scorers/base.py` reviewed and FROZEN; repo cloned by everyone | all |
| H1–H3 | **Vertical slice**: paste → mechanical checks → verdict in web UI | web + scoring |
| H1–H3 | Corpus: 20 real emails anonymized into `corpus/samples/` | corpus owner |
| H3 | Slice demo at standup; cut scope if slipping | all |
| H3–H5 | slop.py + judge.py land; SKILL.md tested in Claude; SEMalytics adapter wired | scoring / skill / David |
| H5–H6 | Scorecard UI polish; batch-score the corpus for the impact stat | web + corpus |
| H6 | **Record demo video from working happy path** | story owner + David |
| H6–H8 | SEMalytics-vs-naive contrast demo; README quickstart verified on a clean machine | all |
| H8 | FREEZE. Submission copy, pitch rehearsal ×2 | all |

## Demo script (the spec) — 90 seconds
1. (15s) "Everyone in this room used AI to draft outreach this week. Most of it reads identical. Here's one of twenty real cold emails from our corpus."
2. (40s) Paste draft + prospect URL → verdict: FIX 52/100 → evidence lines → suggested fix → approve.
3. (20s) Same draft, SEMalytics backend: catches a recipient-fit mismatch the generic judge scored as fine. "A vibes judge says it's good. A measurement instrument says it's wrong for *this* reader."
4. (15s) "MIT-licensed, installs as a Claude skill in the official plugin style. We scored our own pitch with it — verdict on screen. Repo's live."

## Cut list (do not build today)
- Reply tracking / score-to-reply correlation (roadmap slide only)
- Gmail/CRM integrations
- Auth, accounts, persistence beyond a JSONL score log
- Embeddings-based slop detection (n-gram is enough for demo)
- Batch UI (CLI batch for the stat is fine)
