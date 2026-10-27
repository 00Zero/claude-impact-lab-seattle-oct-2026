# What's in KnowledgeForge, Internexio's second brain

_398 documents, 16 groups. Made October 25, 2026. Open `map.html` in any browser to explore them._

## All groups

| Group | Documents | Share |
|---|---:|---:|
| Git, PRs and release pipelines | 46 | 12% |
| Running teams of AI agents | 43 | 11% |
| Prompt and template gotchas | 33 | 8% |
| Background jobs that fail silently | 33 | 8% |
| API and backend debugging | 24 | 6% |
| Beads issue tracker workflows | 20 | 5% |
| Python testing and project setup | 19 | 5% |
| Queues, caches and expiry | 18 | 5% |
| Evidence-backed marketing claims | 14 | 4% |
| Google Ads and keyword research | 14 | 4% |
| KnowledgeForge's own architecture | 13 | 3% |
| Safe database migrations | 13 | 3% |
| Infographics and HTML rendering | 12 | 3% |
| Ghost blog administration | 8 | 2% |
| SEO for content sites | 7 | 2% |
| GitHub Actions and CI security | 7 | 2% |
| _Fits no group_ | 74 | 19% |

### Git, PRs and release pipelines (46, 12%)

How multi-repo compile pipelines, stacked PRs, force-pushes and issue trackers drift out of sync, and the discipline that keeps them aligned.

**Try:** Turn the top five into a 'multi-repo release hygiene' checklist to offer clients.

> # Compile Pipelines Complete Tracked Work Invisibly ## The Pattern In multi-repo architectures where a source-of-truth repo (Repo A) feeds a compile pipeline that produces a derived repo (Repo B), issues tracked in Repo B may be marked as "to-do" but are actually already …
>
> _compiler · 2026-05-23 · diagnostics/2026-05-23_compile-pipelines-complete-tracked-work-invisibly.md_

> # Stale-Base PR Conflicts After Batched Core Pushes ## Diagnostic — Symptom and Signature After a batched session of multiple pushes to a "source" repo (e.g., `knowledgeforge-core`) that triggers per-push PR-generating workflows on one or more "variant" repos (e.g., …
>
> _orchestration · 2026-06-12 · orchestration/2026-06-12_stale-base-pr-conflicts-batched-pushes-workflow-dispatch.md_

### Running teams of AI agents (43, 11%)

Patterns for Critic, Builder and Strategist agent roles: handoffs, triage, validation gates and when to escalate to a human.

**Try:** This is the core IP; package it as a paid 'agent workflow design' workshop.

> # Critic-finding triage — Strategist for spec-MUST violations, deferred-doc for forward-compat **Scope note:** This pattern was extracted from a single KnowledgeForge chain (Critic → Builder → Strategist → Builder → Critic). It assumes the surrounding workflow has distinct …
>
> _methodologies · 2026-05-13 · methodologies/2026-05-13_critic-triage-routing-strategist-vs-defer-doc.md_

> # Handoff Payload Schema Gap (ERA Diagnostic Category) ## Diagnostic When auditing a multi-mode chain, check every mode → mode edge against this checklist: 1. **Payload schema** — Is the source mode's output structure formally specified, with required fields and types? 2. …
>
> _diagnostics · 2026-05-10 · diagnostics/handoff-payload-schema-gap.md_

### Prompt and template gotchas (33, 8%)

Silent failures in structured output, YAML, JSON streaming and Jinja2 templates that break LLM pipelines.

**Try:** Publish as a 'silent LLM pipeline bugs' blog series to attract technical clients.

> # Claude CLI `--json-schema` Populates `structured_output`, Not `result` ## The Problem When invoking `claude --print` with a `--json-schema` argument, the validated JSON payload is placed in `envelope.structured_output` (a dict), NOT in `envelope.result`. The `result` field …
>
> _patterns · 2026-05-14 · patterns/2026-05-14_claude-cli-structured-output-vs-result-routing.md_

> # YAML Plain-Scalar List Items with Embedded Colon-Space Fail safe_load Silently ## Problem Shape A YAML changelog entry written as a plain (unquoted) list item that contains `: ` (colon-space) inside parens or quotes will fail `yaml.safe_load()` with `"mapping values are not …
>
> _diagnostics · 2026-06-14 · diagnostics/2026-06-14_yaml-plain-scalar-colon-space-safe-load-silent-fail.md_

### Background jobs that fail silently (33, 8%)

Daemons, cron, tmux and CLI wrappers that look healthy but do nothing, and how to monitor what they actually produce.

**Try:** Bundle into a monitoring audit offered alongside agent deployments.

