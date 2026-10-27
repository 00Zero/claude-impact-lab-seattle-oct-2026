# Local-first architecture and existing solutions

## Existing-options preflight

Use established components where adequate; do not build a new evaluation platform.

- **Ollama:** existing product-adjacent local model runtime.
- **Inspect AI:** open-source experiment harness with datasets, solvers, scorers, logs, and local Ollama support.
- **Hamel/Shreya evals-skills:** development procedures for error discovery, code checks, judge design, and validation. Skills themselves do not guarantee local execution; the executing agent determines that boundary.
- **Phoenix:** optional self-hosted trace/review platform; not required for the first slice.

References:
- https://hamel.dev/blog/posts/field-guide/
- https://github.com/ai-evals-course/evals-skills
- https://inspect.aisi.org.uk/providers.html#ollama
- https://arize.com/docs/phoenix/self-hosting

No new dependency installation or empirical local performance validation was performed while preparing this foundation.

## Proposed separation

**Clinician-facing flow:** document intake -> confirmed selection/preferences -> prompt compilation and bounded development loop on A -> Template Control -> Main Meeting simulation on B -> approved version.

**Development evaluation:** synthetic cases + clinician labels -> experiment runner -> code checks and validated narrow judges -> regression comparison.

Do not require clinicians to operate Inspect or an evaluation dashboard.

## Local data boundary

Keep intake, drafts, feedback, prompts, histories, and inference on the user's device. Downloading tools/models is distinct from sending runtime content. Configure all generators and judges to local endpoints; inspect telemetry, remote assets, exports, and logs before claiming offline operation.

No hosted judge or fallback is required. A cloud coding assistant used to develop software is separate from the proposed runtime; do not send private customer data to it as part of this architecture.

## Context and latency

The existing private tester processes transcript chunks and combines intermediate notes; app equivalence must be checked against the pinned current product version, not inferred from an old README. A new standalone prototype must not claim identical behavior without comparison.

Pin model tag/digest, quantization, context setting, generation parameters, hardware, and transcript preprocessing. Keep tasks narrow. Separate drafting and judging contexts can use the same local model; “multiple agents” does not inherently improve reasoning or extend its context window.

## Stored style record

Suggested fields: id, name, version, preferences, compiled prompt, creation/update timestamps, parent version, change explanation, validation references, model/runtime metadata, approval state.

Keep per-session content separate from portable style records. Store the style version used to generate each note.

## Updated runtime findings

The inspected Electron app and private prompt tester use Ollama. The inspected Tauri development checkout instead uses embedded llama.cpp. The hackathon's requested real-Ollama simulation does not establish Tauri compatibility. See [source findings](current-app-findings.md).

Implement simulation by supplying a fictional transcript to real inference, not by enabling Electron E2E or Tauri fake-engine modes. Add run purpose, immutable prompt versions, and an untouched simulation fixture. See [data capture](data-capture.md).
