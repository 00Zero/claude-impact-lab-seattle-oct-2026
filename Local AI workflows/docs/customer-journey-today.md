# Existing customer journey — de-identified editorial summary

## Evidence and boundaries

Source: a founder-supplied customer email thread and a privately inspected delivered prompt. The original correspondence, subject, identifying filenames, signatures, dates, contact information, and clinical passages are not published. This is a paraphrased account, not a verbatim redacted transcript or a formal certification of anonymization.

**Customer:** an existing therapist customer, referred to only as “the clinician.”
Only note-style interactions are included. Recording, audio retention, transcription correction, and speaker-detection issues are outside this project's scope.

## Current journey

| Stage | Clinician action | Founder/system action today | Friction/opportunity |
| --- | --- | --- | --- |
| Try the product | Tests output and asks how to make the prompt fit their practice | Founder offers direct help | Customization depends on founder availability |
| Explain the desired style | Describes intended use, section structure, brevity, perspective, and exact-language preferences | Founder asks for an outline or example and clarifying requirements | Requirements live in email and require translation |
| Explain what is wrong | Identifies interpretive language, unwanted terminology, excess length, and attribution mistakes in examples | Founder interprets detailed feedback | “Style” includes semantic constraints, not merely formatting |
| Build a reusable prompt | Waits for the customized artifact | Founder drafts and tests a prompt through the private workflow | Requires technical tooling and expert judgment |
| Install the style | Receives a PDF containing prompt and sample output; is instructed to paste the prompt into settings | Founder delivers instructions | Manual copy/paste; version visibility is not evidenced in the thread |
| Follow up | Has a route to contact the founder | Founder asks how the custom format is working | Continued support is available, but style outcomes are not measured in this evidence |

## Requirements supported by the correspondence

- Brief sections for client discussion and therapist contribution.
- An optional next-actions section, grounded in explicit session statements.
- Report the client's perspective rather than asserting therapist interpretations.
- Preserve selected exact client language.
- Identify modality-specific practices with session evidence, not generic descriptions.
- Avoid unwanted terminology and incorrect attribution.
- Do not include goals; do not invent future actions.

The supplied thread includes examples the clinician obtained from another AI service. That is evidence about this customer's comparison process, **not a proposed dependency or proof of correctness**. No clinical content from those examples is reproduced here.

## What the evidence does not establish

- No measured founder effort, onboarding duration, revision count, or editing-time reduction.
- No explicit post-delivery confirmation that the custom style met every requirement.
- Later purchase correspondence supports that this was a paying customer, not that customization caused the purchase.
- No controlled evidence that a local revision/judge loop can match the existing founder-assisted process.

## Existing technical workflow — separate source

The private custom-prompt tool's README and tester describe intake/configuration, prompt drafting, local Ollama test generation, interactive feedback, Claude-assisted revision, retesting, revision history, and delivery artifacts. This documents the general workflow; it does **not** prove every step was executed for this particular customer.

The delivered reference prompt was inspected separately. It contains an ambiguity between omitting an absent next-actions section and requiring every section heading exactly once. See the public reference and proposed clarified starter.

## Target journey

Keep the clinician's domain judgment; replace the founder-mediated translation and delivery steps with local confirmation, previews, targeted revisions, saved versions, and reversible future updates.

**Hypothesis to validate:** clinicians can reach an acceptable reusable style with less support and less effort, without increasing factual errors.