> # Happy CLI File-Watcher Binds to Ghost Session_id That Claude Never Creates ## What Happy CLI v0.13.0 launchers mint a fresh UUID at startup and bind their file-watcher to `<claude_project_dir>/<that_uuid>.jsonl`. The actual Claude process generates its own session_id (or …
>
> _diagnostics · 2026-05-18 · diagnostics/2026-05-18_happy-cli-filewatcher-ghost-session-mismatch.md_

> # Deployment-Gap Audit Checklist for Shadow-Mode Patterns ## The Problem A pattern can appear fully deployed — code merged, on disk, even with docs claiming it's live — while being silently inert at runtime due to an **activation gap**. The gap is invisible until you explicitly …
>
> _infrastructure · 2026-05-13 · infrastructure/2026-05-13_deployment-gap-audit-shadow-mode-patterns.md_

### API and backend debugging (24, 6%)

FastAPI, streaming responses, HTTP/2 and vendor API quirks that show up as misleading errors.

> # COS analyze_full payload size ceiling — 26K chars triggers 502, ~2.6K succeeds in 130s ## Problem The COS `POST /api/analyze/full` endpoint has a payload size / processing time ceiling that triggers an nginx 502 Bad Gateway **before the backend returns a result**. This is …
>
> _debugging · 2026-05-20 · diagnostics/2026-05-20_cos-analyze-full-payload-ceiling-502.md_

> # FastAPI API-Surface Classification via openapi() + Auth-Dependency AST Extraction ## Problem Productizing an existing FastAPI app requires knowing the true public/metered API surface — the endpoints that are genuinely callable by external API-key holders, with accurate …
>
> _patterns · 2026-05-29 · patterns/2026-05-29_fastapi-api-surface-classification-auth-dependency-extraction.md_

### Beads issue tracker workflows (20, 5%)

How work is tracked with the beads (bd) CLI: migrations, stale open issues, dependency wiring and checking status before building.

**Try:** Close or archive beads that are already done; several notes say the tracker lags reality.

> # Cross-DB bead migration with external-ref provenance tracking ## Problem A bead's natural home is a different project than the one it was created in: - Mislabeled at creation (tagged for project A, should belong to project B) - Project boundaries shifted (team reorg, repo …
>
> _migrations · 2026-05-21 · migrations/2026-05-21_cross-db-bead-migration-external-ref-provenance.md_

> # Bead-Left-Open Anti-Pattern — Verify Implementation State Before Starting Bead Work ## Problem: Implementation-Complete Beads That Were Never Closed When picking up an old bead and the description says "add X to module Y", the natural response is to start implementing. But …
>
> _methodologies · 2026-08-16 · methodologies/2026-08-16_bead-left-open-anti-pattern-verify-implementation-state-before-starting.md_

### Python testing and project setup (19, 5%)

Test isolation with pytest fixtures and subprocesses, vendoring code and splitting oversized modules.

**Try:** Merge the two copies of the vendor-in decision note.

> # Subprocess Test Isolation: Env Vars Plus Default-Sandbox-All-Paths ## Pattern Two compounding failure modes when test fixtures sandbox shared filesystem state: 1. **Pytest `monkeypatch.setattr` does not reach subprocesses.** When a test calls `subprocess.run([sys.executable, …
>
> _diagnostics · 2026-05-15 · diagnostics/2026-05-15_subprocess-test-isolation-env-vars-sandbox-all-paths.md_

> # Test Isolation for Shared File State — Autouse Fixture + Post-Test mtime Guard ## The Pattern When a production module exposes a path-typed module-level constant pointing at a real file or directory (`ORCHESTRA_QUEUE_PATH = Path.home() / "agent-workflow" / …
>
> _patterns · 2026-05-29 · patterns/2026-05-29_test-isolation-autouse-fixture-post-test-mtime-guard.md_

### Queues, caches and expiry (18, 5%)

Append-only queues, deduplication and TTLs that make entries immortal or raise false alarms.

> # Append-Only Queue with Re-Running Producer — Fingerprint Dedup + Clean-Run-Only Reconcile-GC ## The Pattern A common data-pipeline shape: a **producer** (nightly scanner, linter, audit) emits zero-or-more **findings/suggestions/proposals** on each run. They land in an …
>
> _orchestration · 2026-05-29 · orchestration/2026-05-29_append-only-queue-fingerprint-dedup-reconcile-gc.md_

> # TTL Drain — Source-Lifecycle-Gated Proposal Expiry Without Active Cleanup ## Context In a baking pipeline where proposals (baked envelopes) derive from source beads, a closed source bead should cause derived proposals to stop being refreshed. If the pipeline calls …
>
> _orchestration · 2026-08-03 · orchestration/2026-08-03_ttl-drain-source-lifecycle-gated-expiry.md_

### Evidence-backed marketing claims (14, 4%)

How to cite research honestly in marketing copy: effective evidence base, hedging lost in edits, verifying numbers at the primary source.

