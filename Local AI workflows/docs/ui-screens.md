# Four-screen UI specification

Proposed screens; no claim of implementation.

| Screen | Main content | Primary actions | Success/exit |
| --- | --- | --- | --- |
| Upload documents | Local file/paste input, supported formats, note-type selection, preference confirmation | Create my template; use default | Confirmed inputs or direct default route |
| Preparing template | Current phase, bounded iteration count, elapsed time, cancel | Cancel; retry after failure | Draft created -> Template Control |
| Template Control | Generated draft/defaults, prompt, preferences, active version, history | Save draft; activate approved; simulate; compare; restore | Template remains visible and manageable |
| Main Meeting: Simulation | Fictional transcript B, real generated note, style/version badge, progress | Generate; cancel; accept; edit note; improve template | Explicit acceptance or targeted revision |

## States to distinguish

- Template: draft / active approved / archived.
- Run: queued / running / completed / cancelled / failed.
- Input: fictional development / fictional simulation / real session.
- Feedback: session-specific edit / recurring preference / uncertain.
- Validation: code checks / experimental judge / clinician-reviewed.

A completed model call is not clinician approval. Saving a draft does not activate it. Restoring a style does not regenerate historical notes. A default option is not a marketplace.

## Scope for the first demonstrable slice

One supported text input -> one internal development fixture -> draft -> Template Control -> one separate simulation fixture -> real Ollama note -> accept or revise -> saved version.

Defer polished document extraction, broad model/hardware support, and automated evaluator sophistication until this slice works. Do not defer the separation of development vs simulation, truthful model behavior, or visible active-version state.

## Copy

- “Preparing your template” rather than “Training your AI.”
- “Simulated session — fictional transcript, generated locally.”
- “Apply to future notes?” distinguishes a recurring style change from a single-note edit.
- “Checks passed” lists the actual checks; never substitutes “Clinically verified.”
