# Pitch script — Scribular Note-Style Coach

Claude Impact Lab Hackathon, Seattle, October 25, 2026. The finals are five-minute live demos plus Q&A, and judging uses five equally weighted criteria (see [hackathon.md](hackathon.md)).

**One-liner:** Less admin, more time talking to patients.

**Claims discipline:** Say only what the demo shows. Don't quote time-saved numbers, don't claim HIPAA compliance or clinical validation, and don't call it "training." The fixtures are fictional. Bracketed names are placeholders; fill them in from [TEAM.md](../TEAM.md) once roles are recorded.

---

## Before you go on stage (5 minutes)

1. Reset demo data: stop the server, run `rm -rf app/data`, then `./start-demo.sh` (or `OLLAMA_URL=http://127.0.0.1:11435 python3 app/server.py` on the build laptop).
2. Run one throwaway simulation so the model is loaded into memory, then reset again. The first generation after a cold start is slower.
3. Set browser zoom to 125% and close other tabs. Open http://127.0.0.1:8765. With no saved templates it opens on **New template**.
4. Optional privacy moment: turn Wi-Fi off before the demo. Everything runs on `127.0.0.1`, so it should keep working. **Rehearse this once first.**

Timings measured on the build laptop (Apple M5, 16 GB, `gemma4:e4b`). These are single runs, not benchmarks:

| Step | Time |
|---|---|
| Build template + first sample note | ~10 s warm (38 s right after a cold start) |
| Session note | ~3–5 s |
| Understand feedback | ~1 s |
| Before/after preview | ~5 s |

---

## Final: five-minute live demo

### 0:00–0:30 · Hook (spoken; the app is on screen behind you)

> "Every therapy session ends the same way: with paperwork. Therapists write a progress note for every client, for insurance and for the record, between sessions or late at night. That's time not spent with patients.
>
> We're Scribular, and our promise is simple: **less admin, more time talking to patients.**"

### 0:30–1:15 · Problem → our approach (spoken)

> "AI scribes can draft those notes, but most of them send the session to someone else's cloud. In therapy, that's the most sensitive conversation in a person's life.
>
> Scribular runs the AI model **on the therapist's own computer.** Private is the default: no cloud, no fallback. What you'll see today runs on Gemma 4 on this laptop.
>
> But there's a catch. Every clinician writes notes differently. Until today, if a therapist wanted Scribular to write *their* way, they emailed our founder, who wrote a prompt, tested it, and sent back a PDF to paste in. Every change meant another email."

### 1:15–1:30 · What we built

> "So today we built the **Note-Style Coach**: a tool clinicians use to customize their own clinical notes. No developer, no email thread, no cloud. Let me show you."

Start on **New template**.

### 1:30–2:00 · Saved templates, then write a note

- Point at the sidebar: **Saved note templates** (Narrative, SOAP, DAP are preloaded).
- Click **✎ Write session note**, choose a transcript from the dated list, pick a **Note template**, and click **Write note** (~5 s).
  > "After a session, the therapist picks the transcript and their template, and gets a note in their own style, generated on this laptop."

### 2:00–2:45 · Build a new template from one example

- Click **+ New template**, choose **or use a sample… → Brief CBT note**, name it `CBT brief`, and click **Build** (~5–10 s).
  > "Paste one note you like and click Build. The AI on this laptop learns the style, practices, checks itself, and writes a sample note."

### 2:45–3:45 · Chat to adjust, then Save

- In the chat, type `Keep each section to two sentences.` and press Enter. It answers with the exact change (max sentences 3 → 2). Click **Apply** (~5 s) to see before and after.
  > "They just say what they want. It shows the change first, and nothing is used until they save."
- Optional: type `Add a section called Risk` → **Apply**.
- Click **Save**. The template joins **Saved note templates**.

**Avoid typing "leave out Next Actions…".** The chat can't change that rule yet and will say it can't make that change.

### 4:00–4:45 · Why this wins (rubric in plain words)