**Try:** Offer this as a 'claims you can defend' review service for founders' marketing copy.

> # Berger-style "effective evidence base" framing for claim verification ## The framework When marketing or product copy cites "grounded in N peer-reviewed papers" (or any aggregate-count framing of an evidence base), the figure often includes papers REFERENCED BY the …
>
> _methodologies · 2026-06-26 · methodologies/2026-06-26_berger-style-effective-evidence-base-framing-claim-verification.md_

> # Moat-Left-Offstage Diagnostic for Evidence-Grounded Brand Copy ## Core Principle When generating promotional or social copy for a brand whose differentiator is a **proof asset** — a quantifiable evidence base such as peer-reviewed paper count, dataset size, citation volume, …
>
> _diagnostics · 2026-06-16 · diagnostics/2026-06-16_moat-left-offstage-evidence-grounded-brand-copy.md_

### Google Ads and keyword research (14, 4%)

Keyword data triangulation, Search Console quirks, ad-performance analysis and Google Ads API pitfalls.

**Try:** Package as an SEO and paid-search data audit for small businesses.

> # Keyword Data Triangulation — DataForSEO + SEMrush + GSC For reliable keyword research, do not depend on a single source. Use a 3-source triangulation pattern: 1. **SEMrush `phrase_this`** as primary source for volume + CPC + competition (works from any IP) 2. **DataForSEO …
>
> _methodologies · 2026-05-21 · methodologies/2026-05-21_keyword-data-triangulation-datasources.md_

> # Verify Which API Code Path Actually Runs Before Quoting Per-Call Cost ## Pattern When making a scheduling, cadence, or budget decision that depends on per-call API cost, verify which code path is actually executed in the project — direct vendor API vs a third-party wrapper. …
>
> _methodologies · 2026-05-30 · methodologies/2026-05-30_verify-api-code-path-before-cost-cadence-decisions.md_

### KnowledgeForge's own architecture (13, 3%)

How KnowledgeForge itself is compiled, versioned and deployed across Claude Code, Claude Projects and other platforms.

**Try:** Use these as the backbone of the product documentation.

> # Project Vision ## What We're Building KnowledgeForge is a compiled, multi-platform reasoning framework that gives Claude the right context at the right time — patching its predictable failure modes without adding overhead to requests that don't need it. It closes the gap …
>
> _vision · vision.md_

> # KF CC Deployment Parity Check — 7-Check Deterministic Audit Methodology ## What It Is A structured 7-check deterministic audit for validating whether a knowledgeforge-cc compiled artifact deployment is in parity with a target source version. All checks are grep/read only — no …
>
> _diagnostics · 2026-07-11 · diagnostics/2026-07-11_kf-cc-deployment-parity-check-7-check-audit-methodology.md_

### Safe database migrations (13, 3%)

Two-phase, additive and expand-contract migrations for SQLite and Postgres, plus checks before switching vendors.

> # Two-phase destructive-migration pattern — validation before coercion When a database migration includes a destructive or irreversible step that could fail on dirty existing data (type coercion, FK repoint, NOT NULL addition with backfill, enum value change), split the rollout …
>
> _migrations · 2026-05-30 · migrations/2026-05-30_two-phase-destructive-migration-validation-before-coercion.md_

> # Idempotent additive-column migration pattern for SQLite without a migration framework ## Problem Small and medium projects with SQLite databases often add columns to existing tables as the schema evolves. They typically lack a formal migration framework (Alembic, sqlx migrate, …
>
> _migrations · 2026-05-20 · migrations/2026-05-20_idempotent-additive-column-sqlite-migrations.md_

### Infographics and HTML rendering (12, 3%)

Rendering text-heavy social infographics with HTML and headless Chrome, and auditing page copy for typography rules.

**Try:** Turn the infographic pipeline into a repeatable content offer for clients' LinkedIn posts.

> # HTML + Chrome Headless as the Preferred Replacement for SVG in Mobile-First Infographics ## Decision When producing mobile-first infographic cards (LinkedIn, Instagram, feed posts), prefer HTML+CSS rendered via Chrome headless screenshot over hand-authored SVG. ## Why SVG …
>
> _patterns · 2026-07-10 · patterns/2026-07-10_headless-chrome-html-png-pipeline-text-heavy-mobile-infographics.md_

> # Headless Chrome HTML→PNG Pipeline for Text-Heavy Social Infographics ## The Pattern When generating social media assets that are **text-heavy** (scorecards, quote cards, comparison infographics, list breakdowns, before/after grids), diffusion image models — Flux, Imagen, Nano …
>
> _patterns · 2026-06-29 · patterns/2026-06-29_headless-chrome-html-png-pipeline-text-heavy-social-infographics.md_

### Ghost blog administration (8, 2%)

