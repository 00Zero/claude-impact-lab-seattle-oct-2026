# Send Check scoring rubric

The single source of scoring rules. The skill reads this file; the web
backend's judge loads the same file, so both measure the same way.

Every score is an integer from 0 to 100. Score against the bands below, not
against a feeling. The same draft and recipient should get the same score
every time, so when a draft sits between two bands, pick the lower one.

## Dimensions

### slop (weight 25): how distinguishable is this from template outreach?

Take `slop.score` from `scripts/check.py` as the score. Then deduct the
points of any mechanical findings named `em_dash`, `uniform_paragraphs`,
`three_bullets`, `uniform_sentences`, or `no_contractions`, since those are
style tells too.

**Voice match (only when the owner supplied emails they actually sent).**
Start from `voice.score` and adjust for word choice the script cannot see:
phrases the owner never uses, a register more formal or casual than theirs,
how they phrase an ask. Then the slop score becomes
`round(0.5 * slop + 0.5 * voice)`. Evidence: each item in
`voice.differences`, plus any quoted word-choice mismatch. Without samples,
skip this and say voice was not measured.

Evidence: quote each matched phrase exactly as it appears in the draft,
strongest first. If the script could not run, find the phrases by reading
`corpus/generic_openers.txt` (at the plugin root) and apply the same weights:
15 points per phrase of 3+ words, 8 per 2-word phrase, 4 per single word.

### personalization (weight 30): does it show real knowledge of the recipient?

| Band | What it looks like |
|---|---|
| 90–100 | Could only have been sent to this person. Uses a specific, checkable detail from the recipient context and ties it to why the sender is writing |
| 60–89 | Uses a real detail, but the link to the reason for writing is loose |
| 30–59 | Only merge fields (name, company, title) or vague category fit ("businesses like yours") |
| 0–29 | Nothing specific, or a fake-warm opener: flattery, "I've been following your work", an invented connection |

For a single recipient (not a segment): if `recipient_terms_found` is empty
and recipient context was given, the score is at most 40. Evidence: quote the line that carries the detail, or the
line where a detail should have been.

**Over-personalization.** Personal is not the same as personalized. Flag any
reference to the recipient's private life (family, health, home, personal
social accounts, travel, religion, politics) or to anything the sender could
not plausibly know from public, work-related sources. The test: could the
sender say to the recipient's face how they knew it, without it being
awkward? If not, personalization is at most 40 and the draft is capped (no
"send"). Evidence: quote the line and name what makes it intrusive.

### recipient_fit (weight 30): does the message match what this person responds to?

Judge the offer, the tone, and the ask against the recipient's role,
seniority, and stated priorities.

| Band | What it looks like |
|---|---|
| 90–100 | The offer maps to a priority visible in the context; tone matches their seniority and style; the ask is sized for them |
| 60–89 | Relevant offer, but tone or ask is off (too formal, too casual, too big an ask for a first touch) |
| 30–59 | A generic offer that would fit anyone in the category |
| 0–29 | Mismatched: wrong role, irrelevant offer, or a tone this person would find off-putting |

With no recipient information at all, score 50 and say in the evidence that
recipient fit was not measured.

### mechanics (weight 15): length, balance, and the ask

Start at 100 and deduct the points of every mechanical finding except
`personalization`, `em_dash`, `uniform_paragraphs`, and `three_bullets`
(those are counted above). Evidence: each finding's `detail`.

## Disqualifying tells

From the team's humanization rubric (`docs/humanization-rubric.md`, Part 4;
IDs match it). Each one shows nobody checked the message, or that a claim of
personal knowledge is false or empty. Any disqualifying tell caps the overall
score at 30 (scrap), whatever else the draft does well. Quote the exact span.

**Measured by the script** (`disqualifying` in its output):
- B9: an unfilled merge field (`{FirstName}`, `[Company]`) in an email to one
  person, or a greeting with the name missing ("Hi ,"). In a template sent to
  a list, merge fields are expected and only produce a reminder.
