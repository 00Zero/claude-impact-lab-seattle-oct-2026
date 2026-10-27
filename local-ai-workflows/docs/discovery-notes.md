# Discovery synthesis and decisions

Sources: team discussion transcripts and whiteboard supplied during this conversation, plus the separately reviewed customer evidence and private prompt tool. Raw transcripts/images are excluded. These are attributed evidence categories, not benchmark results.

## Reported existing behavior

- The founder currently translates customer requirements into prompts and tests sample notes through Ollama.
- The founder reported trying a Gemma 2 revision loop earlier and finding it slow and weak at comparing output and deciding prompt changes. Hardware/settings and quantitative results were not supplied in the discussion.
- The team reported that a style generally remains useful once dialed in; broad generalization is still a hypothesis requiring fresh-case evaluation.
- Context capacity and generation latency were raised as concerns. More agents or turns were proposed, not demonstrated as a remedy.

## Agreed direction from the requester

- Hackathon scope is note-style workflow only.
- Eliminate cloud/frontier-model dependence from clinician-facing customization if feasible.
- Support self-service creation and future revisions.
- Make the active style visible and keep continuous improvement central.
- Ground the project in the de-identified existing journey rather than an invented persona alone.

## Recommended implementation hypotheses

- Confirm structured preferences and compile tested instruction blocks before trying open-ended prompt rewriting.
- Use local previews with supplied fictional transcripts; a paired clinician transcript is optional, not a required input.
- Test narrowly scoped evaluation roles in separate contexts, possibly using the same model.
- Validate those judges against clinician labels; do not assume self-critique is reliable.
- Start with a bounded loop, explicit approval, saved versions, and rollback.
- Do not train weights or add autonomous background changes for this MVP.

## Open decisions

Which exact local model/configuration and hardware? What acceptable latency? Which fixtures and failure modes? What integration/export contract? Who owns engineering, design/testing, and pitch? What actually works by the deadline?

No newer-model capability claims, performance numbers, or local compliance guarantees are inferred from the discussion.

## Latest requester brainstorm — supersedes earlier screen order

Upload documents -> internal prompt loop on one selected transcript -> Template Control -> Main Meeting simulation using a different transcript and real Ollama. Built-in defaults remain available; customer-style shopping is de-scoped. Continuous learning means evidence and explicit approved revisions, not silent weight training.

The requester authorized inspection of both application repositories and the private custom-prompt workflow. Read-only findings are recorded separately; private patient records were not extracted.
