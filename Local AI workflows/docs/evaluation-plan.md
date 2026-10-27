# Local evaluation and continuous improvement plan

## Principle

Inspect outputs and discover real failure modes before choosing scores. Evaluation measures improvement; it does not itself update weights or confer clinical correctness.

## Bootstrap from the evidence

Review diverse synthetic outputs with a clinician. Record free-text errors, then group and prioritize them. Initial hypotheses from the customer account:

- Perspective changes from client-reported experience to unsupported clinical assertions.
- Unsupported terminology or modality labels.
- Attribution errors: whose words/actions are being described?
- Excess detail or wrong structure.
- Invented next actions/goals.
- Copying example-note facts into an unrelated session.
- Repeated headings or violation of optional-section behavior.

## Dataset design

Use fictional cases with known source facts. Cover different session themes, absent next actions, absent interventions, sparse quotes, ambiguous speakers, and long inputs. Include failures and acceptable outputs.

Keep development cases, judge-validation labels, and final held-out cases distinct. Split related variants together to reduce leakage. The existing private folder contains synthetic transcripts, but they are not bulk-published here; create/review publishable fixtures separately.

An example note is a style reference, not a gold answer for an unrelated transcript.

## Scoring layers

1. Code checks for heading order/count, optional sections, length preferences, and exact quote occurrence. Quote checks must account for speaker attribution; a string match alone cannot prove it.
2. Clinician labels for semantic fidelity and usefulness.
3. Narrow local judges only after validation against human labels. Require evidence references and allow uncertainty.

Measure failure detection and false alarms separately (precision/recall or sensitivity/specificity), not just overall accuracy. Include sufficient labeled examples before reporting stable estimates. Keep clinical failures distinct from style preferences; a style win cannot offset invented content.

## Experiments

Compare the same inputs/hardware across:
- A: compiled starter with confirmed preferences, no refinement.
- B: the same plus bounded local feedback/judge/revision.
- C: existing founder-assisted prompt as a reference, evaluated locally on synthetic inputs.

Do not run new cloud calls or export customer data to establish C. Do not treat the existing prompt as an infallible gold standard.

For an initial experiment, cap automated revisions at two per candidate; this is a tunable budget, not a proven optimum. Retain the best acceptable candidate. Do not repeatedly tune on the final held-out set.

## Metrics — collect before claiming results

- Independent setup completion and founder interventions.
- Time to accepted style; iteration count; total latency on target hardware.
- Clinician acceptance and editing time on fresh sessions.
- Factual errors, omissions, attribution errors, and unsupported actions.
- Update acceptance and rollback.
- Recurring corrections before/after an approved style update.

No numeric performance, savings, or compliance results have been measured in this repository.

## Continued learning

Observe explicit feedback -> distinguish recurring preference from session-specific edit -> propose one patch -> test development cases -> validate a final candidate -> clinician approves -> version -> observe subsequent editing.

Keep changes reversible and history intact. Freeze a baseline before model/runtime updates and rerun regressions. No silent background replacement of styles or automatic model training.

## Latest four-screen split

The internal loop uses one selected fictional development transcript A. Template Control then opens. The main meeting simulation uses an untouched fictional B and real Ollama. This separation is mandatory; fitting A is not proof of generalization.

If feedback from B changes the prompt, B becomes development evidence and the next check needs an untouched C. Preserve a separate final evaluation set. Pin runtime as well as model: the newer Tauri checkout uses llama.cpp, so its behavior must be tested separately.

Record acceptance explicitly and separate development/simulation/real run purposes; never infer real-session adoption from a fictional demo. See [data capture](data-capture.md).