- P20a: leftover assistant text ("Certainly! Here's a draft", "I hope this
  helps!", "Would you like me to adjust the tone?").
- P21: an AI cutoff disclaimer ("As of my last update").
- B8: "Re:" or "Fwd:" on the subject of a first message.
- B16: markdown symbols (`**bold**`, `## heading`, backticks) in plain-text email.

**Judged** (single recipient only, never for segments):
- B11: unanchored flattery ("doing great things", "impressive growth") as the
  only personalization in cold outreach.
- B12: an "I noticed / I saw" claim in cold outreach that names no date,
  document, post, event, or number.
- B24: zero anchors in the body of a cold or client message. An anchor is a
  number, a date or time, a named person (not in the greeting or sign-off), a
  named artifact (order, ticket, file, post, invoice, job listing), or a named
  place or event; the sender's own product name doesn't count.
- B25: no body sentence passes the portability test: every sentence could be
  sent unchanged by a competitor.

Quoted text, signatures, and mandated wording (legal footers, opt-out lines)
never count. When you can't decide whether an instance meets a definition, it
doesn't count.

## Pass lines by stakes

The humanization rubric sets a higher bar for cold outreach than for client
mail. Send Check applies it on top of the verdict thresholds:

| Stakes | Message types | To get "send" | Template-tell allowance |
|---|---|---|---|
| Cold and public | cold, follow_up | overall 82 or higher (23 of 28) | at most 1 |
| Client | customer, warm, post_meeting | overall 75 or higher (21 of 28) | at most 2 |

A template tell here is a multi-word stock phrase from the phrase list (an
opener, a wind-up, a stock closer) or an AI structure tell (uniform paragraphs
or sentences, a three-bullet list). Going over the allowance, or under the cold
pass line, caps the overall at 74 (fix).

## Segments: one message to many recipients

A draft sent to a list is N messages: each group on the list reads it from
its own situation. When the recipient is a segment (a group that shares
observable facts, such as "10-year tenants", "lapsed 14 months", or
"negotiated their rate last year"), score it like this:

- **Facts, not personas.** Judge only against the segment's stated facts:
  tenure, plan or price tier, purchase or service history, days overdue,
  engagement recency, prior agreements. Never invent personality traits,
  feelings, or demographics.
- **Name the fact.** Every finding says which fact it rests on, e.g.
  "tenure 10 years: the draft gives a 10-year tenant the same boilerplate as
  a 3-month renter."
- **Use these bands for segments**, not the single-recipient bands above.
  The question is whether the draft gets this group's situation right, not
  whether it names them.

  | Band | personalization | recipient_fit |
  |---|---|---|
  | 85–100 | Gets this group's situation right, including when the message applies to everyone the same way and nothing about this group changes it | Offer, framing, and stakes fit this group |
  | 60–84 | Right overall, but leaves out one thing this group would want to know | A minor tone or ask issue for this group |
  | 30–59 | Assumes a situation this group is not in, or leaves out something that changes the message for them | The wrong strength of offer or framing for this group; a fee or rule stated to people it may not apply to |
  | 0–29 | Contradicts their facts | Mismatched: contradicts a prior agreement, claims a relationship that never existed, or would push this group away |

- Common misses: an offer too weak for how cold the relationship is; false
  intimacy ("we've missed you") with people who were never regulars;
  wording that contradicts a prior agreement; cost-based justification
  ("our costs went up") to loyal customers; one fee or rule applied to
  people it cannot fit.
- **These are real misses, always flag them:** cost-based justification
  ("our costs went up", "we can no longer absorb"), which a 2026 field
  experiment found does no better than silence; no word on what the reader
  gets or what stays the same when something gets worse for them; missing
  practical details that this group's facts make necessary (billing changes
  for invoiced business accounts, whether a fee applies to people on hold or
  on a different kind of plan); ignoring how long they waited or how long
  they have been customers.
- **Problems in the draft itself still count for every group:** empty
  urgency or scarcity ("spots are limited" with no number), a sign-off that
  does not match who is sending (a department name from a three-person
  shop), claims of severity out of proportion to what happened, a pitch
  framed as the reader's benefit that is really the sender's, and an offer
  with no limits stated where people will ask.
- **Sometimes the fix is not to send it to this group.** When a group
  should not get this message at all (people it does not concern, people in
  a dispute or negotiation, contacts who should not be on the list), say so,
  score recipient_fit in the mismatched band, and make the suggested fix
  start with "Do not send to this group:" and the reason, followed by what
  to send them instead, if anything.
- **Do not cry wolf.** Beyond those, deduct only for problems grounded in
  this group's facts. Gaps that apply to every group equally (no greeting,
  no how-to steps) are about the draft, not the group: mention them as
  suggestions and deduct at most 10 points. A group whose facts raise no
  special issue lands in the 75–100 band. Pure wording preferences (not
  saying "you", a slightly formal tone) are suggestions, not deductions. When the draft already fits
  a segment, score it high and say so. Uniform wording is right when the
  situation is uniform.
- **The suggested fix** is the version of the draft for this segment. Keep
  everything that already works and change only what this segment's facts
  require.

## Overall score and verdict

```
overall = round(0.25 * slop + 0.30 * personalization + 0.30 * recipient_fit + 0.15 * mechanics)
```

If `caps` from the script is not empty, or the draft is over-personalized,
overall is at most 74: a capped draft cannot get "send" until the capped
issue is fixed.

If recipient_fit is below 30 (the "mismatched" band), overall is at most 44:
a draft that is wrong for its reader is a scrap, however clean its style.

Verdict, matching `verdict_from_score()` in `scorers/base.py`:

| Overall | Verdict |
|---|---|
| 75–100 | send |
| 45–74 | fix |
| 0–44 | scrap |

## The suggested fix

- Keep the owner's voice, facts, and offer. Change only what the evidence flagged.
  When owner samples were given, match their measured habits: sentence
  length, contractions, greeting, sign-off, and how they phrase an ask.
- Mix sentence lengths and use contractions where the owner would.
- Use only public, work-related details about the recipient. Remove any
  over-personal reference rather than softening it.
- Never invent facts: no made-up results, customers, mutual connections, or
  details about the recipient. When a fix needs a detail only the owner knows,
  leave a bracketed placeholder such as `[the project of theirs you liked]`.
- Stay under the length ceiling, with exactly one small ask.
- Fit-check it: run `scripts/check.py` on the fix and score it with this same
  rubric. A suggested fix must reach "send" with no caps. If it cannot without
  a fact the owner has to supply, say so instead of padding it.
- For a "scrap" verdict, do not patch the draft. Say what it would need (a
  real reason to write to this person) and offer to help find one.
