# GTMagic web UI: a local Next.js face for the gtm-intake skill

Date: 2026-10-25 · Branch: `ui` · Status: design, awaiting approval

## Intent

The `gtm-intake` skill is the product. Today an owner runs it in Claude Code in a terminal. This work gives them a much more appealing way to use the same skill: a local web page in the GTMagic Isotype design, driven by their own Claude Code session.

The user's words:
- "it's meant to be a local only setup — the skill is the key, the actual page is meant to be a local only UI for the skill"
- "user will use the much more appealing UI instead of using the terminal to interact with the skill"
- "the user points claude code towards the repo root, and the claude code agent will drive the web UI"
- "they of course can also invoke the skill directly without the web UI"
- A separate skill for the web mode "makes sense for now."
- Next.js; port the existing prototype; a tutorial section comes later. No contract changes for now.

## How it works (the decided shape)

1. The owner opens Claude Code at the repo root and asks for the web UI (or runs the new `gtm-web` skill by name).
2. `gtm-web` starts the local Next.js app (if not running), gives the owner the link, and runs `gtm-intake`.
3. Wherever `gtm-intake` would ask the owner something in the terminal, `gtm-web` asks it in the page instead and waits for the answer there. In web mode the owner answers only in the page; the terminal just shows Claude Code working. *(Author's guess; the user didn't specify.)*
4. As `gtm-intake` writes `gtm-workspace/<business>/intake.json` (and its research log), the page re-reads it and shows the cards: campaigns, what a new customer can cost, what you told me, customer groups, the case against, the save file.
5. Without the skill running, the app is a viewer: it lists every business folder in `gtm-workspace/` plus the KeepStrong demo (`fixtures/demo/intake.json`) and shows any of them.
6. Running `gtm-intake` directly in the terminal is unchanged.

## Goals

1. **Next.js app** at the repo root (`npm run dev`), local only, porting `prototype/` screen for screen: same Isotype look (DESIGN.md), copy, honesty labels, states, phone layout.
2. **Viewer:** a home that lists businesses found in `gtm-workspace/*/intake.json` plus the demo; a run page per business that renders its save file with the plates from the prototype.
3. **Live mode:** while `gtm-web` drives a session, the run page shows the conversation (the skill's questions and lines, the owner's answers) and the cards, updating as files change, and lets the owner answer questions in the chat.
4. **`gtm-web` skill** in `.claude/skills/gtm-web/`, which wraps `gtm-intake` without modifying it.
5. **Demo replay:** the scripted KeepStrong walk-through from the prototype stays available (no Claude needed), so anyone can see the experience.
6. `npm run dev`, `build`, `test`, `lint`, `typecheck` exist and pass.

## Non-goals

- No hosting, accounts, or public URL. Local only.
- The app makes no Claude calls and holds no API key; the owner's Claude Code session is the only agent.
- No changes to `gtm-intake` (owned by the lead), `src/contracts/`, or `docs/CONTRACTS.md`.
- No simulation step: the crowd test stays a labelled placeholder until a simulation skill exists.
- No tutorial section yet.

## Anti-goals (a failure even if it runs)

- Breaking or changing the terminal experience of `gtm-intake`.
- Cards drawing numbers or quotes from Claude's chat text instead of the save file (numbers come from code and the file; quotes from `evidence`).
- Losing the honesty rules: real quotes vs simulated words look different; simulated numbers labelled with n; placeholder crowd labelled; drafts labelled; demo marked fictional.
- Rendering generated text as HTML (`dangerouslySetInnerHTML` banned).
- A page that hangs silently: if Claude Code stops or the bridge breaks, the page says so.

## The bridge between Claude Code and the page (author's call)

**Files plus a small command, not an MCP server.** It mirrors the Impeccable decision page used successfully in this session, needs no Claude Code configuration, and keeps everything on disk next to the files the skill already writes.

- Per business, a folder `gtm-workspace/<business>/ui/` holds:
  - `transcript.jsonl`: append-only events, each `{ id, at, kind, ... }`, where kind is `say` (a skill line), `ask` (numbered questions, optional skip/choice chips), `answer` (owner text), `status` (step + progress, e.g. "researching, 12 pieces of evidence"), `plate` (a pointer like `{ plate: "economics" }` telling the page to show a card built from `intake.json`), `done`, `error`.
  - The page renders the conversation from `transcript.jsonl` and every card from `intake.json`. Plates never carry data of their own.