> "So: it **works end to end today**, on a laptop, with a real local model. A practice can **set it up from the README** with one command.
>
> It changes how a core part of a therapy practice runs: **notes in the clinician's own style, without a support ticket.** And it's private by default.
>
> What's new is the combination: a scribe that is **local, learns your style from one example, checks its own work, and never changes without your approval.**"

### 4:45–5:00 · Team and close

> "[Name] led [business/research], [Name] built the backend, [Name] built the interface, and [Name] [design/pitch]. *(Use the actual roles from TEAM.md.)*
>
> **Less admin, more time talking to patients.** Thank you."

---

## Prelim judging at dinner: 60-second table version

> "Therapists spend too much time writing notes for insurance. Scribular drafts them with an AI that runs on the therapist's own laptop, so sessions stay private by default. Today we built the piece that makes those notes sound like the therapist: show it one note you like, it learns the style, practices on a fictional session, and checks itself. You then tell it in plain English what to change and approve every update. *(Show the before/after preview.)* It runs end to end with Gemma 4 locally and sets up with one command."

---

## Demo video (2–3 minutes, required for submission)

1. **0:00–0:40** Title card or face-to-camera: "Less admin, more time talking to patients," then the problem and the local-AI solution (voice-over from the hook above).
2. **0:40–1:20** **New template**: sample note → **Next** → **Build template** → sample note with checks.
3. **1:20–1:35** **Save and activate**: the template appears under **Saved note templates**.
4. **1:35–2:00** **Write session note**: choose a session and the template → **Write note**.
5. **2:00–2:35** **Improve template**: "Keep each section to two sentences." → **Preview on a new session** → before/after → **Save and activate**.
6. **2:35–2:45** Closing line.

Record at 1080p with the browser at 125%. Trim the model waits if you like, but don't speed up or fake generation. Say it's real local inference.

---

## How each judging criterion is covered

| Criterion | What judges see | Say |
|---|---|---|
| Does it work | Full flow live, real Gemma 4 notes, nothing mocked | "Every note you saw was generated live on this laptop." |
| Ease of implementation | `./start-demo.sh`, README quick start, no code edits | "One command; it downloads the model and opens the app." |
| Impact on operations | Self-serve style changes replace the founder email/PDF loop | "Customizing notes used to need us. Now the clinician does it in minutes." Don't quote a minutes figure; it hasn't been measured. |
| Creativity | Local + style learned from one example + self-checks + approve/rollback | "Not a chatbot: a scribe that adapts to you and shows its work." |
| Teamwork | Distinct roles in TEAM.md, PR history from multiple contributors | Name each person's role on stage. **TEAM.md still needs design/pitch roles filled in.** |

---

## Q&A prep

- **"Is this HIPAA compliant?"** "We don't claim compliance. Running locally by default means session content isn't sent to a third-party AI service, which removes a big part of the risk. Compliance still needs a proper review."
- **"How do you know the notes are accurate?"** "The checks are automated: structure, exact quotes, who said each quote, names, and the omission rule. They catch formatting and attribution slips, not clinical judgment. That's why the clinician approves every template, and we don't claim clinical validation."
- **"Does it train on patient data?"** "No. It changes the written instructions, never the model's weights. And nothing changes without approval."
- **"Why not a better cloud model?"** "Privacy by default, plus it works offline. Gemma 4 runs on a 16 GB laptop and produced the notes you just saw."
- **"What hardware do clinicians need?"** "We tested on an Apple M5 with 16 GB. The model is a 6.6 GB one-time download."
- **"How much time does it save?"** "We haven't measured it yet. That's the next pilot: compare editing time before and after a clinician sets up their style."
- **"Business model?"** "Scribular is an existing local scribe. We're testing whether style coaching is included or offered as a customization tier; no pricing has been decided."
- **"Where's Claude in this?"** "We built it with Claude Code and Codex, and used Claude to review the code. At runtime the clinician's data only goes to the local model."
- **"What was built today vs. before?"** "Scribular and its founder-run prompt workflow existed before today. The Note-Style Coach (this app, its checks, versioning, and feedback loop) was built today."
