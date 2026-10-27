# GTMagic Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Next.js app in the Isotype design that shows `gtm-intake` save files and, through a new `gtm-web` skill, lets the owner run the intake interview in the browser instead of the terminal.

**Architecture:** Next.js App Router at the repo root reads `gtm-workspace/` and `fixtures/demo/` from disk. A Node CLI (`ui.ts`) that Claude Code runs through Bash appends events to `gtm-workspace/.sessions/<id>/transcript.jsonl`. The app streams those events to the page, and writes back only owner answers and uploads. Cards always render from `intake.json`, never from chat text.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Zod 4, Vitest, ESLint (eslint-config-next), Node 22.18+ (native TypeScript type stripping for the CLI).

**Spec:** `docs/superpowers/specs/2026-10-25-nextjs-port-design.md`

## Global Constraints

- Local only: bind to `127.0.0.1`; no hosting, accounts, or Claude calls from the app.
- Do not modify `.claude/skills/gtm-intake/`, `src/contracts/`, `docs/CONTRACTS.md`, `src/modules/*`, `src/platform/`.
- TypeScript strict; no `any`, no `unknown`, no untyped `Record<string, …>`; every source file under 300 lines; types come from Zod via `z.infer`.
- `dangerouslySetInnerHTML` is banned. Generated text renders as text.
- Design: DESIGN.md tokens; Jost 400/500 only (`next/font/local`, files from `prototype/fonts/`); hue = customer group only; no Tailwind.
- Copy: plain words ("customer groups", "must-haves", "how customers talk"; never "segment", "ICP", "lexicon"). Simulated numbers say "Simulated preference" with n and "Not a conversion rate". Placeholder crowd labelled "Placeholder choices: the simulation step isn't built yet." Drafts labelled "Draft lines: verify before publishing." Demo marked "Example · fictional data".
- The app writes only inside `gtm-workspace/.sessions/<id>/` (`transcript.jsonl` answer events, `uploads/`). Upload cap 10 MB. Business and session names validated against `^[a-z0-9][a-z0-9-]{0,63}$` (sessions: `^[a-z0-9-]{8,40}$`).
- Lenient intake schema: unknown keys pass through (`z.looseObject`); script-computed fields optional/nullable and rendered "not worked out yet". Dangling references are dropped with a warning, never a crash. Download returns the raw file bytes.
- `prototype/` is deleted in the final task, after parity is checked.

## Review Focus

1. `intake.json` read while the skill is mid-write (truncated JSON) → keep showing the last good version; no error flash. Test in Task 3.
2. The same question answered from two tabs, or after it was cancelled → first answer wins; later posts get HTTP 409 and the page shows it as already answered. Test in Task 5.
3. Upload named `../../etc/passwd.csv`, or over 10 MB → stored under a sanitized name inside `uploads/`; over-cap gets 413. Test in Task 5.
4. Claude Code interrupted while `ui ask --wait` blocks, then a new question arrives → the new `ask` closes any earlier open ask (the page never shows two open questions). Test in Task 6.
5. `ui start` when the dev server is already running (or port 3000 is taken by something else) → reuses the running GTMagic server via a health check; if the port belongs to another program, picks the next free port and prints that URL. Test in Task 4.

---

