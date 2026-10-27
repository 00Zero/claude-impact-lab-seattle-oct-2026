# Team Journey: The Note in Her Own Words

*A documentary-style log of one hackathon day: Claude Impact Lab, Seattle, Sunday, October 25, 2026.*

Times are Pacific and come from git commits and file timestamps. Where a moment wasn't recorded, we don't reconstruct it. No real patient data was used at any point; every transcript in this story is fictional.

---

## Cold open

A therapist finishes a session. The client leaves. Then the second shift starts: the note.

> "My wife became a therapist because she wanted to help people. But the paperwork gets in the way, and it's draining the love she has for her profession."
> — the opening line of our pitch

Scribular already drafts therapy notes on the clinician's own machine. But making those drafts sound like *her* meant emails, prompt rewrites, model tests, and a manual install by the founder. Every change went through the same loop again.

Today's question: **can a clinician shape her own local AI note style, without an IT department?**

## The cast

- **pi0neerpat:** Scribular founder. Brought the customer evidence and the custom-prompt workflow, and drew the line: note style only.
- **Quynh (flybynight):** shipped the first working local demo, the one-command start script, the session library, the landing page and pitch script, and the clinician UI redesign.
- **spaggy:** team member on the build channel. *(Off-git contributions to be added by the team.)*
- **The machines:** Gemma 4 running locally through Ollama. Codex and Claude CLI agents on a Mac VM for coding and independent review. A Raspberry Pi coordinator (Darby) in the middle, and a swarm of Claude Haiku agents in the writers' room.

*(The official team roster page requires a login, so this cast list comes from git authorship and the team chat. Edit as needed.)*

---

## Act I: Scope

**13:28: First commit.** `b197d12`: *Initialize note-style coach hackathon evidence and project scope.* The repo opens with research and boundaries before any code. Out of scope: another scribe, recorder, transcription engine, EHR integration, or clinical decision tool.

**13:40: Four screens on a whiteboard.** `a9579b1` locks the journey from the brainstorm:
1. Upload the documents you like.
2. Let the system refine a prompt on one fictional transcript.
3. **Template Control**: inspect, edit, version, roll back.
4. **Main Meeting**: a *different* fictional transcript, real local inference.

One idea gets cut on camera: a marketplace for shopping other clinicians' styles. "Continuous learning" is also defined plainly: approved revisions, not weight training.

**13:48:** `8df0ce8` puts implementation guidance into the repo for the agents. The humans set direction; the agents get a written brief.

## Act II: Two tracks, two minutes apart

**13:54:** A spike folder appears: `spikes/001-local-prompt-chat`. The test: can a small local model hold a useful conversation about style preferences?

**14:11:** `a34026d`: *WIP: checkpoint local Gemma4 conversational prompt spike.*

**14:16:** `5176c15`: a Claude reviewer goes through Codex's spike, and the findings get addressed and written down.

**14:18:** Two minutes later, on a different machine: `298e745`, Quynh: ***Add working local note-style coach demo on Gemma 4.***

> Documentary beat: two people take separate routes to the same idea, local Gemma 4 shaping notes, and land 120 seconds apart.

**14:33:** `183d684`: a one-command start script and setup steps, so a teammate can run the demo too.

**14:40:** `d91d254`: *Fix feedback that produced a template version with no real change.* The first real bug of the day. The app said it had learned something, and it hadn't. Catching that early matters for a product whose promise is "improvements you control."

## Act III: The 15:00 convergence

**14:51:** In the same minute, both founders and builders commit fictional transcripts: `965cd0b` (custom-prompt workflow samples) and `ca3e86a` (sample notes and couples-therapy transcripts). The test cast is now an all-fictional set of therapy sessions.

**15:00:** Three commits in one minute:
- `51e6443`: *Add confirmed local feedback patches and note-only retries.* The model can **propose** a style change, but nothing sticks until the clinician confirms it. "Redo this one note" is now separate from "change my style from now on." Vague feedback gets a clarifying question instead of a guess.
- `11f9b0e` / `9e678f2`: a session library built from the team's sample transcripts, plus a **quote-attribution check**.

**15:02 to 15:06:** `cdbc034` and `4fb93d0` merge it all together. Teammate work is preserved rather than overwritten.

**Verification, for the record:** 45 Python tests passing on the merged source; a full real HTTP end-to-end run and a conversational smoke test passing on `gemma-4-E2B-it` (Ollama 0.20.5, 8K context). The repo labels these as **single examples, not benchmarks**, with no clinician validation yet. That honesty is part of the story too.

**15:29:** `f807f4e`, Quynh: *Lead landing page with value proposition; add pitch script.* The app now opens with why it exists.

**15:43:** **Pull request #2 merges into `main`.** The local demo is officially the product.

## Act IV: Make it feel like a clinician's app

**16:24:** `836f37c`, Quynh: *Redesign UI as a clinician app with saved note templates.* It stops looking like a developer console and starts looking like a tool you'd open between sessions.

**16:57:** `b895748`: *Simplify template flow to example → Build → chat → Save; preload three templates.* Four verbs. That's the whole onboarding.

## Act V: The writers' room

Meanwhile, the pitch is being written in public.

- Three Claude agents drafted competing versions of the script. The emotion-led one won.
- Then a **Haiku swarm** of four agents each took an angle: the personal story, the small business with no IT person, clinician control ("Show me the change before it sticks"), and the hackathon contribution itself. The team kept three value props: **private and local**, **customizable without technical help**, **the clinician stays in control**.
- The final script was trimmed to exactly **200 words.**

**16:44 to 16:53: The deck, in nine minutes of machine time.**
- 16:44: the source survey PDF is pulled in. SBE Council, *Small Business Technology Use Survey*, March 2026; base of 425 AI-tool users.
- 16:47: Codex builds five slides with the original script in the speaker notes.
- **16:51: An independent Claude review returns FAIL.** It flagged an unverified survey denominator, overlapping text, small fonts, low-contrast text, and bar charts that overstated the data.
- 16:53: Codex polish pass. *All validations PASSED!*

> Documentary beat: the review also caught a claim. The script said privacy was the **#1** concern, and the survey didn't support that ranking. The deck now says "a major concern." The savings figures on the closing slide are labeled illustrative because nothing measured them yet.

## Epilogue: The meter runs out

**~16:55:** Mid-task, the coding agent's subscription hits its usage limit. It resets in three hours.

The day's workflow (plan, delegate, review, verify) depended on a metered cloud tool. The product being built depends on none: every note in the demo was generated on local hardware, with no cloud fallback.

---

## By the numbers

- **4** screens in the product flow, one of them cut down to **4** verbs
- **20** commits across the day's branches, **1** merged PR into `main`
- **45** Python tests passing on the merged backend
- **2** independent AI code/design reviews that returned real findings, both addressed
- **4** Haiku agents in the pitch swarm; **200** words in the final script
- **5** slides; **9** minutes from survey download to a validated deck
- **0** real patient transcripts. **0** cloud model calls in the demo.

## What's honestly not done

- No clinician has validated the outputs yet.
- Time savings are a goal, not a measurement.
- Not yet integrated into the Scribular desktop apps.
- Team roles beyond git authorship still need to be filled in by the team (see [TEAM.md](TEAM.md)).
