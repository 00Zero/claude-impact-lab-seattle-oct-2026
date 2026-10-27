# Tech stack

The goal: one app that five people can build in parallel, deployed at one URL, with as little setup between modules as possible.

## Decisions

| Area | Choice | Why | Rejected |
|---|---|---|---|
| App | **One Next.js (App Router) + React app**, TypeScript | UI and API in one deploy and one `npm run dev` | Separate frontend/backend; microservices |
| Module isolation | **Folders** under `src/modules/*`, enforced by an ESLint import rule | Same isolation as separate packages, with zero build config between them | npm workspaces (the first draft's plan). Each package then needs its own build/TS config plus Next.js transpile setup |
| Contracts | **Zod** schemas in `src/contracts`; TS types inferred from them | One definition gives runtime validation and TS types; model-facing `*Draft` schemas use the same tool | Hand-written interfaces (no runtime check) |
| LLM | **Claude** via `@anthropic-ai/sdk`, wrapped in `src/platform/ai` | Structured outputs via `messages.parse` + `zodOutputFormat`; built-in web search/fetch with citations | A multi-provider adapter: not needed now |
| Storage | **JSON files per run** on a persistent volume, behind an `ArtifactStore` interface | No DB to set up; human-readable; trivial replay | SQLite (native-module build pain); Postgres (setup) |
| Jobs | **In-process async pipeline** on one always-on Node server | A run takes ~2.5–3.5 minutes; serverless functions can be cut off mid-run | Serverless background jobs, queues, brokers |
| Tests | **Vitest** | Fast, TS-native | Jest |
| Lint | **ESLint** + `no-restricted-imports` per module folder | Enforces "talk through contracts, not internals" | — |
| Styling | Tailwind (Founder Experience owner's call) | Fast to polish | — |
| Runtime | Node 22+ | Supported by every host below | — |

## Hosting (decision needed)

The pipeline runs for minutes and keeps run files on disk, so it needs **one always-on Node instance with a persistent volume**.

Times below are estimates.

| | Render / Railway / Fly.io | AWS: EC2 + EBS on Nick's personal account (…4786) |
|---|---|---|
| Setup | ~30 min: connect the repo, add a volume, set env vars | ~1–2 hr: instance, security group, HTTPS, Node service, deploy pipeline |
| Deploys | Automatic on every merge to main | A GitHub Action we write (SSH/SSM), or manual |
| Team access | Invite teammates: logs, restarts, env vars | An IAM user per teammate, or Nick does it all |
| HTTPS link | Built in | A domain + Caddy, or a load balancer + ACM certificate |
| Familiarity | New to Nick | Known quantity |

**Either works.** Choose a hosting platform if teammates should deploy and read logs themselves; choose AWS if Nick will own deploys anyway. On AWS, use a VM (EC2, or a Lightsail *instance*): Lightsail's container service has no persistent disk. On any platform, **without a volume every deploy wipes `runs/`**. Vercel is out: long background work isn't reliable on serverless, and there's no disk.

## Models

Prices are per million tokens (input / output).

| Step | Model | Effort | Why |
|---|---|---|---|
| Intake safety check | `claude-haiku-5-5` ($0.10 / $0.50) | low | One tiny classification |
| Research (web search + fetch) | `claude-opus-5-5` ($4 / $20) | medium | The latest web tools need an Opus/Sonnet 5.5-class model |
| Structure research → MarketModel | `claude-opus-5-5` | low | Extraction into a strict schema |
| Positioning (+ refinement) | `claude-opus-5-5` | medium | Quality of ideas matters |
| **Customer simulation** (~58 calls/run) | `claude-haiku-5-5` (**decided**) | low | Fast and cheap enough for a public demo; see the cost table |
| Robustness re-check (10-customer subset, stretch) | `claude-opus-5-5` | low | "Does the winner survive a model change?" |
| Objection themes, report, assets | `claude-opus-5-5` | medium | — |

**Rough cost and time per run.** These are estimates: ~58 simulation calls at ~3k tokens in and ~1k out (including thinking), research capped at 5 searches. Measure on day one.

| Simulation model | Simulation | Everything else | Per run | Total time |
|---|---|---|---|---|
| **Haiku 5.5** (chosen) | ~$0.05 | ~$1.00–1.50 | **~$1–1.50** | ~2.5 min |
| Opus 5.5 (for comparison) | ~$1.90 | ~$1.00–1.50 | **~$3–3.50** | ~3.5 min |

Prompt caching lowers input costs further. The **Try an example** button replays a recorded run and costs $0.

## Claude API facts the team must know (current as of Oct 2026)

- **No `temperature` / `top_p` / `top_k`:** sending them returns a 400. A seed can't reproduce LLM output, so we **record outputs** as the replay source of truth. Seeds drive only our own sampling, ordering and bootstrap code.
- **Opus 5.5 and Haiku 5.5 always think.** Control cost and speed with `output_config.effort`; both default to `medium`, so set it explicitly per step.
- **Structured outputs:** `client.messages.parse({ …, output_config: { format: zodOutputFormat(Schema) } })` with `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`. Check `parsed_output` for `null`. No recursive schemas; min/max/length rules are stripped and checked client-side.
- **Structured outputs can't be combined with citations** (400). So research is **two calls**: (1) web search, which returns cited text; (2) structuring, which turns those notes into a `MarketModel`.
- **Web search / fetch:** `web_search_20260209` and `web_fetch_20260209`. Set `max_uses`, and cap `max_content_tokens` on fetch. Errors come back as HTTP 200 with an error object in the result block, so check for it. Handle `stop_reason: "pause_turn"` by continuing the turn. Web fetch only fetches URLs already in the conversation.
- **Prompt caching:** the minimum cacheable prefix is 512 tokens on these models. Stable content goes first. Warm each prefix with one call before a concurrent fan-out.
- **Refusals:** check `stop_reason === "refusal"` before reading content. Opus 5.5 supports server-side fallbacks (`fallbacks: "default"` with beta `server-side-fallback-2026-07-01`); Haiku 5.5 does not, so a refused simulation call is a skipped respondent.
- **Batches API** costs 50% less but runs asynchronously. It's fine for precomputing the recorded example run, and useless live.
- **New schema warm-up:** the first request with a new schema pays a one-time compile cost (cached for 24 hours). Run one warm-up before the demo.
- **Rate limits depend on account tier.** Buy credits ahead of the event so the demo key isn't on the lowest tier.

## Dependencies (to approve before scaffolding)

| Package | Why |
|---|---|
| `next`, `react`, `react-dom` | The app |
| `typescript`, `@types/*` | Types |
| `zod` | Contracts, draft schemas, env validation |
| `@anthropic-ai/sdk` | Claude |
| `server-only` | Build error if platform code is imported into the browser |
| `vitest` | Tests |
| `eslint`, `eslint-config-next` | Lint + module boundaries |
| `tsx` | Run a single step from the command line (`npm run step`) |
| `tailwindcss` (optional) | Styling |
