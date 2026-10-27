# Clinician journey — revised four-screen flow

Current product direction from the team's latest brainstorm (October 25, 2026). This supersedes the earlier onboarding sequence and visual; it is a specification, not implemented behavior.

## 1. Upload documents

**Purpose:** supply the clinician's desired note style, not browse other customers' styles.

- Upload a preferred note/template or paste its text.
- Confirm the note type/modality selection used to choose an internal fictional transcript. Extract and confirm the main preferences within this screen.
- Offer a direct “Use a default style” route to Template Control; uploading is not mandatory for that route.
- Never treat the example's patient facts as reusable prompt content.
- CTA: **Create my template**.

Proposed MVP import support: plain text/Markdown/paste first. PDF/Word extraction is not implemented or promised; accepted formats must be explicit.

## 2. Preparing your template — local internal loop

The system selects **one development transcript A** from a bundled fictional fixture set using the confirmed selection. Build a candidate, generate a real local-model note, check it, and apply bounded targeted revisions.

Show honest phase progress, iteration count, elapsed time, and Cancel. Do not show invented percentage completion. A completed loop creates a **draft**, not a clinically validated template.

“Training” here means prompt development/refinement. No model-weight updates are implied. A judge that has not been calibrated against clinician labels cannot certify quality.

CTA on completion: **Review my template**, opening Template Control. If generation fails, retain inputs and let the clinician retry or choose a default.

## 3. Template Control — persistent home for note styles

Show the newly created draft and built-in defaults, without a customer-style marketplace.

- Name, preference summary, editable prompt, source (generated/default), status, and version.
- Review and edit the draft; select a default instead if preferred.
- Clearly mark the active approved version.
- Save/activate, duplicate, compare revisions, restore, and **Try in a simulated session**.
- Changes produce new drafts; do not overwrite a working active version.
- Initial drafts may be used in simulation before activation. Later updates retain the current active style until approved.

This screen remains available after onboarding. Template creation is not a one-time hidden wizard.

## 4. Main Meeting page — simulated session, real summary

Reuse the meeting/session layout with an explicit **Simulated session** badge. Do not capture microphone/system audio or fabricate a recording.

- Load bundled fictional **transcript B**, different from development transcript A and not exposed to the refinement loop.
- Run the selected draft/default through **real Ollama**, not a canned summary.
- Show source transcript and generated note, selected style/version, progress, retry/cancel, and targeted feedback.
- Actions: accept/activate the initial style; edit this sample note only; or **Improve my template**, returning to Template Control with a proposed recurring preference.
- Keep simulation runs separate from real-session counts, retention behavior, and customer-success claims.

A failed fresh example can drive another revision, but then B becomes development evidence. Use a new untouched example C for the next generalization check. Do not keep calling B “held out” after tuning against its feedback.

The user's requested hackathon path uses Ollama. The inspected Tauri runtime instead uses embedded llama.cpp; compatibility is a separate validation task.

## Continued improvement

Template Control -> simulate a fresh session -> explicit feedback -> choose “this note only” or “future notes” -> proposed version -> regression checks -> clinician approval -> activate.

Retain version history and rollback. Existing notes keep the style/prompt snapshot used when generated. No automatic marketplace discovery, background style replacement, or silent weight training.

## Data capture and failure behavior

See [data capture](data-capture.md) and [screen specification](ui-screens.md). No raw patient content goes into product telemetry. On failed checks or cancelled preparation, preserve the prior approved style. On runtime/context errors, give an actionable message with no cloud fallback.