Fixes for self-hosted Ghost CMS: themes, author pages, the Admin API and Docker-hosted databases.

> # Ghost Active-Theme Verification Before SSH Theme Edits ## Problem When editing Ghost theme files via SSH, changes may not render if you edit the wrong theme directory. Ghost supports multiple installed themes and tracks the active one in its SQLite database — not as a …
>
> _infrastructure · 2026-07-24 · infrastructure/2026-07-24_ghost-active-theme-verification-before-ssh-edits.md_

> # Ghost Casper Theme: Author Bio Omitted from Post Pages — Fix Pattern ## Problem Ghost stores an author bio in the `users` table of its SQLite database, but the default casper theme's `post.hbs` does NOT include a `{{#primary_author}}` block in the post body. The bio exists in …
>
> _infrastructure · 2026-07-25 · infrastructure/2026-07-25_ghost-casper-theme-author-bio-post-rendering.md_

### SEO for content sites (7, 2%)

Cross-posting between blogs, head-term targeting, UTM tracking and SEO metadata in Laravel sites.

**Try:** Combine with the Google Ads group into one 'search visibility' service page.

> # Ghost Cross-Post Workflow (Multi-Instance) When republishing a blog post from one Ghost CMS instance to another (e.g., semalytics.com/blog → internexio.com/blog), follow this exact sequence to preserve SEO attribution and maintain UTM tracking integrity. ## When This Applies - …
>
> _integration · 2026-07-11 · integration/2026-07-11_ghost-cross-post-workflow-multi-instance-staging-canonical-attribution.md_

> # SEO Intro Redirect Leak ## Pattern A page targeting a head-term keyword (e.g., "psychographic segmentation") that opens with a sentence like: > "For the strategic case — what psychographic segmentation is and why it matters — see the [psychographic marketing guide]." is …
>
> _diagnostics · 2026-07-11 · diagnostics/2026-07-11_seo-intro-redirect-leak-head-term-relevance-signal.md_

### GitHub Actions and CI security (7, 2%)

Required status checks, token rotation, PyPI trusted publishing and sparse-checkout traps in GitHub Actions.

> # A new GitHub Actions workflow runs but does not gate PR merges — branch protection must explicitly require the check ## The Pattern (and how it fails silently) You add a new GitHub Actions workflow as a quality gate — a regression check, lint enforcement, security scan, …
>
> _infrastructure · 2026-06-20 · infrastructure/2026-06-20_github-actions-workflow-not-gate-without-required-status-check.md_

> # GitHub Actions PAT Authentication Failure Modes: Three Distinct Error Signatures When a GitHub Actions workflow uses a PAT (Personal Access Token) via `actions/checkout@v4` or direct API calls, authentication failures produce three distinct error messages. Each points to a …
>
> _infrastructure · 2026-07-08 · infrastructure/2026-07-08_github-actions-pat-authentication-failure-three-error-signatures-continue-on-error-masking.md_

## Worth a look

**Near-duplicates (1).** The same text saved or posted twice; count it once:

- `patterns/2026-05-21_vendor-in-decision-framework-flat-script-python` repeats `integration/2026-05-21_vendor-in-decision-framework-flat-script-python`

**Unusual one-offs.** Unlike anything else in this collection; worth a second look:

- `integration/2026-07-11_vscode-webview-inline-modal-csp-window-prompt-blocked`: # VS Code Webview: window.prompt() Blocked — Use Inline Overlay Div for Modal Text Input ## The Constraint VS Code webviews run under a strict Content Security …
- `diagnostics/2026-05-24_popover-top-overflow-trigger-vs-viewport-anchored-positioning`: # Popover Top-Overflow — Trigger-Anchored vs Viewport-Anchored Positioning ## Problem Signature A popover or dropdown rendered with `position: absolute; …
- `patterns/2026-07-07_reduce-whitespace-is-compression-not-aspect-change`: # "Reduce whitespace" is a compression directive, not an aspect-change directive When an operator gives visual-content feedback of the form "reduce/remove/kill …
- `diagnostics/2026-05-18_chrome-mcp-react-composer-enter-send-onchange-traps`: # Chrome MCP automation of React composers — Enter-to-send and onChange traps ## What this is Two related testing-tool gotchas hit when automating any React …
- `patterns/2026-05-21_seo-meta-split-blade-db-laravel-filament-cms`: # SEO meta split between Blade templates and DB-stored pages in Laravel/Filament CMS ## The Gotcha In a Laravel app where some pages are coded in Blade …

## How this was made

Everything except naming the groups ran on this computer: the text was turned into vectors with all-MiniLM-L6-v2, laid out with UMAP, grouped with HDBSCAN and drawn with DataMapPlot (UMAP, HDBSCAN and DataMapPlot are open source from the Tutte Institute for Mathematics and Computing). Claude read a few typical examples per group to name it.
