# CLAUDE.md — Scribular Note-Style Coach

## Read first

Follow [AGENTS.md](AGENTS.md), then read:
1. [README.md](README.md) — actual implementation status.
2. [Product scope](docs/product-scope.md).
3. [Four-screen workflow](docs/user-workflow.md) and [UI specification](docs/ui-screens.md).
4. [Architecture](docs/architecture.md) and [app inspection findings](docs/current-app-findings.md).
5. [Evaluation plan](docs/evaluation-plan.md) and [data capture](docs/data-capture.md).

Latest explicit team instructions supersede earlier proposals. Keep these documents consistent when decisions change.

## Mission and status

Help therapists create and maintain reusable note-style prompts locally, without founder-mediated prompt engineering.

At the time this file was added, this repo contained planning/evidence documents and examples, not an application. Inspect the current tree before assuming this is still true. Do not invent startup scripts, tests, dependencies, or completed features. Update the README with actual commands and verification results as implementation lands.

Hackathon deadline: October 25, 2026, 5:30 p.m. Pacific (America/Los_Angeles), equivalent to October 26, 00:30 UTC. Favor a working vertical slice over infrastructure. The event requires a working tool, README, public repository, demo video, and actual team contributions; a documentation repo alone is not a finished submission.

## Required user flow

1. **Upload documents:** start with paste/plain text/Markdown; confirm note-type selection and style preferences. A matching transcript is not required. A default-style route may skip upload/preparation.
2. **Preparing your template:** internally refine a candidate on one selected fictional development transcript A. Show real phases, iteration count, elapsed time, retry/cancel.
3. **Template Control:** review generated draft, edit preferences/prompt, choose built-in defaults, inspect active version/history, and launch a simulation.
4. **Main Meeting: Simulation:** use fictional transcript B, different from A, and generate a real Ollama summary. Display source, result, style/version, and explicit feedback/acceptance.

Template Control remains available for future updates. Do not build customer-style shopping or a marketplace.

## Demo architecture — recommended defaults, not an existing stack

- Standalone local web UI -> local backend -> prompt compiler / bounded refinement -> Ollama.
- Backend -> local version/run store. Keep inference and persistence behind small interfaces.
- Reuse an adequate maintained framework/library; do not invent an evaluation platform.
- If a stack is already established in this repo, extend it rather than replacing it to match a preference.
- Bind local services to loopback by default. No hosted model, hosted judge, or automatic cloud fallback.
- Ollama defaults to loopback. An explicit private-host opt-in sends note and feedback text to that configured host; configurable routing does not prove same-process residency, and separate-host hardware is unmeasured.
- Pin one model/configuration and supported demo machine first. Record actual model tag/digest, context/output limits, sampling parameters, runtime version, and hardware.
- Keep Inspect AI as a development evaluation tool, not a clinician-facing requirement. Phoenix is optional/deferred.
- Do not require an agent framework or multiple models to implement the loop.
- Do not modify or migrate the existing Electron/Tauri applications for this standalone demo unless specifically requested.

Electron and the private custom-prompt tool use Ollama; the inspected Tauri checkout uses embedded llama.cpp. Do not claim Tauri compatibility based on Ollama output. Electron E2E and Tauri fake-engine modes return fake model output; neither satisfies the real-generation demo requirement.

## Prompt development and evaluation

- Extract **style preferences**, not patient facts, from uploaded examples.
- Let the clinician confirm uncertain interpretations.
- Compile prompts from tested instruction blocks with fixed factual-grounding constraints.
- Start with targeted edits and at most two automated refinement rounds per candidate; this is an initial budget, not a proven optimum.
- Preserve the previous working version when revisions fail checks, are cancelled, or exhaust the budget.
- Discover concrete failure modes by reviewing outputs before adding generic scores.
- Use code for objective checks; use clinician review for usefulness and factual fidelity.
- A local judge is experimental until tested against clinician labels on separate examples. It must not auto-certify a note as clinically correct.
- Keep A for development and B out of the refinement context. If feedback on B informs an update, B becomes development evidence; use untouched C for the next generalization check.
- Keep a final evaluation set separate from iterative tuning.
- Never invent quotes, interventions, diagnoses, goals, or next actions to satisfy a format.
- Preserve speaker attribution and explicit omission rules. Formatting checks alone cannot establish factual accuracy.
- Check context budgets explicitly; fail visibly rather than silently truncating.
- Label “training” accurately: this MVP changes prompts/preferences, not model weights.

## Versioning and continuous improvement

Store immutable style versions: style ID, version/parent, confirmed preferences, compiled prompt, change explanation, approval state, and runtime/validation references.

Each generation run references an exact style version and prompt snapshot, model/runtime configuration, fixture ID/version, and purpose: development / simulation / real.

Saving a draft is not activation. A model completing a run is not clinician approval.

Feedback must distinguish “this note only” from “future notes.” Recurring preferences create a proposed version -> checks/previews -> explicit approval -> activation. Support rejection, deferral, and rollback. Never silently replace styles, train on edits, or rewrite historical notes.

## Privacy and publication

This is a public repo. Follow [publication boundaries](docs/privacy.md).

- Never commit original emails/PDFs, customer names/contact details/credentials, private configs/paths/history, or real session excerpts.
- Demo/test fixtures must be newly created fictional content, labeled as such.
- Treat uploaded documents, prompts, notes, edits, and free-text feedback as potentially sensitive. Keep them local and out of general logs, analytics, screenshots, and source control.
- No runtime content leaves the machine for this demo. Shared product analytics are deferred; local learning events may use the schema principles in docs/data-capture.md.
- Separate development/simulation runs from real-session usage counts.
- Do not copy existing device-linked usage/error payloads into a new telemetry design.
- Do not claim anonymization, legal compliance, clinical validation, or quantified savings without evidence.

## Implementation and collaboration

- Inspect git status before editing; preserve others' uncommitted work. Never reset, force-push, or overwrite another contributor's changes.
- Prefer small, reviewable commits and explicit file staging.
- Build the full narrow flow before adding document parsers, dashboard polish, broad model support, or integrations.
- Keep technical internals out of clinician UI unless they enable a meaningful decision.
- Record actual contributors/artifacts in TEAM.md; do not infer contributions from conversation participants.
- Documentation of private app behavior must be paraphrased and source-grounded, not a bulk code/data copy.

## Verification before calling the demo ready

- Run the repository's actual checks and document the commands/results. Never report unrun tests as passing.
- Verify the end-to-end flow using real local inference on A and distinct B.
- Verify draft vs active state, immutable provenance, approved updates, rollback, cancellation/failure preservation, and optional-section rules.
- Check local-only data flow and that fictional runs do not count as real customer sessions.
- Use focused automated checks where they protect meaningful behavior; do not write tests merely mirroring implementation or for documentation-only changes.
- Document actual setup steps, supported file types, model/hardware, latency, limitations, and any mocks.
- Keep implementation status and submission checklist truthful. Do not report an event submission as complete without its receipt.

## Explicitly out of scope

Recording/transcription, audio retention, diarization, EHR integration, insurance automation, clinical decision-making, cloud coaching, model-weight training, fleet-wide learning, customer-style marketplace, autonomous background changes, and integration into both desktop apps.

PDF/Word import, shared analytics, and advanced local judges can follow the working core slice; do not imply they already exist.
