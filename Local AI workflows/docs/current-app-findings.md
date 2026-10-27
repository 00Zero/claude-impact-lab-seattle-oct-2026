# Read-only app inspection findings

Source review on October 25, 2026. No apps were launched, no model performance was measured, no source application was changed, and no live customer records were extracted.

Working trees already contained changes and were left intact. Results refer to inspected local checkouts, not proven deployed behavior.

## Electron — existing application

Inspected base commit: 8992d06, with local changes present.

- `src/renderer/views/settings.js`: note-style editor, built-in/custom distinctions, duplicate/delete/favorite controls.
- `src/store/store.js`: prompt list and active prompt ID in configuration.
- `src/service/summarize.js`: local Ollama generation, selected/active prompt resolution, streamed progress, cancellation, chunk-and-combine behavior.
- `src/renderer/views/session.js`: generating style/model label, rewrite with selected style, previous-summary undo.
- `src/store/sessions.js`: session fields include prompt/model provenance and previous summary/prompt/model.
- `src/utils/usageAnalytics.js`: device-linked aggregate sessions, duration, launches, app version/platform; not note-style acceptance.
- `src/utils/errorReporter.js`: user-facing error messages/metadata can be sent to a backend; not suitable as-is for the proposed content-free event schema.

A style ID points at mutable current configuration; it is not sufficient immutable version provenance. Previous-summary undo is not full template-version rollback.

The `--e2e-test` summary branch returns canned model output. Do not use it for a “real Ollama summary” demonstration. Do not count fictional simulation session saves as ordinary customer usage.

## Tauri — newer application under development

Inspected base commit: 6223887, with local changes present.

- `src/App.svelte`: Record and Settings views.
- `src/lib/components/Settings.svelte`: summary-prompt selection.
- `src-tauri/src/store/prompts.rs`: seeded default prompts; inspected interface provides list/get rather than a complete style editor/version API.
- `src/lib/types/Session.ts` and `SessionPatch.ts`: session IDs, prompt/model IDs, transcript/summary and editable fields.
- `src/lib/types/Timings.ts`: model load, chunk, combine, save, and tail-transcription timings.
- `src-tauri/src/jobs/summarize.rs`: cancellable job, progress, token-budgeted chunks and combine.
- `src-tauri/src/llm/llama.rs`: **embedded llama.cpp**, Gemma-2-2B, context budgeting, local generation.
- `src-tauri/src/llm/prompt.rs`: generation/combine prompt formatting and chunk budget.
- `fake-engines` swaps model behavior for testing; it is not real inference.

The inspected Tauri UI is not feature-equivalent to Electron's full style controls. Existing session edit APIs do not prove an implemented edit/review screen. Do not conflate a typed API with delivered UI.

## Private custom-prompt workflow

Separately inspected README, config/validator/tester modules, and the delivered prompt.

- Customer requirements/config -> prompt -> synthetic transcripts -> Ollama test.
- Feedback revises the prompt via Claude CLI, retests, and records before/after revisions.
- Supports additional transcript examples.
- Private customer configs/deliverables/history are not copied into this repository.

Reuse the structure and learning signals, not the cloud revision dependency or customer-specific data. The legacy revision path supplies only a transcript excerpt to the reviser; a new evaluator should not pretend it checked the complete source unless it actually did.

## Consequence for the hackathon

Implement the requested real-Ollama simulation first, independently of recording. Use the same summarization adapter for development A and simulation B, with distinct fixture/run purposes. Later test exported prompts through Tauri's actual llama.cpp path; Ollama success alone is not compatibility proof.

These findings justify a small adapter and new template-control/version layer, not a rewrite of either recording pipeline.
