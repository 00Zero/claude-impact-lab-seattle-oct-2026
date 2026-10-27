# Hackathon judging and delivery

Source reviewed October 25, 2026: https://hack.claudeseattle.org/

## Deadline

October 25, 2026 at **5:30 p.m. Pacific** (America/Los_Angeles, UTC-07:00), equivalent to October 26 at 00:30 UTC. This matches the user-supplied deadline and event schedule.

## Rubric

The website lists five equally weighted criteria, each scored 1–8:

| Criterion | What this project should demonstrate | Evidence still needed |
| --- | --- | --- |
| Does it work | Create -> preview -> revise -> save -> update -> rollback | Actual end-to-end runnable demo, not slides |
| Ease of implementation for a small business | Clear setup and a clinician-facing workflow without code edits | Fresh setup on supported hardware from README |
| Impact on business operations | Replace founder-mediated customization and reduce recurring corrections | Measured pilot/support/editing-time results |
| Creativity | Local, controlled adaptation of reusable styles with evidence-grounded checks | Working difference from a generic chatbot/template |
| Teamwork | Distinct visible business, design, research, engineering, and pitch contributions | Verified contributors and artifacts in TEAM.md |

The event expects a working tool with README, repo, and demo video. Slides are optional. A public documentation repo is useful preparation, **not fulfillment of those requirements**.

## Smallest build plan

1. Document intake with confirmed selection/preferences.
2. Internal bounded prompt-development loop on fictional transcript A.
3. Template Control with generated draft/defaults and saved versions.
4. Main Meeting simulation: different fictional transcript B, real Ollama, visible selected version.
5. Explicit feedback, proposed update, objective checks, approval, and rollback.
6. Document actual startup, hardware/model, limitations, and measured behavior.
7. Record demo and complete submission through the event site.

Do not add recording/transcription, EHR, insurance automation, or autonomous retraining to this plan.

## Proposed demo script

- Introduce the de-identified founder-assisted journey.
- Start with a fictional example style and inspect confirmed preferences.
- Generate a local preview.
- Request “shorter, but retain source-supported interventions.”
- Show the proposed change and fresh example.
- Save; open My Note Style to show active version.
- Make a later approved update and roll back.
- Show measured runtime and remaining limitations.

Distinguish any mocked UI/checks from actual local-model behavior.

## Submission checklist

- [x] Public project foundation prepared.
- [x] De-identified customer journey and scope documented.
- [x] Existing delivered prompt reviewed and sanitized.
- [x] Runnable tool and setup verified on the author's machine (see README Verification); a fresh setup by another teammate is still pending.
- [x] Supported runtime/hardware pinned: Ollama 0.40.11 + gemma4:e4b on Apple M5 / 16 GB.
- [x] End-to-end flow completed with real local inference (scripts/e2e_demo_check.py).
- [ ] Clinician/evaluator results recorded without inflated claims.
- [ ] Actual team contributions recorded.
- [ ] Demo video URL added.
- [ ] Required submission fields completed on event site.
- [ ] Submission receipt confirmed before deadline.

## Use of Claude

The event theme mentions building with Claude. The intended clinician runtime remains local. Existing founder-assisted tooling uses Claude, but that predates the hackathon and must not be claimed as new work. Record the team's actual development use honestly; do not claim eligibility based solely on this planning document.

## Brainstorm scope refinement

Customer-style shopping is explicitly de-scoped. The four screens and data-capture specification supersede the earlier onboarding order. Do not claim Tauri compatibility from Ollama-only results.