- A command the skill runs through Bash, shipped in `.claude/skills/gtm-web/scripts/` (Node, no extra install beyond the repo's): 
  - `ui start` starts or reuses the dev server and prints the URL;
  - `ui say|status|plate <business> ...` appends an event;
  - `ui ask <business> --questions ... [--wait]` appends an `ask` and, with `--wait`, blocks until the page writes the matching `answer`, then prints it. It returns after a bounded time with a "still waiting" exit code so Claude Code re-runs it (Bash calls are capped at 10 minutes).
- The Next.js app reads those files and pushes changes to the browser (server-sent events or polling every ~1s; builder's call). When the owner answers, the app appends the `answer` event; nothing else in the workspace is written by the app.
- The page shows "Claude Code isn't connected" when no event has arrived for a while during a live session (heartbeat via `status`).

## The `gtm-web` skill

- Triggers on asking for the web UI / the GTMagic page.
- Steps: run `ui start`, give the owner the link; tell them to answer in the page; run `gtm-intake`'s flow, with one rule layered on top: every question to the owner goes through `ui ask --wait`, every visible line through `ui say`, step changes through `ui status`, and after each validator run that changes `intake.json`, the matching `ui plate`.
- Does not restate `gtm-intake`'s rules; it defers to that skill for content and only changes the channel.
- If the page can't start, it says so and falls back to the terminal.

## Constraints

- Repo rules (CLAUDE.md): TypeScript strict; no `any`/`unknown`/untyped records; files under 300 lines; types from Zod (`z.infer`).
- Stack: Next.js 16 App Router, React, TypeScript, Zod 4, Vitest, ESLint, Node 22+. No Tailwind: the hand-written CSS carries DESIGN.md. Fonts via `next/font/local` with the committed Jost 400/500.
- The app runs on `localhost` only and reads/writes only inside `gtm-workspace/` (answers) and reads `fixtures/demo/`. Business folder names are validated (no path traversal).
- Folder ownership: pages in `src/app/`, components in `src/components/`. The user authorised creating the scaffold (`package.json`, configs). The intake schema stays UI-private (not in `src/contracts/`).

## App structure (decided)

- Routes: `/` lists businesses (workspace folders + demo) and offers the demo walk-through; `/run/[business]` shows one business (live or saved); the demo walk-through is `/run/demo` in replay mode.
- `src/app/_intake/`: UI-private Zod schema for `intake.json` (mirrors `.claude/skills/gtm-intake/references/schema.md` v1 including the #3 fields), the loader, the transcript event schema, and plain-word label maps.
- `src/components/`: one component per prototype builder: shell (rail, steps, legend, composer), turns, quote and simulated block, and each plate (baseline, economics, ads, constraints, research, evidence, save file, crowd, results, customer card).
- Route handlers under `src/app/api/` for: listing businesses, reading a business's intake + transcript, the change stream, and posting an answer. (Normally the lead's folder; covered by the scaffold authorisation; local only.)
- `prototype/` is deleted once the Next.js pages match it.

## Demo mode through the page (user decision)

`gtm-intake`'s demo mode (Claude plays the fictional KeepStrong owner from `fixtures/demo/intake-script.md`) also runs through the web page. In that mode `gtm-web` posts each question with `ui ask` **without** `--wait`, then posts the scripted owner's reply itself with `ui answer <id> --from scripted "..."`. The page never waits for input, disables the composer, and labels every owner turn "Scripted demo owner · fictional" in the owner-turn style. The run is otherwise identical to a live one (real research turn, real validator runs, real cards). This is separate from `/run/demo`, the no-Claude replay of the prototype walk-through, which stays.

`answer.from` is therefore `"page" | "terminal" | "scripted"`.

## Schema additions from main #6 to carry into the app

- `creatives[]`: what the owner already made (ads, landing-page headlines, emails, CTAs), linked to results by `creativeIds`/`experimentIds`. Add a "What you've already made" card, and use the owner's current headline creative as a "Your current headline" row in the crowd test (the prototype dropped that row because the earlier schema had no field for it).
- `lexicon[].voice` (`customer` | `owner`): only `customer` entries are shown as "how customers talk" and as a customer's voice in the crowd card; owner-voice phrases are labelled as the owner's own words.
- `priorExperiments`: `channel` adds `website`; `source: "file" | "manual"`; `sourceFile` optional (show "typed in by you" for manual); a missing metric shows "not recorded", never 0.
- `evidence.creativeId`: excerpts copied from a creative are the owner's words (first-party), styled as owner text, never as a customer quote.

## Decisions from the second builder check (author's calls)

- **Sessions before a name exists.** `ui start` creates a session `gtm-workspace/.sessions/<id>/` holding `transcript.jsonl` and `session.json`, and the link is `/session/<id>`. Once `gtm-intake` creates the business folder, `gtm-web` records it with `ui link <id> <business>`; from then on the page reads cards from `gtm-workspace/<business>/intake.json`. The home page lists live sessions as well as saved businesses. (This replaces the per-business `ui/` folder above; `/run/[business]` stays for viewing saved businesses.)
- **Files and links.** The chat composer accepts a pasted URL as plain text and an attached file (CSV, XLSX, TXT, PDF, images). The app saves an attachment to `gtm-workspace/.sessions/<id>/uploads/<safe-name>` and the `answer` event carries its path; the skill reads it from there and copies it into the business's `sources/` as `gtm-intake` already does. So the app writes only answers and uploads, both inside the session folder. Size cap 10 MB.
- **Typing in the terminal mid-session.** Allowed. If the owner answers in the terminal, `gtm-web` records it with `ui answer <id> --from terminal "..."`; the page marks that question "answered in the terminal" and closes it. A cancelled `ask` gets a `cancel` event so the page never shows a stale open question. Event kinds therefore add `cancel`, and `answer` gains `from: "page" | "terminal"` and optional `files`.
- **When cards appear, and what they show.** A card appears in the thread only on a `plate` event (the skill decides timing). Cards always render from the current `intake.json`; if the file changed after a card was first shown, the card carries a small "updated" mark. The rail's save-file link always shows the latest.

## Decisions carried from the builder check (author's calls)

- **Lenient schema:** unknown keys pass through; script-computed fields (`unitEconomics`, `sizeMath`, `concernBundles`, verdicts) optional, shown as "not worked out yet". A save file that fails the schema shows an error card with the first issues in plain words. A half-written file mid-run is retried on the next change, not shown as an error.
- **Integrity: warn and drop, never crash.** Dangling references are skipped and logged; phrases not found verbatim render without the highlight.
- **Download** returns the raw `intake.json`.

## Tests (Vitest)

- The demo fixture parses; a broken copy with dangling references renders without crashing.
- Transcript events parse; an `ask` followed by an `answer` resolves; the bridge command's `--wait` returns the answer and times out with the "still waiting" code.
- The placeholder simulation splits 48 by normalised shares (34/14 on the demo).
- Business-name validation rejects traversal.

## Left to the builder

- Exact component and file names; global CSS vs CSS Modules.
- Server-sent events vs polling; the heartbeat timeout.
- The bridge command's argument syntax and exit codes, as long as `--wait` is bounded and re-runnable.
- ESLint details, including whether to add the module-boundary rule.
- `.gitignore` additions (`.playwright-mcp/`, `.impeccable/review/`).
- Splitting into commits; this lands on the `ui` branch as one piece of work.

## Addendum (2026-10-25): one-click start from the page (user decision)

The user wants the whole experience in the browser: "one click start is the way to go." The home page gets **Start a new session**. Clicking it:

1. The app creates a session (`gtm-workspace/.sessions/<id>/`, same layout the `ui` CLI uses) and opens `/session/<id>`.
2. The app launches Claude Code in the background: `claude -p "<prompt>" --permission-mode dontAsk --allowedTools <list>`, working directory = repo root, output to `.sessions/<id>/agent.log`, process id recorded in `session.json`. The prompt tells it to use the `gtm-web` skill with this existing session (no `ui start`).
3. Pre-approved actions only (everything else is refused without asking): the `ui` bridge (`Bash(node .claude/skills/gtm-web/scripts/ui.ts *)`), the intake scripts (`Bash(python3 .claude/skills/gtm-intake/scripts/*)`), copying uploads into the workspace (`Bash(cp gtm-workspace/*)`, `Bash(mkdir -p gtm-workspace/*)`), `Read`, `Glob`, `Grep`, `Edit(gtm-workspace/**)` (covers every file-writing tool; `Write(path)` rules are ignored by Claude Code), `WebSearch`, `WebFetch`, `Skill`.
4. The session page shows **Stop session** (kills the process, records a `done`) and, if the process exits without `done`, "Claude Code stopped. See agent.log." Uses the owner's existing Claude Code login; the app still holds no API key.
5. Starting from the terminal (`/gtm-web`) keeps working exactly as before.
