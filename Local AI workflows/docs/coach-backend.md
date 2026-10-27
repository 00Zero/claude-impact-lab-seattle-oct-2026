# Conversational feedback and note retry API

The existing four-screen UI calls this local HTTP API. All inference uses Ollama through `app/ollama.py`; the deterministic preference compiler and fixed factual-grounding block remain authoritative. Feedback interpretation returns a validated preference patch only. Model output cannot supply compiled prompt text or mutate the store.

## Feedback that changes future style

`POST /api/runs/{runId}/feedback`

```json
{"scope":"future","text":"Exactly one sentence per section","tags":[],"addSection":null}
```

The request returns `{"jobId":"job_...","scope":"future"}`. Poll `GET /api/jobs/{jobId}` until complete; its `result` has one of these shapes:

- `{"ok":true,"interpretation":{"kind":"clarification","question":"...","options":[...]}}`
- `{"ok":true,"interpretation":{"kind":"no_change","explanation":"..."}}`
- `{"ok":true,"patchProposal":{"id":"patch_...","runId":"run_...","baseVersionId":"ver_...","baseVersion":1,"patch":[{"path":"sentences.max","before":3,"after":1}],"explanation":"...","status":"pending"}}`

Interpretation runs as a cancellable background job using the existing job API (`GET /api/jobs/{jobId}`, `POST /api/jobs/{jobId}/cancel`). Cancellation, malformed output, output cap, and inference failure create no patch proposal or style version. The proposal is persisted separately from style versions. It contains a bounded patch and its base version; no version is created and no preview fixture is consumed until explicit confirmation. The deterministic vague-feedback gate asks a focused question for requests such as “make it better” and “more professional”. Follow-up answers can be submitted as new feedback. `addSection` is still supported; new sections default to optional and grounded content.

Confirm the exact displayed base with:

`POST /api/patch-proposals/{proposalId}/confirm` — `{"baseVersionId":"ver_..."}`

The server rejects stale proposals, compiles a proposed style version, and only then may start the before/after preview on a fresh fixture. Activation remains a separate explicit action through `POST /api/versions/{versionId}/activate`. Decline or defer without a style version:

`POST /api/patch-proposals/{proposalId}/decide` — `{"decision":"declined"}` or `{"decision":"deferred"}`.

Selecting future-style feedback marks that simulation fixture as development evidence before interpretation, including when the answer is clarification, no-change, or inference fails. A declined patch does not consume C; after a confirmed update, the fresh preview fixture is marked as development evidence before either note is generated, so it is not later called untouched.

## This note only

`POST /api/runs/{runId}/retry` — `{"correction":"Keep exactly one sentence per section"}`

This regenerates the same source fixture with the same immutable style version and an ephemeral correction appended to the effective prompt. Requesting a retry immediately marks that fixture as development evidence, even if the generation is cancelled or fails. It creates a new linked run (`parentRunId`) with exact effective `promptSnapshot`, prompt hash, and source hash. The original note/edit remains unchanged. It does not create or activate a style version. A retry that uses feedback is not fresh held-out evidence.

`POST /api/runs/{runId}/feedback` with `scope:"note_only"` retains the existing structured reason tags, optional `addSection` field, and optional `editedNote` behavior; these do not create a style version.

## Local Ollama routing

Default routing is loopback at `http://127.0.0.1:11434`; proxies and redirects are disabled and there is no cloud fallback. A private IPv4/IPv6 host can be opted into with `COACH_ALLOW_PRIVATE_OLLAMA=1` and `OLLAMA_URL=http://<private-host>:<port>`. URL parsing rejects non-HTTP, credentials, paths, query strings, link-local/public addresses, and non-private hosts. The configured host receives note and feedback text; this option does not establish same-process or same-device residency. The client reports its own hardware; separate-host hardware remains unmeasured. `COACH_MODEL` remains configurable and no model is downloaded by the backend.

Run the actual conversation smoke against the already imported host variant (the tag is not the README default). The script starts a temporary local backend/store and tests real feedback interpretation plus generation:

```sh
COACH_ALLOW_PRIVATE_OLLAMA=1 OLLAMA_URL="http://${OLLAMA_PRIVATE_HOST}:${OLLAMA_PORT}" \
COACH_MODEL='gemma-4-E2B-it.gguf:latest' \
python3 scripts/smoke_conversational.py
```

The smoke model name refers to the imported `gemma-4-E2B-it.gguf:latest` Q4_K_M variant recorded by the spike on Ollama 0.20.5. It differs from the README default `gemma4:e4b` (tested separately on Ollama 0.40.11); these tags are not interchangeable evidence. No VM or physical inference-host hardware was measured in the spike. Use the host and port configured in your private workspace; do not copy them into tracked files. This smoke checks vague clarification without a version; a one-sentence/conditional-quote pending patch, confirmation to a proposed-but-inactive version; and a retry linked to the same source/version while preserving the original note. Spike outputs and judgments were synthetic, and neither clinical accuracy nor clinician acceptance has been validated.
