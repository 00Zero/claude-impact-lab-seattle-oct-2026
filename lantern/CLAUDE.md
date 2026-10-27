# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AgenticLantern: when a death occurs, a hospital (or the family directly) starts a Case. An
AI agent reads the intake context and recommends funeral homes to the family member, who
signs up through a dedicated link. Hackathon project, Milestone 1 scope.

- **Spec (source of truth):** `docs/spec.md` — read this before touching data model or flow
  logic. It documents resolved product questions (e.g. why cause-of-death is excluded, why
  the wizard has exactly 6 questions, why there's no zero-result fallback) — don't re-derive
  or second-guess these without checking it first.
- **Task plan:** `docs/milestone-1-tasks.md` — phased breakdown with per-task acceptance
  criteria and ✅/🚧/⬜ status. Keep this in sync (update status) when you complete work it
  tracks, and reconcile it (like the "Phase 0" note at its top) when implementation diverges
  from what it originally assumed.

Current state: all Milestone 1 flows are built (`src/pages/`: hospital password login,
dashboard, new case, case detail; invite landing; family case; 5-step wizard; static `/demo`;
`/funeral-home` placeholder). Remaining work is live rehearsal — see T7.3 in the task plan.

## Commands

```
npm install        # install deps
npm run dev         # vite dev server
npm run build       # tsc -b (type-check) && vite build -> build/ (NOT dist/ -- must match
                    # output_location in .github/workflows/azure-static-web-apps-*.yml)
npm run lint        # oxlint
npm run preview     # serve the production build locally
```

`npm test` runs the candidate-filter unit tests (`scripts/test-filter-candidates.ts`, no
network/Supabase needed). `npm run test:rls` runs the RLS policy tests
(`scripts/test-rls.ts`) against the real hosted project.

Local dev needs Supabase env vars (`.env`, copy from `.env.example`): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`. These are **not secrets** (the publishable key is meant
to ship in the client bundle; RLS does the real access control) — current values are in
README.md's Setup section and in `.env` if it already exists in this working copy. Don't
ask another agent session for them or wait on a human to paste them; read README.md or
`.env` first. If those values stop working, get fresh ones from the Supabase dashboard →
**Project Settings → API Keys** (project ref `sfsycncjxglfiqidhvtf`), then update both
`.env` and README.md's Setup section so the next session doesn't hit the same wall.

`SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` are the opposite: genuine secrets,
Supabase Edge Function-only, never in client code, never committed anywhere (not even in
this file). If you need one and don't have it, ask Harsh directly — not another agent
session, which won't have it either — rather than guessing or stubbing a value. Note that
setting a Supabase project secret (`npx supabase secrets set ...`) is itself a write this
environment's permission classifier blocks regardless of who's asking — hand the exact
command to Harsh to run rather than retrying it.

`RESEND_API_KEY` is also a genuine secret, but used differently: it's only needed
transiently, as a local env var, to run `npx supabase config push` (which applies
`supabase/config.toml`'s `[auth.email.smtp]` block to the hosted project's Auth email
settings — custom SMTP via Resend, replacing Supabase's default built-in mailer whose
shared quota is capped at a few emails/hour and was blocking magic-link testing). Supabase
stores the key itself once pushed; it's never read by the app at runtime and doesn't belong
in `.env`. If it's rotated or lost, get a fresh one from Resend's dashboard → API Keys and
re-run `RESEND_API_KEY=<key> npx supabase config push` — ask Harsh for a key rather than
creating a new Resend account.

Apply schema changes with `npx supabase db push` after linking the project
(`npx supabase link --project-ref sfsycncjxglfiqidhvtf`).

Frontend deploy is automatic: every push to `main` builds and deploys the static site to
Azure Static Web Apps via the GitHub workflow. The build step needs the two `VITE_*` vars
as GitHub repo variables (Vite inlines them at build time) — if the deployed site loads
blank, that's almost always a missing/stale repo variable (throws in `src/lib/supabase.ts`
before anything renders, while the deploy itself still reports success).

Backend compute deploy is **not** part of that workflow and is **not** automatic: after
editing anything under `supabase/functions/`, redeploy manually with
`npx supabase functions deploy parse-intake` / `recommend` (or both). There's no CI wiring
for this yet — fine at this scale, revisit if that becomes a problem.

## Architecture

**No custom backend.** The React SPA talks to Supabase (Postgres + Auth + Storage) directly
via `@supabase/supabase-js` (`src/lib/supabase.ts`), gated entirely by Postgres Row-Level
Security — there is no CRUD API layer to add routes to. The only server-side code is two
Supabase Edge Functions in `supabase/functions/` (Deno runtime; shared logic lives in
`supabase/functions/_shared/`), used solely because they need the OpenRouter API key off
the client. (Frontend hosting is still Azure Static Web Apps — only this backend-compute
piece runs on Supabase; see "Commands" above for the separate deploy step.) Both call
`google/gemini-3.8-flash` via OpenRouter's OpenAI-compatible `/chat/completions` endpoint
over plain `fetch` (no SDK — OpenRouter's own documented pattern; see
`supabase/functions/_shared/parsePdfToCase.ts`), using `response_format: json_schema` built
from a Zod schema via `z.toJSONSchema()` for structured output:
- `parse-intake` (`supabase/functions/parse-intake/index.ts`, logic in
  `_shared/parsePdfToCase.ts`) — one call per PDF upload, extracts structured Case fields
  with per-field confidence, writes `intake_documents.parsed_fields`. The Zod schema only
  has keys for fields spec.md's parse-targets list actually maps to `cases` columns — cause
  of death/manner/pregnancy/SSN/physician aren't in the schema, so structured outputs make
  it impossible for the model to return them, not just prompted-against.
- `recommend` (`supabase/functions/recommend/index.ts`, logic in `_shared/rankCandidates.ts`
  + `_shared/filterCandidates.ts`) — one call per Case, ranks filtered `funeral_homes`
  candidates and writes `recommendations`.

Both run with the Supabase service-role key (auto-injected into every Edge Function's
environment as `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, nothing to configure) and
therefore bypass RLS — this is intentional and is why `intake_documents`/`recommendations`
have select-only client policies. Both default to `verify_jwt = true`
(`supabase/config.toml`'s `[functions.parse-intake]`/`[functions.recommend]`) — every
caller already carries a Supabase JWT (hospital/family session, or the anonymous session
self-serve families get when they skip email), so this is satisfied automatically by
`supabase.functions.invoke(...)` (`src/lib/triggerParseIntake.ts`/`triggerRecommend.ts`);
the actual authz boundary is still the same unguessable-case-UUID one `invite_tokens`
relies on, not the JWT check itself.

**Role model:** a single `profiles` table (not separate hospital/family tables) carries
`role: 'hospital' | 'family'`, populated from signup metadata by the `on_auth_user_created` /
`handle_new_user` trigger (`supabase/migrations/20261025000000_init_schema.sql`). Role is
**not** a JWT claim — always query `profiles`, never `auth.jwt()`, to check it.

**Case ownership:** `cases.hospital_id` / `cases.family_user_id` directly reference
`profiles.id` — there's no join table. A hospital case starts with `family_user_id = null`
and gets linked when the family redeems their invite token.

**Invite tokens are deliberately not client-readable.** `invite_tokens` has no SELECT
policy — a bare one would let any authenticated user enumerate tokens. Instead two
`SECURITY DEFINER` Postgres functions do the whole flow server-side:
- `invite_token_lookup(token)` — anon-callable, used by the invite landing page. Returns
  only validity + the contact email to lock the sign-in field to, never case contents.
- `redeem_invite_token(token)` — authenticated-callable, called right after magic-link
  sign-in completes. Validates the token, checks the signed-in email matches
  `contact_email`, sets `cases.family_user_id = auth.uid()`, marks the token used. All in
  one transaction (`for update` lock) so this is the only path that links a case to a
  family user.

Call these two RPCs rather than querying `invite_tokens` directly; a direct client query
will be blocked by RLS anyway.

**Two entry paths converge on one `Case`:**
- Hospital path: upload PDF → `parse-intake` → `cases` (`source=hospital`,
  `status=pending_review`) + `intake_documents` + `invite_tokens` row, even when parsing
  returns nothing (every field stays blank rather than failing the upload) → family redeems
  invite → confirms/edits parsed fields on a review screen → `status=active`.
- Self-serve path: family signs up directly, answers the 6-question wizard → `cases`
  (`source=self_serve`, `status=active` immediately, no review step).
- Both reach `status=active` → triggers the `recommend` function → `status=recommendations_ready`.

The `cases` schema (migrated in two steps — see
`supabase/migrations/20261025010000_align_case_schema_with_spec.sql`) mirrors fields from
the actual WA hospital medical-certificate and death-certificate-worksheet forms, documented
field-by-field in spec.md's "Template field gaps" table (each tagged M1 / M2 / Never). When
adding a Case field, check that table first — several fields are intentionally never
collected (SSN, cause/manner of death, certifying physician) and the PDF parser must not
return those keys even at low confidence.

**Funeral home matching** is pure filter-then-rank, no fallback: filter `funeral_homes` by
county (same, then nearby) and disposition capability, cap the candidate set (~15-20), one
LLM call to rank + write a rationale per match. A location/disposition combo with zero
matches is accepted as returning an empty recommendation list — do not add widening/fallback
logic; it's explicitly out of scope for Milestone 1.

## Fixtures

`fixtures/sample-pdfs/` — sample hospital PDFs for parser testing, generated by
`fixtures/sample-pdfs/generate.py` from the reference images in `Context/`. All share one
fictional decedent (Eleanor Marie Whitfield). Includes a clean parse case, a non-death
document (for the all-null parse path), and an alternate (Indian Form No. 4) layout. Treat
these as fixed test fixtures, not something to hand-edit — regenerate via the script if the
underlying form images change.

## Explicitly out of scope for Milestone 1

Do not build: hospital SSO/real integration, live funeral-home scraping, multi-agent
orchestration beyond the single recommendation call, multiple family members per case,
payments/e-signature/document generation, OCR for scanned PDFs, religious/cultural
matching, budget-based matching, or zero-result-fallback widening. See spec.md's
"Explicitly out of scope" section for the full list and rationale before adding anything
that smells like one of these.