### Task 1: Scaffold the Next.js app with the design system

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx` (temporary "GTMagic" placeholder, replaced in Task 9), `src/app/fonts/jost-400.woff2`, `src/app/fonts/jost-500.woff2` (moved from `prototype/fonts/`, keep copies in prototype until Task 11), `src/app/styles/{base,thread,cards,intake}.css` (ported from `prototype/*.css`), `tests/smoke.test.ts`
- Modify: `.gitignore` (add `.playwright-mcp/`, `.impeccable/review/`, `next-env.d.ts` already present)

**Interfaces:**
- Produces: `@/*` → `src/*` path alias; npm scripts `dev` (`next dev -H 127.0.0.1`), `build`, `start`, `test` (`vitest run`), `lint` (`eslint .`), `typecheck` (`tsc --noEmit`); CSS class names identical to the prototype's.

- [ ] **Step 1:** Write `tests/smoke.test.ts` asserting `existsSync("src/app/fonts/jost-500.woff2")` and that `src/app/styles/base.css` defines `--ground: #fbfbf8`.
- [ ] **Step 2:** Run `npx vitest run tests/smoke.test.ts` — expect FAIL (no vitest / files).
- [ ] **Step 3:** Create the files. `npm install next@16 react@19 react-dom@19 zod@4` and dev deps `typescript @types/node @types/react @types/react-dom vitest eslint eslint-config-next`. In `base.css` replace the `@font-face` rules with `font-family: var(--font-jost), "Futura", system-ui, sans-serif`; `layout.tsx` loads `next/font/local` with weights 400 and 500 as `--font-jost`, imports the four CSS files, sets `<title>GTMagic</title>` and `lang="en"`. `tsconfig` strict, `noUncheckedIndexedAccess: true`.
- [ ] **Step 4:** Run `npm test && npm run typecheck && npm run lint && npm run build` — all pass.
- [ ] **Step 5:** Commit `feat: scaffold local Next.js app with GTMagic design system`.

### Task 2: Intake schema, labels, and integrity pass

**Files:**
- Create: `src/app/_intake/schema.ts`, `src/app/_intake/integrity.ts`, `src/app/_intake/labels.ts`
- Test: `tests/intake/schema.test.ts`, `tests/intake/integrity.test.ts`, `tests/fixtures/intake-broken.json` (copy of the demo with `lexicon[0].evidenceId = "ev_missing"` and `roughMessaging[0].lexiconIds = ["lex_missing"]`)

**Interfaces:**
- Produces: `IntakeBrief = z.infer<typeof IntakeBriefSchema>` (mirrors `.claude/skills/gtm-intake/references/schema.md` v1 incl. #3 and #6: `unitEconomics`, `creatives[]`, `lexicon[].voice`, `priorExperiments[].source/sourceFile?/creativeIds?/conversionType?`, `skeptic[].kind`, `evidence[].creativeId?`); `parseIntake(raw: string): { ok: true; brief: IntakeBrief } | { ok: false; issues: string[] }` (max 5 plain-word issues); `cleanIntake(brief: IntakeBrief): { brief: IntakeBrief; warnings: string[] }`; `PLAIN` label maps typed as `Record<EnumUnion, string>` for verdict, confidence, bucket, dimension, appliesTo, finding kind, sourceType, hypothesis status, skeptic result, skeptic kind, ad verdict, conversionType, channel, creative status.

- [ ] **Step 1:** Tests: `parseIntake(readFileSync("fixtures/demo/intake.json"))` is ok and `brief.creatives.length === 3`; an extra top-level key `futureField` survives parsing; `JSON.parse` failure returns `ok:false` with an issue starting "The save file isn't valid JSON"; `cleanIntake(broken)` drops `lex_1`, removes `lex_missing` from roughMessaging, and returns 2 warnings; every enum value in the schema has a `PLAIN` entry (iterate `Schema.options`).
- [ ] **Step 2:** Run `npx vitest run tests/intake` — FAIL.
- [ ] **Step 3:** Implement. Objects use `z.looseObject`; `unitEconomics`, `sizeMath`, `concernBundles`, `performance`, verdicts are `.optional()`/`.nullable()`. Integrity rules: lexicon→evidence, roughMessaging→lexicon, evidence→segment/concern, creatives↔priorExperiments ids.
- [ ] **Step 4:** Run `npx vitest run tests/intake` — PASS.
- [ ] **Step 5:** Commit `feat: UI-private intake schema with integrity pass`.

### Task 3: Workspace reader

**Files:**
- Create: `src/app/_intake/workspace.ts`
- Test: `tests/intake/workspace.test.ts` (uses a temp dir via `GTM_ROOT` env override)

**Interfaces:**
- Consumes: `parseIntake`, `cleanIntake` (Task 2).
- Produces: `workspaceRoot(): string` (`process.env.GTM_ROOT ?? process.cwd()`); `isSafeName(name: string, kind: "business" | "session"): boolean`; `listBusinesses(): Promise<BusinessSummary[]>` where `BusinessSummary = { slug: string; name: string; updatedAt: string; status: "ready" | "no-supported-segment" | "needs-more" | "unreadable"; isDemo: boolean }` (demo first, slug `"demo"`, from `fixtures/demo/intake.json`); `readBusiness(slug: string): Promise<{ brief: IntakeBrief; warnings: string[]; rawPath: string } | { error: string } | null>` with a per-path last-good cache.

- [ ] **Step 1:** Tests: lists `demo` plus a temp `gtm-workspace/acme/intake.json`; `isSafeName("../x","business") === false`; `readBusiness("../etc")` returns null; writing a truncated `intake.json` after a good read returns the previous good brief (Review Focus 1); a folder without `intake.json` is skipped; `.sessions` is never listed as a business.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement with `fs/promises`; resolve paths and assert they stay under the workspace root (`path.relative` must not start with `..`).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: read save files from gtm-workspace`.

### Task 4: Transcript events and the `ui` bridge command

**Files:**
- Create: `src/app/_session/events.ts`, `.claude/skills/gtm-web/scripts/ui.ts`
- Test: `tests/session/events.test.ts`, `tests/session/ui-cli.test.ts` (spawns `node .claude/skills/gtm-web/scripts/ui.ts` with `GTM_ROOT` = temp dir)

**Interfaces:**
- Produces: `TranscriptEvent = z.infer<typeof TranscriptEventSchema>`, a discriminated union on `kind`: `say {text}`, `ask {questions: string[]; chips?: string[]}`, `answer {askId: string; text: string; from: "page"|"terminal"|"scripted"; files?: string[]}`, `cancel {askId}`, `status {step: StepId; detail?: string}`, `plate {plate: PlateId}`, `link {business}`, `done {}`, `error {message}`; every event has `id` (`ev-<n>`), `at` (ISO). `StepId = "describe"|"guess"|"answers"|"research"|"check"|"save"|"test"|"results"`. `PlateId = "baseline"|"creatives"|"economics"|"ads"|"constraints"|"research"|"evidence"|"save"|"crowd"|"results"`.
- CLI (exit 0 ok, 2 usage/error, 3 still waiting): `ui start [--port 3000]` → prints `SESSION <id>` and `URL http://127.0.0.1:<port>/session/<id>`; `ui say <id> <text>`; `ui status <id> <step> [detail]`; `ui plate <id> <plate>`; `ui ask <id> --q <text> [--q …] [--chip <text> …] [--wait] [--timeout <s, default 540>]` → prints `ASK <askId>`, and with `--wait` prints `ANSWER <json>` when answered; `ui answer <id> <askId> --from terminal|scripted <text>`; `ui cancel <id> <askId>`; `ui link <id> <business>`; `ui done <id>`. The CLI is self-contained (no imports from `src/`), appends with `fs.appendFileSync` one JSON line per event.
- `ui start` health check: `GET /api/health` returns `{ app: "gtmagic" }`; reuse if it answers, else spawn `npm run dev -- -p <port>` detached with logs to `.sessions/<id>/server.log`, trying the next port when taken by another program (Review Focus 5).

- [ ] **Step 1:** Tests: every line the CLI writes parses with `TranscriptEventSchema`; `ask --wait --timeout 1` exits 3 with no answer; after appending an `answer` event, `ask --wait` prints it and exits 0; a second `ask` appends a `cancel` for the earlier open ask (Review Focus 4); `link` with `../x` exits 2; `start` with a stub server answering `/api/health` reuses it without spawning.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement. `--wait` polls the transcript every 500 ms.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: transcript events and ui bridge command`.

### Task 5: API routes

**Files:**
- Create: `src/app/_session/store.ts`, `src/app/api/health/route.ts`, `src/app/api/businesses/route.ts`, `src/app/api/businesses/[slug]/route.ts`, `src/app/api/businesses/[slug]/intake.json/route.ts`, `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/route.ts`, `src/app/api/sessions/[id]/stream/route.ts`, `src/app/api/sessions/[id]/answer/route.ts`
- Test: `tests/session/store.test.ts`, `tests/api/routes.test.ts` (call exported handlers with `new Request(...)`)

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: `readSession(id): Promise<SessionView | null>` with `SessionView = { id: string; business: string | null; events: TranscriptEvent[]; openAsk: string | null; lastEventAt: string | null }`; `listSessions(): Promise<Array<{ id: string; business: string | null; lastEventAt: string | null; done: boolean }>>`; `appendAnswer(id, askId, text, files): Promise<"ok" | "closed" | "unknown-ask">`; `saveUpload(id, file: File): Promise<{ path: string } | { error: "too-large" | "bad-type" }>`.
- Routes: `GET /api/health` → `{app:"gtmagic"}`; `GET /api/businesses` → `BusinessSummary[]` plus `sessions`; `GET /api/businesses/[slug]` → brief + warnings; `GET /api/businesses/[slug]/intake.json` → raw bytes, `content-disposition: attachment`; `GET /api/sessions/[id]` → `SessionView` plus the linked brief; `GET /api/sessions/[id]/stream` → SSE, `event: update` whenever transcript or linked `intake.json` mtime changes (checked every 1 s), plus a 15 s `event: ping`; `POST /api/sessions/[id]/answer` (multipart: `askId`, `text`, `files[]`) → 200, 409 when closed/answered (Review Focus 2), 413 over 10 MB (Review Focus 3), 404 unknown session.

- [ ] **Step 1:** Tests: answer twice → second 409; answer after `cancel` → 409; upload `../../etc/passwd.csv` saved as `uploads/passwd.csv` (basename, `[^a-z0-9._-]` → `-`); 11 MB file → 413; allowed types csv, xlsx, txt, pdf, png, jpg, webp; download returns bytes identical to the file; unsafe slug → 404.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement; route segments read params with the Next 16 async `params` API.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: local API for save files, sessions and answers`.

### Task 6: Thread model (events + brief → what the chat shows)

**Files:**
- Create: `src/app/_session/thread.ts`
- Test: `tests/session/thread.test.ts`

**Interfaces:**
- Consumes: `TranscriptEvent`, `IntakeBrief`.
- Produces: `buildThread(events: TranscriptEvent[], briefUpdatedAt: string | null): ThreadView` where `ThreadView = { items: ThreadItem[]; steps: Record<StepId, "pending"|"running"|"done"|"failed">; openAsk: { askId: string; questions: string[]; chips: string[] } | null; mode: "live" | "scripted"; business: string | null; finished: boolean }` and `ThreadItem` is `{ kind: "bot"; text } | { kind: "ask"; askId; questions; state: "open"|"answered"|"cancelled"|"answered-in-terminal" } | { kind: "owner"; text; from; files } | { kind: "plate"; plate: PlateId; updated: boolean } | { kind: "notice"; tone: "error"|"info"; text }`. `mode` is `"scripted"` once any answer has `from: "scripted"`. A `status` event marks earlier steps done and its step running. `updated` is true when `briefUpdatedAt` is later than the plate event's `at`. `isDisconnected(lastEventAt: string | null, now: Date, openAsk: boolean): boolean` → true after 90 s without events while no question is open.

- [ ] **Step 1:** Tests: ask→answer(page) marks the ask answered and adds an owner item; answer(from terminal) → state `answered-in-terminal`; a second ask cancels the first; scripted answers set `mode:"scripted"`; plate shown before a later brief update → `updated:true`; `isDisconnected` true at 91 s, false while an ask is open.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement as a pure reducer. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: thread model from transcript events`.

### Task 7: Chat components

**Files:**
- Create: `src/components/shell/{Rail,Steps,Legend,Composer}.tsx`, `src/components/turns/{BotTurn,OwnerTurn,AskTurn,Typing,Notice}.tsx`, `src/components/evidence/{Quote,SimulatedBlock,Tag,GroupFigure}.tsx`, `src/components/figures.tsx` (the inline SVG `<symbol>` defs and icon helper from `prototype/index.html`)
- Test: `tests/components/turns.test.tsx` (`renderToStaticMarkup`; add `@vitejs/plugin-react` and `jsdom` only if needed)

**Interfaces:**
- Consumes: `ThreadItem`, `PLAIN`.
- Produces: components with the prototype's class names. `Quote({ evidence, phrase, hideLinks })`; `SimulatedBlock({ label, text })`; `OwnerTurn({ text, from, files })` shows "Scripted demo owner · fictional" when `from === "scripted"` and "Answered in the terminal" when `"terminal"`; `Composer({ disabled, placeholder, onSubmit(text, files) })` shows "Don't paste personal or confidential information." whenever enabled, accepts paste and a file picker (types from Task 5).

- [ ] **Step 1:** Tests: `Quote` with the lexicon phrase renders a `<mark>` around exactly that phrase and a source link, and no link when `hideLinks`; `SimulatedBlock` markup contains class `sim` and never `<q>`; text containing `<script>` renders escaped; scripted `OwnerTurn` contains "Scripted demo owner · fictional".
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: chat and evidence components`.

### Task 8: Plates

**Files:**
- Create: `src/components/plates/{Baseline,Creatives,Economics,Ads,Constraints,Research,Evidence,SaveFile,Crowd,Results,CustomerCard,Plate}.tsx`, `src/app/_intake/sim-placeholder.ts` (ported from `prototype/sim-placeholder.js`)
- Test: `tests/components/plates.test.tsx`, `tests/intake/sim-placeholder.test.ts`

**Interfaces:**
- Consumes: `IntakeBrief`, `PLAIN`, Task 7 components.
- Produces: `Plate({ plate: PlateId, brief, updated, hideLinks })` dispatching to each card; `buildSim(brief): SimRun` with `SimRun = { size: 48; messages: Array<{ label: string; headline: string; subheadline: string; isCurrent: boolean }>; perSegment: number[]; customers: SimCustomer[] }`. Messages are `roughMessaging` A–D plus a "Your current headline" row from the first `creatives[]` entry with `status: "live"` (fallback: first with a headline). Hand-set choices for the current-headline row: rank 1 → 5, rank 2 → 2, taken from the "none" count (keep totals 34 and 14 on the demo).
- New card `Creatives` ("What you've already made"): each creative's headline/body/CTA as the owner's words (not quote style), status, channel, and its `performance` verdict when present.
- `Research` quotes only `lexicon` entries with `voice === "customer"`; `Ads` shows "Typed in by you" for `source: "manual"` and "not recorded" for missing metrics; `Economics` as in `prototype/economics.js`.

- [ ] **Step 1:** Tests on the demo brief: Economics markup contains "$134.91", "$94.44", "$53.96", "$40.47"; Ads contains "Judged against $53.96"; a copy with `metrics.clicks` removed shows "not recorded"; Creatives lists "Strength first, scale second"; a copy with every lexicon `voice` set to `"owner"` renders no `<q>` in Research; `buildSim` gives `perSegment` `[34, 14]`, 48 customers, and a `isCurrent` row; Results contains "Simulated preference, n = 48. Not a conversion rate." and the placeholder label.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: plates rendered from the save file`.

### Task 9: Pages — home, saved business, live session

**Files:**
- Create: `src/app/page.tsx` (replace placeholder), `src/app/run/[business]/page.tsx`, `src/app/session/[id]/page.tsx`, `src/components/session/LiveSession.tsx` (client: subscribes to `/api/sessions/[id]/stream`, refetches the session view on `update`, posts answers), `src/components/run/SavedRun.tsx`
- Test: `tests/components/pages.test.tsx` (static render of `SavedRun` with the demo brief)

**Interfaces:**
- Consumes: Tasks 3, 5, 6, 7, 8.
- Home: lists live sessions (link `/session/<id>`, "live" or "finished"), saved businesses (link `/run/<slug>`, status in plain words), "Try the example" (link `/run/demo?replay=1`), and a one-line how-to: "In Claude Code, ask for the GTMagic web UI to start a session." Empty state when nothing is in `gtm-workspace/`.
- `/run/[business]`: all plates for that brief in story order (baseline, creatives, economics, ads, constraints, research, evidence, save file), warnings as an info notice, "Download save file" linking the raw route; unreadable file → error card listing issues.
- `/session/[id]`: the thread from `buildThread`; composer enabled only while `openAsk` and `mode === "live"`; chips post as answers; disconnected notice "Claude Code hasn't sent anything for a while. Check the terminal." when `isDisconnected`; `?nolinks` hides source links.

- [ ] **Step 1:** Test: `SavedRun` on the demo renders the eight plate headings in order and the download link `/api/businesses/demo/intake.json`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS, then `npm run build`.
- [ ] **Step 5:** Commit `feat: home, saved run and live session pages`.

### Task 10: Demo replay and the `gtm-web` skill

**Files:**
- Create: `src/app/_intake/demo-script.ts` (typed port of `prototype/demo-script.js`), `src/components/run/DemoReplay.tsx` (client: replays the script into `ThreadItem`s on timers honoring reduced motion, then the crowd and results; `#error` shows the research-failed state with "Try again"), `.claude/skills/gtm-web/SKILL.md`
- Modify: `src/app/run/[business]/page.tsx` (render `DemoReplay` when `business === "demo"` and `replay=1`)
- Test: `tests/intake/demo-script.test.ts`

**Interfaces:**
- `SKILL.md` frontmatter: `name: gtm-web`, `description:` "Runs the gtm-intake interview in the GTMagic web page instead of the terminal. Use when the owner asks for the web UI, the GTMagic page, or a nicer interface for gtm-intake." Body (under 120 lines): start with `node .claude/skills/gtm-web/scripts/ui.ts start` and give the owner the URL; follow `gtm-intake` exactly for content; every owner question → `ui ask <id> --q … --wait` (re-run on exit 3; never answer for the owner in live mode); visible lines → `ui say`; step changes → `ui status`; after creating the business folder → `ui link`; after each `validate_intake.py --write` that changed a section → `ui plate`; terminal typing → `ui answer --from terminal`; demo mode → `ui ask` without `--wait` then `ui answer --from scripted` with the script's line; end → `ui done`; if `ui start` fails, say so and continue in the terminal. The full CLI reference is in this file.
- Test: every `demo-script.ts` event of kind `plate` names a valid `PlateId`; the script's first owner line equals `fixtures/demo/one-liner.txt` (trimmed).

- [ ] **Step 1:** Write the test. **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: demo replay and gtm-web skill`.

### Task 11: Parity check, end-to-end run, remove the prototype

**Files:**
- Delete: `prototype/`
- Modify: `README.md` "Running it" section: `npm install`, `npm run dev`, open `http://127.0.0.1:3000`; or in Claude Code ask for the GTMagic web UI.

- [ ] **Step 1:** With `npm run dev`, open `/run/demo?replay=1` and the old prototype side by side at 1440 and 390 wide; confirm every prototype plate, label and state is present (list any gap and fix it before continuing).
- [ ] **Step 2:** End-to-end bridge check: `node .claude/skills/gtm-web/scripts/ui.ts start`, then `ui say`, `ui ask --wait` in one shell; answer in the browser; confirm the CLI prints `ANSWER` and the page shows the answer; `ui link <id> demo`-equivalent with a temp business folder shows plates.
- [ ] **Step 3:** Delete `prototype/`; run `npm test && npm run typecheck && npm run lint && npm run build` — all pass.
- [ ] **Step 4:** Commit `chore: replace the HTML prototype with the Next.js app`.

### Task 12: One-click start from the page (spec addendum)

**Files:** Create `src/app/_session/launcher.ts`, `src/app/api/sessions/[id]/stop/route.ts`, `src/components/home/StartSession.tsx`. Modify `src/app/_session/store.ts` (`createSession`), `src/app/api/sessions/route.ts` (POST), `src/app/page.tsx`, `src/components/session/LiveSession.tsx`, `.claude/skills/gtm-web/SKILL.md`. Test: `tests/session/launcher.test.ts`, `tests/api/start-stop.test.ts`.

**Interfaces:** `createSession(): string` (id, same files as `ui start`); `claudeArgs(id: string): string[]` (pure: `-p <prompt> --permission-mode dontAsk --allowedTools …`); `launchAgent(id, spawnFn = spawn): number | null` (pid; writes `agent.log`, records `pid` in session.json); `agentRunning(id): boolean` (pid alive); `stopAgent(id): boolean`. `POST /api/sessions` → `{ id }` (409 never; 500 with plain message if `claude` isn't found); `POST /api/sessions/[id]/stop` → `{ ok }`. `SessionView` gains `agent: "running" | "stopped" | "none"`.

- [ ] Tests: `claudeArgs` contains `--permission-mode dontAsk`, every pre-approved entry from the addendum, and the session id in the prompt, and nothing that allows arbitrary Bash; `POST /api/sessions` with a fake spawn creates the session folder and records the pid; stop on a session with a dead pid returns ok and appends `done`; `agent` is `"stopped"` when the pid isn't alive and no `done` exists.
- [ ] Run — FAIL. Implement. Run — PASS. Browser check: click Start, first question appears in the page (real Claude Code run). Commit `feat: one-click start from the page`.
