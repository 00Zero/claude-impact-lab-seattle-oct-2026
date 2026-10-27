# CLAUDE.md — Send Check team charter

Four humans, four Claude Code sessions, nine hours. This file is the single rulebook for both.

## What we are building

A quality gate for AI-drafted outreach. It **scores, measures, flags, and diagnoses** drafts against the recipient, then shows a suggested fix. Send Check never silently rewrites; the owner approves everything.

Language rule for all copy in this repo (README, SKILL.md, web UI, pitch): Send Check and the SEMalytics backend are described with measurement verbs — scores, measures, flags, diagnoses, checks. The *tool feature* "suggested fix" / "fit-checked fix" is a noun, fine. Do not describe the SEMalytics API as generating, rewriting, or optimizing anything.

## The spec is the demo script

`docs/demo-script.md` is the 90-second demo. If a change does not make that 90 seconds better, it is out of scope. Cut list lives at the bottom of `docs/PLAN.md`; add to it freely, build from it never (today).

## Decisions already made (change only by team agreement at standup)

- Python 3.11+, `uv` for env, FastAPI for the web demo, pytest
- The scoring contract is `scorers/base.py`. **Frozen after H1.** Build against it, not around it.
- Trunk-based: branch per task, branches live < 2 hours, squash merge to `main`, PRs required, humans merge
- Secrets in `.env` only (see `.env.example`). Corpus files are anonymized before commit — no real names, companies, or emails
- Verdict scale everywhere: `send | fix | scrap`, score 0–100

## Working agreements

- Vertical slice first: paste → score → verdict with the naive backend must work end to end by H3
- Standup every 2 hours, 5 minutes, blockers only
- H6: record the demo video from the working happy path. H8: feature freeze
- Claude Code sessions: read this file and `docs/PLAN.md` before writing code. Prefer small diffs. Run `pytest` before proposing a PR
- Adversarial review (`.github/workflows/adversarial-review.yml`) comments on every PR. Secrets/broken-build findings block; everything else is advisory. Humans decide

## Roles (fill in at kickoff)

| Seat | Owner | Deliverable |
|---|---|---|
| Skill + architecture | David | `skills/send-check/SKILL.md`, gateway glue (skill wiring) |
| Scoring pipeline | Chirag | `scorers/naive/` (mechanical, slop, judge), tests |
| Web + gateway | Chirag | `web/`, paste-box flow |
| Corpus + story | Karen | `corpus/`, `docs/demo-script.md`, demo video, presents the problem section |
| API adapter + pitch | David | `scorers/semalytics/`, PR merges, pitch close |

---

## Dev setup (calibrator-generated — do not move above team charter)

**Bootstrap:**
```bash
uv sync --all-groups        # install deps + dev group
uv run pytest -q            # must be green before any PR
uv run uvicorn web.app:app --reload   # demo server
```

### File conventions

| What | Where |
|------|-------|
| New scorer | `scorers/<name>/__init__.py` implementing `ScoringBackend` |
| Scorer tests | `tests/test_<name>.py` |
| Demo copy | `docs/demo-script.md` only — nowhere else |
| Corpus samples | `corpus/` — anonymized only, no real names/emails/companies |
| Web routes | `web/` |

### Contract do / don't

**DO:** Implement `ScoringBackend.score()` and return a `Scorecard`.  
**DO:** Use `verdict_from_score()` — don't re-define thresholds elsewhere.  
**DON'T:** Raise from `score()`. Catch internally; return `Scorecard(verdict="fix", notes="<error>")`.  
**DON'T:** Re-define `Verdict`, `Scorecard`, or threshold values outside `scorers/base.py`.  
**DON'T:** Use generation/rewrite verbs in any copy — see language rule in charter.

### Pre-PR checklist

```
[ ] uv run pytest -q passes
[ ] No .env values, API keys, or real contact data staged
[ ] Corpus additions anonymized (synthetic names/companies only)
[ ] Diff serves the 90-second demo — check docs/demo-script.md
[ ] scorers/base.py unchanged (or team agreed at standup)
```

Adversarial CI enforces: contract violations and secrets are [BLOCKING],
scope drift is [ADVISORY]. Humans merge.
