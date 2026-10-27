---
name: gtm-web
description: Runs the gtm-intake interview in the GTMagic web page instead of the terminal. Use when the owner asks for the web UI, the GTMagic page, or a nicer interface for gtm-intake.
---

# gtm-web: the GTMagic page for gtm-intake

This skill changes **where** the gtm-intake conversation happens, not **what** it is. Follow `.claude/skills/gtm-intake/SKILL.md` for everything about the interview, research, evidence, the save file and the validator. The only change: the owner reads and answers in a local web page, and you post to it with the `ui` command.

Without this skill, gtm-intake runs in the terminal exactly as before.

## Start

1. Run `node .claude/skills/gtm-web/scripts/ui.ts start`. It prints `SESSION <id>` and `URL http://127.0.0.1:<port>/session/<id>`. It reuses a running GTMagic app or starts one (`npm run dev`; run `npm install` first if `node_modules/` is missing).
2. Give the owner the URL and say: "Answer in the page. I'll keep working here."
3. If `ui start` fails, say so in one line and run gtm-intake in the terminal instead.

**Started from the page?** When your prompt already gives you a session id (the owner clicked "Start a new session"), skip `ui start`: the page is open and waiting. Post straight to that session, starting with the one-liner question.

Below, `ui` means `node .claude/skills/gtm-web/scripts/ui.ts` and `<id>` is the session id.

## The one rule: every owner-facing line goes through the page

| In the terminal you would… | In web mode, run |
|---|---|
| Ask the owner 1–4 questions | `ui ask <id> --q "…" --q "…" --wait` (add `--chip "I'm not sure, skip"` where skipping is fine) |
| Say something to the owner | `ui say <id> "…"` |
| Move to the next step | `ui status <id> <step> ["detail"]` — steps: `describe`, `guess`, `answers`, `research`, `check`, `save`, `test`, `results` |
| Show a section of the save file | `ui plate <id> <plate>` — plates: `baseline`, `creatives`, `economics`, `ads`, `constraints`, `research`, `evidence`, `save` |

- `ask --wait` prints `ASK <askId>`, then `ANSWER {"text":…,"from":…,"files":[…]}` when the owner answers (exit 0). Use the text as the owner's answer.
- Exit 3 means no answer yet: run `ui wait <id> <askId>` (never re-ask; that would post the question twice). Keep re-running it; the owner may be thinking or away.
- If the Bash call itself times out, the question is still open: run `ui wait`, never `ui ask` again.
- Run `ui` commands one at a time, not in parallel.
- `files` are paths inside the session folder, `gtm-workspace/.sessions/<id>/uploads/…`. Read them there and copy them into the business's `sources/` as gtm-intake says.
- Asking a new question closes any earlier open one, so the page never shows two.
- Never answer for the owner in a live session.

## Keeping the page in step with the save file

- As soon as gtm-intake creates `gtm-workspace/<business-slug>/`, run `ui link <id> <business-slug>`. Cards read from that folder's `intake.json`.
- After each `validate_intake.py --write` that adds or changes a section, run `ui plate` for it, in story order: `baseline` (after the frozen baseline), `creatives`, `economics`, `ads`, `constraints` (end of session 1), `research` and `evidence` (session 2), `save` (handoff). A card always shows the latest file; the page marks it "updated" if it changes later.
- Cards draw only on `intake.json`. Never paste numbers or quotes into `ui say` that the save file doesn't hold.
- During the research turn, send progress every few results: `ui status <id> research "12 pieces of evidence"`. The page shows "Claude Code isn't connected" after 90 seconds of silence while no question is open.

## Answers typed in the terminal

If the owner types an answer in the terminal while a question is open, record it so the page closes the question: `ui answer <id> <askId> --from terminal "…"`, then carry on.

## Demo mode (gtm-intake's scripted KeepStrong owner)

Run gtm-intake's demo mode as written (`fixtures/demo/intake-script.md`, seeded evidence, no live search). For each question: `ui ask <id> --q "…"` **without** `--wait`, then `ui answer <id> <askId> --from scripted "<the script's answer>"`. The page labels every scripted turn "Scripted demo owner · fictional" and never waits for input.

## Finish

Run `ui plate <id> save`, tell the owner where the files are, then `ui done <id>`. On an error you can't recover from, `ui error <id> "<plain words>"` and continue in the terminal.

## Command reference

```
ui start [--port 3000]
ui say <id> <text>
ui status <id> <step> [detail]
ui plate <id> <plate>
ui ask <id> --q <text> [--q <text>…] [--chip <text>…] [--wait] [--timeout <seconds, default 100>]
ui wait <id> <askId> [--timeout <seconds>]
ui answer <id> <askId> --from terminal|scripted <text>
ui cancel <id> <askId>
ui link <id> <business-slug>
ui done <id>
ui error <id> <message>
```

Exit codes: 0 ok · 2 usage or error (message on stderr) · 3 still waiting.
