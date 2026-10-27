# Team and contributions

The website scores teamwork, including non-coding roles. Record actual contributions and supporting artifacts before submission.

- **Product/customer research:** founder supplied the existing customer evidence, prompt-workflow context, and note-style-only scope. Public attribution details to be confirmed by the team.
- **Planning support:** AI-assisted synthesis of the de-identified journey, requirements, canvas, evaluation plan, and rubric mapping.
- **Engineering:** Codex implemented the conversational feedback/retry backend update, including focused API/UI integration and regression coverage. An independent Claude review identified concrete concurrency, validation, retry-provenance, URL-validation, and UI-state issues; those findings were addressed. Current local verification on this merged source: 45 Python tests passed; Python and JavaScript syntax checks and `git diff --check` passed. On this merged source, the parent's final run reports both the full real HTTP E2E and the conversational smoke passing on the imported `gemma-4-E2B-it.gguf:latest` variant (Ollama 0.20.5, num_ctx 8192). These are single examples, not benchmarks; there is no clinician validation, and inference-host hardware is unmeasured. The earlier 4096-context E2B run is recorded separately. Results and limitations are documented in [README verification](README.md#verification). The prior E4B run is recorded separately.
- **Design/user testing:** not yet recorded.
- **Demo/pitch:** not yet recorded.

Do not infer authorship from people speaking in a transcript or fabricate participation. Add member-approved names/handles and links to commits, designs, research, tests, or demo work.
