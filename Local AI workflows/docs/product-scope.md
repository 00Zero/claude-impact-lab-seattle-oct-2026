# Product scope and acceptance criteria

## One job

Help a clinician independently create and maintain a reusable local note-style prompt.

## In scope

- Example-note intake or starter selection.
- Structured, clinician-confirmed preferences.
- Prompt compilation with fixed factual-grounding rules.
- Internal refinement on one selected fictional transcript, then Template Control, then a separate Main Meeting simulation with real Ollama.
- Explicit feedback and targeted preference/prompt changes.
- Additional examples and separation of development/held-out evaluation.
- Save/export, active-style visibility, version history, and rollback.
- Opt-in reuse of feedback for future style improvement.

## Out of scope

Customer-style shopping/marketplace, recording, transcription, audio retention, diarization, EHR integration, insurance compliance automation, diagnostic advice, autonomous clinical planning, model-weight training, fleet-wide learning, cloud coaching, and background changes without clinician approval.

## MVP acceptance checklist — unimplemented until demonstrated

- [ ] Clinician can start without editing code or contacting the founder.
- [ ] Preference interpretation is confirmed before compilation.
- [ ] Preview runs on a pinned local model/configuration.
- [ ] Feedback changes only the intended preferences.
- [ ] Simulation uses a different fictional transcript from internal refinement; fake inference is disabled.
- [ ] Template Control opens after internal preparation; defaults remain available.
- [ ] Every run is labeled development, simulation, or real; simulation is excluded from real-session usage.
- [ ] A fresh transcript is used before final approval.
- [ ] Example-note facts cannot carry into unrelated sessions unnoticed.
- [ ] Missing next actions follow an explicit omission rule.
- [ ] Style and version can be viewed, saved/exported, updated, and restored.
- [ ] Update does not mutate existing notes.
- [ ] Inference and application data handling remain local; no cloud fallback.
- [ ] Failed checks leave the previous version intact.
- [ ] Setup instructions work on the documented supported hardware.

Clinical fidelity requires domain review. Passing formatting checks does not establish it.

## Technical unknowns

Target model size/quantization, context budget, hardware floor, latency budget, local judge reliability, long-input behavior, and exact Scribular integration contract must be established through experiments. Do not promise compatibility from the model family name alone.
