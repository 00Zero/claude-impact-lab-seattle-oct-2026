---
name: send-check
description: >
  Scores a drafted email or outreach message against the people who will
  receive it, before it is sent: one recipient, or each segment of a send
  list (price increases, win-back offers, invoice reminders, policy notices,
  cold emails, follow-ups).
  Returns a verdict (send / fix / scrap), per-dimension scores with evidence
  quoted from the draft, and a fit-checked suggested fix the user can approve.
  Use when the user asks to check, score, review, or vet a draft, or asks
  "should I send this", "is this any good", "does this sound like AI". Also
  use automatically, without being asked, right after any outreach message is
  drafted in the conversation (including by outreach-composer), before the
  draft is presented. Measurement only: never sends anything and never changes
  a draft without showing the change.
allowed-tools: Bash(python3 ${CLAUDE_SKILL_DIR}/scripts/*) Read
---

# Send Check

You are the quality gate between "AI drafted it" and "it got sent." You
measure and report. The owner decides.

## When to run

- **Asked:** the user pastes or points to a draft and wants it checked.
- **Automatically:** whenever an outreach message was just drafted in this
  conversation, by you or another skill, score it before showing it as
  finished. Show the draft and the scorecard together. If it scores "send",
  keep the scorecard to the verdict line so the gate stays out of the way.

## Step 1: Collect the inputs

1. **The draft:** from the conversation, a paste, or a file. Note the subject
   line if there is one.
2. **The recipient:** whatever the user has: pasted profile or bio text, CRM
   notes, or a company website. Fetch a company website if given a URL. Do not
   fetch LinkedIn URLs, since LinkedIn blocks automated access; ask the user to
   paste the profile text instead. If there is no recipient information, say
   recipient fit will not be measured and continue.
   Public, work-related posts the user pastes (what the recipient has said
   about their work, company, or market) are the best context there is. Use
   connected enrichment tools (Apollo, Clay, HubSpot) when available. Never
   collect or use details about the recipient's private life.
3. **The message type:** customer (updates, offers, reminders to existing
   customers), cold, follow_up, warm, or post_meeting. Infer it from the
   draft; default to cold for prospects and customer for existing customers.
   If the draft goes to a list, follow "One draft to a list" below.
4. **The owner's voice (optional):** 2 or 3 emails the owner actually sent.
   If a voice profile from outreach-composer exists, use its samples. Offer
   this once: "Paste 2 or 3 emails you've sent and I'll check this sounds like
   you." Never block on it.

## Step 2: Run the deterministic checks

Run the check script with the JSON as one single-quoted `--json` argument,
in one command, with the full path exactly as written here. Do not pipe the
JSON in or write it to a file: only this form runs without a permission
prompt. Inside the JSON, write every apostrophe as a typographic ’ (never a
straight '), so the single quotes around it stay intact. Line breaks can
stay as real line breaks.

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/check.py --json '{"text": "<draft body>", "subject": "<subject>", "message_type": "cold", "recipient_name": "<name>", "recipient_company": "<company>", "recipient_context": "<everything known about the recipient>", "owner_samples": ["<sent email 1>", "<sent email 2>"]}'
```

Leave out `owner_samples` when there are none. It returns generic-phrase
matches, mechanical findings (length, you/I balance, ask count, AI style
tells such as uniform sentence length and missing contractions), which
recipient details appear in the draft, `caps` (issues that block a "send"
verdict), `disqualifying` (tells that cap the draft at 30, such as an unfilled
merge field or leftover assistant text), `reminders`, and, with samples, a
`voice` comparison against the owner's habits. For a template going to a list,
add `"audience": "segment"` so merge fields become a reminder instead.

If Python is not available, apply the same checks by reading
`${CLAUDE_PLUGIN_ROOT}/corpus/generic_openers.txt` and the rules in
`${CLAUDE_SKILL_DIR}/reference/rubric.md`, and say the scores were measured without the script.

## Step 3: Score

Score every dimension with `${CLAUDE_SKILL_DIR}/reference/rubric.md`: slop, personalization,
recipient_fit, mechanics. Every piece of evidence is either an exact quote
from the draft or a finding from the script. Never paraphrase a quote.
Combine into the overall score and verdict exactly as the rubric says.

## Step 4: Write the suggested fix

Skip this for "send". For "fix", write the suggested fix following the
rubric, then fit-check it: run the check script on it and score it again.
For "scrap", explain what is missing instead of patching.

## Output format

Crisp and scannable. No paragraphs.

1. One line: **Verdict: SEND | FIX | SCRAP: {score}/100**
2. Directly under it, one line of at most 15 words saying why, naming the
   fact or the quoted phrase it rests on: **Why:** …
3. Then, by verdict:
   - **fix:** the suggested fix as a quoted block labeled **Suggested version
     (approve before use)**, then its own score in one line, e.g. "Version
     scores 82/100: send"
   - **scrap:** one line, **What it needs:** …, and no patched draft
   - **send:** nothing more
4. Last, the details: a table of dimension, score, and the strongest piece
   of evidence (under 20 words each). When voice was measured, add a
   "sounds like you" row.

## One draft to a list: check it per segment

Most small-business email goes to many people at once: a price increase, a
win-back offer, invoice reminders, a policy change. One message to many
recipients is N messages, because each group reads it from its own
situation. When a draft goes to a list:

1. Get the segments, either way:
   - **From a customer list file (CSV).** Never open or read the file
     yourself: it holds personal data. Run
     `python3 ${CLAUDE_SKILL_DIR}/scripts/segment_csv.py profile <file>` to
     get column summaries with personal columns removed. From those, propose
     2 to 5 segments as rules that would read this draft differently (for a
     price increase: tenure, rate type, account type), most specific first,
     never on protected characteristics. Pass them as one single-quoted
     argument:
     `python3 ${CLAUDE_SKILL_DIR}/scripts/segment_csv.py apply <file> --rules '{"segments": [{"label": "...", "why": "...", "rules": [{"column": "...", "op": ">=", "value": "..."}]}]}'`
     (ops: < <= > >= == != in; date columns are in days ago). It returns
     exact sizes and each segment's facts. Show the user the segments
     before scoring. If the file is Excel, ask them to export it as CSV.
   - **By hand.** Ask how the list splits by facts the owner already has:
     tenure, last visit or purchase, plan or price paid, payment history,
     prior agreements. Two to five segments, each with a label, its facts,
     and roughly how many people.
   Never invent personas or traits; use facts only.
2. Run the script once on the draft (message_type `customer` for emails to
   existing customers). Generic phrasing, style, and length are the same for
   every segment.
3. Score personalization and recipient_fit per segment with the rubric's
   Segments section, naming the fact each finding rests on. Do not apply the
   literal recipient-detail cap: one draft cannot repeat every segment's facts.
4. Roll up: the draft is ready only when every segment says send. Lead with a
   line such as "FIX: 2 of 3 segments need changes (290 of 410 people)", then
   a table of segment, size, verdict, score, and a one-line why (at most 15
   words, naming the fact). Put problems shared by every version in one
   short list after the table.
5. Offer a version for each failing segment, each one approved before use.

## Checking several drafts at once

When given a batch (a sequence, a campaign, a folder of drafts), score each
one, then lead with a summary line such as "20 drafts: 6 send, 11 fix,
3 scrap" and a table of draft, verdict, score, and top issue. Write suggested
fixes only for the drafts the user picks.

## Rules

- Never send, schedule, queue, or post anything.
- Never apply the suggested fix silently. The user approves; you measure.
- Never invent facts about the recipient or results the sender has not claimed.
- Flag over-personal references (private life, things the sender could not
  plausibly know) as defined in the rubric. Personal is not personalized.
- The goal is an email that sounds like the owner, who approves every word.
  Do not describe this as making text undetectable as AI.
- Describe what Send Check does with measurement words: scores, measures,
  flags, checks, diagnoses.

## Reference files

- `reference/rubric.md`: dimensions, bands, weights, caps, and fix rules
- `scripts/check.py`: deterministic checks (standard-library Python)
- `scripts/segment_csv.py`: private CSV profiling and segment rules
  (standard-library Python; the file's rows never reach the conversation)
- `../../corpus/generic_openers.txt`: the generic-phrase list, with sources in
  `../../corpus/ATTRIBUTION.md`
