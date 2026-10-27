# CLAUDE.md: OneTrip (team repo)

@AGENTS.md

OneTrip: a contractor creates a service request and texts the customer a browser link. The customer takes guided **photos first**, Claude reads them and writes **tailored questions**, and the contractor gets a one-screen **service brief**: equipment and model/serial, likely cause + confidence, parts/tools to bring, what to confirm on site, and the photos with AI notes. First trade: **HVAC**. Built for the Claude Impact Lab hackathon (2026-10-25).

## Source of truth: read before changing anything
1. `docs/App_Summary.md`: product intent and confirmed requirements.
2. `docs/Technical_Specifications.md`: features, routes, stack, data model, status model, build order.
3. `docs/design/`: design direction, the clickable prototype (`docs/design/prototype/onetrip-flow-v3.html`), and `DESIGN_GUARDRAILS.md`.

**If a request diverges from these docs** (a different flow, route, data field, status, dependency, or API shape), **stop and ask the user before implementing.** Say what the docs say, what's being asked, and your recommendation. If the docs are silent, pick the simplest option that fits the rules below and say so.

## Product rules
- Customer side (`/i/[token]`): no app, no account, no login. A mobile browser wizard: photos → questions → review → confirmation.
- Structured forms, not chat. One question per screen; always offer "Not sure". Photos offer Retake / Use anyway / "I can't get this photo".
- Safety: the AI never tells customers to open covers, touch wiring, or handle gas. A burning smell, sparks or smoke → emergency guidance.
- AI confidence shown as High / Med / Low words + icon, never a percentage. Low = grey, not red. Every AI finding links to its source photo or answer.
- Never block the customer on AI latency: analyze photos while they continue; keep fallback questions per trade.
- Privacy: private storage, strip photo metadata (GPS), auto-delete photos after a retention period, "Delete photos now" per request.
- No message is sent without the contractor seeing it; links go out from the contractor's own phone.

## UI conventions
- Mobile-first; desktop contractor view = two columns (requests list | service brief).
- Touch targets ≥ 48px, body ≥ 16px (customer ≥ 17–18px), inputs ≥ 16px, high contrast; light theme.
- Accent: high-vis green `#C5F23A` with dark text `#101214`; strong accent text `#3F5A00`. Red is for safety/errors only.
- Tailwind + shadcn/ui. Reuse components; don't introduce another UI kit.

## Stack
Next.js (App Router, this repo's version, see AGENTS.md) · Supabase (auth, Postgres, storage) · Anthropic API via `@anthropic-ai/sdk` · Tailwind · shadcn/ui · Zod. Keep `ANTHROPIC_API_KEY` and Supabase secret keys server-side only; never use a `NEXT_PUBLIC_` prefix for secrets.

## Git workflow
- Never commit directly to `main`. Branch: `feature/<name>` or `design/<name>`.
- Small, focused commits with clear messages. Merge the latest `main` into your branch before opening a PR.
- Merge into `main` via pull request after a teammate's quick look.
- Don't push, merge, or open PRs unless the person you're working with asks.

## Deadlines (2026-10-25)
Feature freeze 3:45 · working end to end 4:30 · demo video 4:30–5:10 · submit 5:15.
