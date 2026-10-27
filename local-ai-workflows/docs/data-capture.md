# Data capture: learn what improves the note-style workflow

## Decision

Capture detailed improvement evidence **locally**, and separate that from optional, content-free product analytics. The founder authorized inspection of both apps and the private prompt workflow; that is not permission to publish or centrally collect other clinicians' patient content.

No new collection or export has been implemented. Source inspection did not read live user databases, audio, or production telemetry.

## What to learn at each stage

| Stage | Signals | Product question |
| --- | --- | --- |
| Upload | Started/confirmed/default chosen, file type/count/size bucket, parse outcome, confirmation edits, active interaction time | Is document intake useful or a barrier? What extraction/preferences need fixing? |
| Internal loop | Fixture A ID/version, candidate IDs, iteration count, model/runtime configuration, generation/check durations, failure/cancel codes | Is local refinement reliable and fast enough? Does another iteration help? |
| Template Control | Generated vs default choice, draft saved, prompt/preference edit categories, activation, version creation, restore | Is the generated style actually useful? Are controls understandable? |
| Meeting simulation | Fixture B ID/version, real generation outcome, acceptance/rejection, reason tags, active review time, edit amount, improvement requested | Does the style transfer beyond the development case? |
| Continued updates | Note-only vs recurring choice, proposal approved/rejected/deferred, rollback, recurring failure trends, post-update editing burden | Do updates make things better without breaking a working style? |

Do not equate copy/save with acceptance, silence with satisfaction, or a lower edit count with clinical correctness.

## Minimum event vocabulary

- intake_started, intake_confirmed, default_selected
- refinement_started, refinement_iteration_completed, refinement_finished
- template_reviewed, template_saved, template_activated
- simulation_started, simulation_finished, feedback_submitted
- style_update_proposed, style_update_decided, style_restored

Emit finished outcomes explicitly: success / failed / cancelled. Deduplicate by event ID, not UI rerenders. Link iterations to one attempt and runs to a specific immutable style version.

## Local-only learning record

Store uploaded/extracted text, confirmed preferences, candidate prompts, generated output, user revisions, optional free-text feedback, check evidence, approval history, fixture provenance, and a prompt snapshot per generation. Treat prompts and edits as potentially containing clinical information too.

Keep raw text out of general debug/error logs. Support inspection/deletion and define retention before deployment. Keep real-session content out of portable style exports unless the clinician deliberately includes and reviews it.

## Product analytics export — optional and separate

Only an allowlisted projection of events should be exportable, with a clear sharing control or a manually reviewed diagnostics bundle.

Candidate fields:
- event schema version; event type; app build/platform; coarse hardware class
- event-scoped attempt/run aliases; flow version; generated/default source
- synthetic fixture ID/version and purpose
- runtime/model/configuration version; iteration and duration buckets
- success/cancel/failure enums; predefined reason tags; approval/restore counts
- coarse preference categories and amount-of-edit buckets, never edited text

Treat any installation-level identifier as pseudonymous, not anonymous. Exact local style IDs, document names, custom style names, content hashes, patient/session titles, exact session times, prompt text, notes, audio, transcript text, free-text feedback, stack traces, and arbitrary error messages do not belong in this export. Local identifiers in examples must not silently become stable cross-device identity.

## Capture reason, not just clicks

Suggested selectable tags: too_long, wrong_sections, wrong_perspective, quote_problem, unsupported_content, omitted_content, attribution_error, wrong_actions, other. The optional “other” explanation stays local.

Always record whether feedback is for the current note or future notes. Do not convert every correction into a recurring preference automatically.

## Measures that answer the core hypotheses

1. Independent completion: eligible attempts that reach explicit activation, with assisted attempts labeled separately.
2. Time to accepted style: active interaction time and wall-clock time separately; show model waiting separately.
3. Transfer: explicit acceptance of an untouched simulation fixture, not fit on development A.
4. Refinement value: comparable baseline vs refined outputs reviewed under the same conditions.
5. Continued value: recurring corrections and active editing burden before/after an approved update, with runtime and transcript differences acknowledged.
6. Reliability: cancelled/failed runs, context overflows, invalid outputs, and restore frequency.

Simulation metrics are not clinical outcomes or real customer session counts. A single fictional case cannot establish clinical reliability.

## Existing hooks and gaps

Electron has existing session-save, prompt-ID provenance, regeneration, prior-summary undo, usage analytics, and error reporting hooks. Its current usage counts do not measure style acceptance. Tauri has typed session/progress/timing data and a prompt selector, but not the complete new flow.

Add immutable prompt versions and run purpose to both integrations before interpreting changes. Classify runs as development / simulation / real; exclude the first two from real-session usage.

Do not copy the existing remote payloads/gating as a new privacy contract. The inspected Electron analytics module sends device-linked aggregate usage; the error reporter can send message/metadata. The new flow needs an explicit content-free allowlist and consistent export control on every send path, including first-use and app-close hooks.

## Suggested first pilot

Use newly created fictional inputs. Record the event funnel, times, preference corrections, acceptance reasons, and one later approved update/restore. Compare against a non-refining default/compiled baseline. Publish only reviewed synthetic measurements with hardware/settings and limitations.
