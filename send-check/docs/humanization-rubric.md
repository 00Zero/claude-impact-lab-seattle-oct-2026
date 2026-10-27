# Humanization rubric for outbound business messages

This is a 7-dimension, 28-point rubric you can apply to a draft today. It works for email first and also covers SMS, LinkedIn and web copy. It counts named tells against thresholds, gives credit for specific evidence that a real person wrote to a real recipient, and caps any draft that contains a disqualifying tell.

## TL;DR

- Score each of seven dimensions from 0 to 4: word choice, constructions, formatting, structure and rhythm, specificity, voice, and recipient fit. Any disqualifying tell caps the total at 12, which is below every pass line. That covers unfilled merge fields, leftover chatbot text, a fake "Re:", personalization that cites nothing checkable, and a client or cold email with no concrete anchor.
- Pass lines depend on stakes. An internal note needs 16 of 28. A client deliverable needs 21 with specificity and recipient fit at 3 or higher. Cold outreach and public copy need 23 with no dimension below 3 and at most one credibility-eroding tell.
- Single instances rarely count. One em dash, one "enhance" or one triad in a short email costs nothing. A tell counts once it passes a frequency threshold, clusters with other tells in a paragraph, or sits where it does real damage, such as an emoji in a subject line. Graders must quote the exact span behind every deduction. Published human baselines (Pangram, Wikipedia's AI Cleanup editors) show competent writers use all of these devices at lower rates.\[1\]

Detection taxonomy adapted from `unslop` in the `pstack` plugin of [cursor/plugins](https://github.com/cursor/plugins/tree/main/pstack) (MIT).\[4\] See "How this rubric relates to unslop" in Part 8 for how this differs from the backnotprop mirror.

---

## Part 1. Quick reference

### The seven dimensions

| # | Dimension | What it measures | Scored by |
|---|---|---|---|
| D1 | Word choice | Stock vocabulary, puffery, promotional words, filler, fancy synonyms | Count of word-level tells |
| D2 | Constructions | Rhetorical templates such as "not just X but Y", forced triads, false ranges, vague attributions, generic conclusions | Count of template instances |
| D3 | Formatting and punctuation | Em dashes, bold, inline headers, emoji, title case, literal markdown | Tells over threshold, weighted by tier |
| D4 | Structure and rhythm | Sentence-length spread, paragraph uniformity, restating summaries, bullets where prose belongs, template scaffolds | Pass/fail on eight checks |
| D5 | Specificity | Concrete anchors, checkable or shared referents, the swap and portability tests, fake personalization | Anchor and sentence counts |
| D6 | Voice | Opinion, acknowledged tradeoffs, first person, active voice, calibrated affect, no sycophancy | Pass/fail on six checks |
| D7 | Recipient fit | Email-native clichés, chatbot artifacts, apology openers, subject-line honesty, register match, a clear ask, length | Pass/fail on seven checks |

### Severity tiers

| Tier | Definition | Effect | Examples |
|---|---|---|---|
| Cosmetic | A habit competent humans share at similar rates | Lowers a dimension only past its threshold, and never fails a draft on its own | Curly quotes, one colon used as a connector, "in order to", Title Case headings, one "Let me know if you have any questions" |
| Credibility-eroding | Makes a reader suspect a template or a machine | Lowers the dimension and counts against the tier's allowance | "I hope this email finds you well", "I wanted to reach out", puffery, a 🚀 in the subject line, an inline-header list, uniform paragraphs, a restating summary |
| Disqualifying | Shows nobody checked the message, or that a claim of personal knowledge is false or empty | Sets the dimension to 0 and caps the total at 12 | `{FirstName}`, "Certainly! Here's a draft", "As of my last update", a fake "Re:", "I noticed {Company} is doing great things", a client or cold email with zero anchors |

### Pass thresholds by stakes

| Stakes tier | Typical messages | Minimum total | Dimension floors | Tell allowance |
|---|---|---|---|---|
| Internal note | Email or chat to a colleague, team update, handoff | 16 | No dimension at 0 | No disqualifying tells. B24 and B25 are only credibility-eroding at this tier. Up to 4 credibility-eroding tells. |
| Client deliverable | Project update, proposal cover note, support reply, invoice or renewal note | 21 | D5 and D7 at 3 or higher, all others at 2 or higher | No disqualifying tells, up to 2 credibility-eroding |
| Cold outreach and public copy | First-touch email, LinkedIn DM to a stranger, launch email, landing page | 23 | Every dimension at 3 or higher | No disqualifying tells, at most 1 credibility-eroding |

### Counting rules in one place

1. Quote the exact span for every deduction. If you can't quote it, you can't deduct it.
2. When you can't decide whether an instance meets a definition, it doesn't count.
3. Tally each phrase once, under the dimension where its ID is listed.
4. A cluster is three or more distinct tallied tells in one paragraph. Each cluster adds one credibility-eroding instance. Curly quotes never count toward a cluster.
5. Noise floor. In a message of 150 words or more, a single cosmetic tell with no other tells present costs nothing.
6. Before scoring, strip the signature block, legal footer, quoted thread, mandated disclosures (such as "Reply STOP to opt out") and any text quoted from someone else.

---

## Part 2. How to grade

Human reviewers and LLM judges follow the same steps in the same order.

### Step 0. Record the context

Write down four things before reading for tells:

- Channel: email, SMS, LinkedIn DM, LinkedIn post or web page.
- Stakes tier: internal, client or cold/public.
- Relationship: cold, new client, or existing client or colleague.
- Facts supplied: prior thread, CRM notes, call notes, order history, or none.

If no facts are supplied, judge the shared-referent and register checks on the text alone. A claimed shared referent counts if it is precise enough to check, meaning it names a date, a document, an order, a person or an event. Mark it "unverified". If facts are supplied and the referent contradicts them, that is disqualifying tell B9.

### Step 1. Sweep for disqualifiers

Check the disqualifying rows of the tell inventory in Part 4 first. If one fires, record it, set its dimension to 0 and keep scoring. The cap applies at the end.

### Step 2. Tally

Go through the body paragraph by paragraph. For each tell, log its ID, tier, exact quoted span, dimension and paragraph number. Then mark clusters.

### Step 3. Measure

Count words per sentence for D4. The body runs from after the greeting to before the sign-off. A sentence ends at `.`, `?` or `!`, or at the end of a list item. Numbers, hyphenated words and URLs each count as one word. Then count anchors and recipient-specific sentences for D5.

### Step 4. Score each dimension

Use the anchor tables in Part 3. Each score needs a one-line reason that cites the counts.

### Step 5. Apply the cap and the tier

If any disqualifying tell fired, final total = min(raw total, 12). Then compare the result with the tier's minimum total, dimension floors and tell allowance. The draft passes only if all three hold. Report each dimension score with its reason, the raw and final totals, and PASS or FAIL against the named tier.

---

## Part 3. Dimension criteria and anchors

### D1. Word choice

Definition. Words and short phrases that stand in for content. They include the AI-vocabulary list, puffery, promotional adjectives, fancy substitutes for "is", filler, hedge stacks, abstract metaphor nouns, propping adverbs and trailing "-ing" significance clauses.

What the grader looks for. Instances of P1, P3, P4, P7, P8, P23, P24, P26, P30, P31 and B15 from the inventory, with the exemptions in Part 5 applied. For messages over 400 words, use the per-100-word column.

| Score | Count (under 400 words) | Rate (over 400 words) | Example |
|---|---|---|---|
| 4 | 0 tells, or 1 in a message of 150+ words | 0.5 or fewer per 100 words | "We moved your install to Thursday because the crane is booked Wednesday." |
| 3 | 1 to 2 tells, never two in one sentence, no puffery or promotional phrase | 1 or fewer per 100 | "We added a second check in order to catch duplicate invoices." (one filler phrase) |
| 2 | 3 to 4 tells, or any one puffery or promotional phrase | 2 or fewer per 100 | "This partnership marks a pivotal moment for both teams." (puffery) |
| 1 | 5 to 7 tells, or two tells sharing a sentence more than once | 3 or fewer per 100 | "We leverage robust, cutting-edge tooling to streamline and enhance your workflows." (five tells) |
| 0 | 8 or more, or a paragraph where every sentence carries a tell | More than 3 per 100 | "In today's evolving landscape, our innovative platform serves as a testament to our commitment, empowering teams to seamlessly unlock transformative value." |

### D2. Constructions

Definition. Sentence-level templates that make a claim sound bigger or more complete than the facts support.

What the grader looks for. P2, P5, P6, P9, P10, P11, P12, P25 and U32. A triad counts only when its items are abstract or adjectival, not when the real count is three (three dates offered, three products ordered). A range counts only when its two ends don't sit on one scale.

| Score | Count | Example |
|---|---|---|
| 4 | 0 | "We cut the price because the old tier confused people." |
| 3 | 1 | "It's not just a price change, it's a simpler plan." |
| 2 | 2 | "From startups to global brands, teams trust us. Fast, simple, and secure." |
| 1 | 3 to 4 | The line above, plus "Experts agree this is the future" and "The future looks bright." |
| 0 | 5 or more, or the message's main claim rests on a template | A launch paragraph made entirely of "isn't just... it's", a benefit triad, "whether you're X or Y" and a closing "the future is here" |

### D3. Formatting and punctuation

Definition. Visual and typographic habits that look machine-made at the frequencies LLMs produce them.

What the grader looks for. P13 to P19, B6, B16 and B17, judged against the thresholds in Part 5. Below threshold, nothing is tallied.

| Score | Rule | Example |
|---|---|---|
| 4 | Nothing over threshold | A plain-text email with one em dash and sentence-case headings |
| 3 | One cosmetic tell | One colon used as a connector, or Title Case headings in a one-pager |
| 2 | One credibility-eroding tell, or 2 to 3 cosmetic | Subject "🚀 New features inside", or three bold phrases in a 120-word email |
| 1 | Two credibility-eroding tells, or one plus 2 or more cosmetic | An inline-header list plus three em dashes in 150 words |
| 0 | A disqualifying tell, or 3 or more credibility-eroding | Literal `**Next steps:**` showing in a plain-text email |

### D4. Structure and rhythm

Definition. Shape-level fingerprints, meaning the evenness of sentences and paragraphs and the reflex to summarize, list and scaffold.

What the grader looks for. The eight checks below. Mark any check that can't apply as "n/a". Checks a and b need 5 or more body sentences, check c needs 3 or more body paragraphs, and check h needs 80 or more body words.

| Check | Passes when |
|---|---|
| a. Spread | The longest body sentence is at least 10 words longer than the shortest |
| b. No flat run | No 4 or more consecutive sentences have lengths within 4 words of each other |
| c. Uneven paragraphs | Not all body paragraphs have the same sentence count with word counts within 20% of their mean |
| d. No restating summary | The last body paragraph doesn't repeat two or more earlier points without adding a new fact, date or ask (B18) |
| e. One idea per sentence | No sentence runs over 35 words |
| f. Lists earn their place | Bullets hold only discrete, parallel items the reader will act on or choose among, such as steps, dates, options or line items (B21) |
| g. No template scaffold | The body isn't organized under generic labels such as Progress, Challenges, Next Steps, Key Takeaways or Summary (B22) |
| h. Some irregularity | At least one fragment, one-sentence paragraph, sentence of 5 words or fewer, or sentence opening with And, But or So |

| Score | Rule | Example |
|---|---|---|
| 4 | Every applicable check passes | Sentence lengths 19, 19, 13, 19, 9, 20, 3, 20 across paragraphs of 2, 4 and 2 sentences |
| 3 | One check fails | A good update that ends "Overall, we're on track and the homepage is done" after both were already said |
| 2 | Two checks fail | Four paragraphs of exactly two sentences, about 26 words each, with a run of lengths 15, 13, 14, 12 |
| 1 | Three checks fail | The above, plus a bullet list of abstract benefits |
| 0 | Four or more fail | Uniform two-sentence paragraphs, flat lengths, a Progress/Challenges/Next Steps scaffold, benefit bullets and a closing recap |

### D5. Specificity

Definition. Evidence that this sender wrote to this recipient about this situation.

Terms.
- An anchor is a number, a date or time, a named person (other than in the greeting and sign-off), a named artifact (order, ticket, file, post, invoice, job listing), or a named place or event. The sender's own product name and version don't count.
- A shared referent is an anchor from the sender's and recipient's history together, such as the last order, the last call or the thing that broke.
- A checkable referent is a public anchor the recipient can verify, such as their dated job post, a quote from their podcast with the episode, or their pricing page change. Cold outreach uses these.
- Swap test. A sentence passes if it would be false sent to a different recipient in the same segment.
- Portability test. A sentence passes if it would be false sent by a competitor.
- Merge-depth personalization uses only name, company, title, industry or location. Delete those words, and if the sentence is still true of anyone in the segment, it is merge-depth.

| Score | Rule | Example |
|---|---|---|
| 4 | At least 3 anchors, at least one shared or checkable referent named precisely, at least half of body sentences pass the portability test, no merge-depth personalization | "You asked on Tuesday's call whether the old blog URLs keep working. They will. We're adding redirects for all 640." |
| 3 | At least 2 anchors, at least one sentence passes the swap test, at least one passes the portability test | "Since your team moved returns to the Denver warehouse in June, the old routing rules probably broke." |
| 2 | Anchors exist but all describe the sender, or recipient detail is merge-depth only | "Corvana cut scorecard time from six hours to one for a Reno freight broker." |
| 1 | One anchor, nothing recipient-specific, most sentences portable | "We've helped 200 teams save time every week." |
| 0 | No anchors in the body, or fake personalization (B11, B12) | "I noticed Brightline is doing great things in your space." |

### D6. Voice

Definition. Signs a person with a view wrote the message. This is the observable form of unslop's "adding soul" section.\[2\]

| Check | Passes when |
|---|---|
| a. Opinion | At least one sentence states the writer's own judgment, preference or recommendation, such as "I'd pick B", "I think March is too tight" or "this part annoys me" |
| b. Acknowledged complexity | At least one sentence names a specific cost, limit, tradeoff or open risk tied to a concrete object, such as "it's cheaper but adds a week". A bare hedge doesn't count. |
| c. First person | At least one "I" sentence where the writer did or thinks something specific. Brand pages and team-signed copy are exempt. Copy signed by one named person is not. |
| d. Active voice | At most one agentless passive where the hidden actor is the sender, such as "mistakes were made" or "your order was delayed" |
| e. Calibrated affect | At most one enthusiasm word (thrilled, excited, delighted, can't wait, love to, amazing, incredible), and none attached to a routine event like an invoice, a status update or a meeting |
| f. No sycophancy | No praise of the recipient's question, idea or company without stating what is good about it (P22) |

| Score | Checks passed | Example |
|---|---|---|
| 4 | All 6 | "I'd rather move launch to the 19th than ship a half-checked blog." |
| 3 | 5 | A strong announcement signed by a named product lead that never uses "I" |
| 2 | 4 | A factual update with no stated opinion and one "we're excited" |
| 1 | 2 to 3 | "We're thrilled to share some exciting progress! Great question, by the way." |
| 0 | 0 to 1 | Neutral pros-and-cons listing, enthusiasm on everything, praise of the recipient, no "I" |

Check d is a clarity rule, not an AI tell (see Part 8). Check e exists because enthusiasm as the default affect is the uniform tone this rubric tries to catch.

### D7. Recipient fit

Definition. Whether the message fits this relationship and this channel, or reads like the same voice sent to everyone.

| Check | Passes when |
|---|---|
| a. No email-native clichés | None of B1 to B4, and no more than one B5 closer |
| b. No assistant artifacts | No P20 assistant phrases and no P21 disclaimers (both disqualifying) |
| c. No apology-shaped opening | No apology or self-minimizing opener without a named fault (B13) |
| d. Honest, specific subject | No B6 decoration, no B7 "quick question" without a question in the body, no B8 fake "Re:" or "Fwd:". The subject names the topic or the ask. |
| e. Register matches relationship | Existing relationships cite at least one shared referent. Cold messages claim no false familiarity, such as "as we discussed" or "great catching up". |
| f. One clear ask | Exactly one request with a specific action, and a time where timing matters, or an explicit "nothing needed from you" |
| g. Length fits channel | Cold first-touch email body of 125 words or fewer. SMS in one segment where possible. See Part 7 for the other channels. |

| Score | Rule | Example |
|---|---|---|
| 4 | All 7 pass | Subject "your Oct 14 carrier scorecard post", one ask with a Friday date, 122-word body |
| 3 | One fails | Everything right, but it closes with "Looking forward to hearing from you" and "Let me know if you have any questions" (two B5 closers) |
| 2 | Two fail | "I hope this email finds you well" opener, and no clear ask |
| 1 | Three fail | The above, plus a "Quick question" subject on an email with no question |
| 0 | Four or more fail, or any disqualifying tell | A fake "Re:" subject on a first touch |

---

## Part 4. Tell inventory and severity

P1 to P31 follow unslop's numbering. U32 and U33 come from the upstream cursor/plugins version of unslop.\[4\] B1 to B25 are business-messaging extensions. "Counts when" gives the trigger. Below it, the instance isn't tallied.

### Content and language (pstack-derived)

| ID | Tell | Dim | Tier | Counts when, and fix |
|---|---|---|---|---|
| P1 | Puffery: "pivotal moment", "testament to", "evolving landscape", "setting the stage for", "indelible mark", "deeply rooted" | D1 | Credibility | Any instance. State what happened. |
| P2 | Name-dropping without content: client logos or outlets listed with no statement of what happened | D2 | Credibility | A list of two or more names with no result attached. Pick one and say what it did. |
| P3 | Superficial "-ing" tail: "..., ensuring a seamless experience", "highlighting our commitment" | D1 | Cosmetic, credibility at 2 or more | The clause asserts significance. Exempt if it carries a fact ("..., cutting the run from six hours to one"). |
| P4 | Promotional words: nestled, vibrant, breathtaking, groundbreaking, renowned, stunning, must-visit, world-class, best-in-class | D1 | Credibility | Any instance outside a quote. Describe neutrally. |
| P5 | Vague attribution: "experts believe", "industry reports suggest", "some critics argue", "studies show" | D2 | Credibility | No named source. Name it or delete. |
| P6 | Formulaic challenges: "despite challenges, X continues to thrive" | D2 | Credibility | The challenge or the outcome is unnamed. Replace with the fact. |
| P7 | AI vocabulary (list below) | D1 | Cosmetic at 1 to 2; credibility at 3 or more distinct, or 2 in one paragraph | Literal or technical senses are exempt (Part 5). |
| P8 | Fancy "is": serves as, stands as, boasts, features (as a verb) | D1 | Cosmetic | Say "is" or "has". |
| P9 | "Not just X, but Y" / "isn't X, it's Y" | D2 | Cosmetic at 1, credibility at 2 or more | State the point. |
| P10 | Forced triad | D2 | Cosmetic at 1, credibility at 2 or more | Items are abstract nouns or adjectives. A true count of three is exempt. |
| P11 | Synonym cycling: client, partner, customer, account for the same party | D2 | Cosmetic | Three or more terms for one referent. Pick one. |
| P12 | False range: "from X to Y" with no shared scale | D2 | Cosmetic | List the items. |
| P23 | Filler: "in order to", "due to the fact that", "it is important to note that" | D1 | Cosmetic | Cut it. |
| P24 | Hedge stack: "could potentially possibly" | D1 | Cosmetic | Two or more hedges in one clause. Use "may". |
| P25 | Generic conclusion: "the future looks bright", "exciting times ahead" | D2 | Credibility | No plan, date or fact attached. |
| P26 | Abstract metaphor nouns: substrate, wedge, vector, nexus, north star, flywheel, paradigm, bedrock, journey, ecosystem (abstract), scaffolding, endgame | D1 | Cosmetic, credibility at 2 or more | Use the concrete word. |
| P30 | Propping adverb or unmeasured claim: "significantly improves", "remarkable results" | D1 | Cosmetic | No number nearby. Give the delta or cut it. |
| P31 | Fancy synonym: utilize, leverage, facilitate, numerous, in the event that | D1 | Cosmetic | Use, use, help, many, if. |
| B15 | Announcement clichés: "We're thrilled/excited to announce", "Introducing...", "game-changer", "In today's fast-paced world", "Ready to get started?" | D1 | Credibility | Any instance. Lead with what changed. |

AI vocabulary list for P7. It merges unslop rule 7, Wikipedia's "AI vocabulary" list and style words with large post-2022 excess in Kobak et al. (2025): additionally, align with, crucial, delve, elevate, embark, empower, enduring, enhance, foster, garner, highlight (verb), interplay, intricate, key (adjective), landscape (abstract), leverage, meticulous, multifaceted, notably, nuanced, pivotal, realm, robust, seamless, showcase, streamline, tapestry, testament, transformative, underscore, unlock, unparalleled, vibrant, vital.\[2\]\[4\]\[5\]\[6\]

### Style and formatting (pstack-derived plus extensions)

| ID | Tell | Dim | Tier | Counts when |
|---|---|---|---|---|
| P13 | Em dash overuse | D3 | Cosmetic at threshold, credibility at twice the threshold | Thresholds in Part 5. Spaced hyphens and en dashes used as dashes count. So do parenthetical asides doing the same job. |
| P14 | Colon as a mid-sentence connector | D3 | Cosmetic | Not before a list or example. Subject-line separators are exempt. |
| P15 | Boldface overuse | D3 | Credibility | Two or more bold spans in an email under 300 words, or bold on proper nouns or acronyms |
| P16 | Inline-header list: bold label plus colon that restates the line | D3 | Credibility | unslop's exemption applies. A bold lead-in that ends in a period and is followed by new detail is fine. |
| P17 | Title Case headings | D3 | Cosmetic | Headings in documents and web copy. Product names are exempt. |
| P18 | Decorative emoji in body, headings or bullets | D3 | Cosmetic | UI-style glyphs (✅ 🚀 1️⃣ ⚠️). Face emoji in SMS and chat are exempt. |
| P19 | Curly quotes | D3 | Cosmetic, never deducted in email, SMS or LinkedIn | Web copy whose style guide requires straight quotes. Never counts toward clusters. |
| B6 | Subject-line decoration: 🚀 ✨ ‼️ 🔥, ALL CAPS, repeated "!" | D3 | Credibility | Any instance |
| B16 | Literal markdown or rendering residue: `**`, `##`, backticks | D3 | Disqualifying | Any instance in a channel that doesn't render markdown (plain-text email, SMS, LinkedIn) |
| B17 | Unusual Unicode styling: 𝗯𝗼𝗹𝗱 Unicode letters, → arrows, ≈, checkmark bullets | D3 | Cosmetic, credibility at 2 or more | Outside technical content where the symbol is the right one |

### Communication artifacts and email-native slop

| ID | Tell | Dim | Tier | Counts when |
|---|---|---|---|---|
| P20a | Assistant artifacts: "Certainly! Here's", "Sure! Here's a draft", "I hope this helps!", "Would you like me to adjust the tone?", leftover prompt text | D7 | Disqualifying | Any instance |
| P20b | Conversational closers: "Let me know if you have any questions", "Let me know if..." | D7 | Cosmetic | Counts as a B5 closer |
| P21 | Cutoff or availability disclaimers: "As of my last update", "While specific details are limited" | D7 | Disqualifying | Any instance |
| P22 | Sycophancy: "Great question!", "You're absolutely right!", "Love what you're building" | D6 | Credibility | Praise with no stated object |
| B1 | Stock opener: "I hope this email/message finds you well" | D7 | Credibility | Always. "Hope you're doing well" counts only when followed by a B2 wind-up or sent cold. |
| B2 | Wind-up: "I wanted to reach out", "I'm reaching out because", "I wanted to touch base", "I wanted to provide a quick update" | D7 | Credibility | Any instance |
| B3 | Empty follow-up: "Just following up", "checking in", "circling back", "bumping this" | D7 | Credibility | The message adds no new fact, date or ask. Exempt if it adds one. |
| B4 | Reproach formulas: "Per my last email", "As previously stated" | D7 | Credibility | Any instance. Restate the point instead. |
| B5 | Stock closers: "Don't hesitate to reach out", "At your earliest convenience", "Thanks in advance", "Looking forward to hearing from you", P20b | D7 | Cosmetic each, credibility at 2 or more | Count per message |
| B7 | "Quick question" subject on a non-question | D7 | Credibility | The body contains no question to the recipient |
| B8 | Fake thread markers: "Re:" or "Fwd:" on a first message, "as we discussed" with no prior discussion | D7 | Disqualifying | Deceptive. The FTC's CAN-SPAM compliance guide says: "Don't use deceptive subject lines. The subject line must accurately reflect the content of the message." Each violating email is subject to penalties of up to $53,088. |
| B13 | Apology-shaped opening without a fault: "Sorry to bother you", "I know you're busy", "Apologies for the intrusion" | D7 | Credibility | No fault is named. "Sorry, I sent the wrong invoice Tuesday" is exempt. |
| B14 | Enthusiasm inflation: thrilled, excited, delighted, can't wait, love to, amazing, incredible | D6 | Cosmetic at 1, credibility at 2 or more or on a routine event | Count per message |
| B23 | Register mismatch: a long-standing client gets a cold-prospect voice, or a stranger gets false familiarity | D7 | Credibility | Judged against the Step 0 relationship |

### Personalization and specificity

| ID | Tell | Dim | Tier | Counts when |
|---|---|---|---|---|
| B9 | Merge-field residue or mismatch: `{FirstName}`, `[Company]`, "Hi ,", the wrong name, a referent contradicted by supplied facts | D5 | Disqualifying | Any instance |
| B10 | Merge-depth personalization: "I see you're the VP of Ops at Acme" | D5 | Credibility | Fails the deletion test in D5 |
| B11 | Unanchored flattery: "doing great things", "impressive growth", "love your content" | D5 | Credibility, disqualifying in cold outreach when it is the only personalization | No checkable object named |
| B12 | Uncheckable "I noticed / I saw" claim: "I noticed you're focused on growth this year" | D5 | Disqualifying in cold outreach, credibility elsewhere | The claim cites no date, document, post, event or number |
| B24 | Specificity deficit: zero anchors in the body | D5 | Disqualifying for client and cold/public, credibility for internal | Count anchors per the D5 definition |
| B25 | Portability failure: no body sentence passes the portability test | D5 | Disqualifying for client and cold/public, credibility for internal | Every sentence could ship unchanged from a competitor |

### Structure

| ID | Tell | Dim | Tier | Counts when |
|---|---|---|---|---|
| B18 | Restating summary | D4 | Credibility | D4 check d fails |
| B19 | Uniform paragraphs | D4 | Credibility | D4 check c fails |
| B20 | Flat rhythm | D4 | Credibility | D4 check a or b fails |
| B21 | Bullets where prose belongs | D4 | Credibility | D4 check f fails |
| B22 | Template scaffold | D4 | Credibility | D4 check g fails |
| P28 | Dense sentence | D4 | Cosmetic | D4 check e fails |
| U33 | Over-compression: arrows, symbol-speak, verbless fragments that need decoding | D4 | Cosmetic | In email and web copy. In SMS only arrows and symbol-speak count. |
| P29 | Hidden-actor passive | D6 | Cosmetic | D6 check d fails |
| U32 | Mannered prose: aphorisms and figurative verbs where a literal phrase exists ("a dial worth turning") | D2 | Cosmetic | Any instance |

P27 (say what it does, not how it feels) has no tally row. It is scored through the D5 portability test.

---

## Part 5. False-positive guardrails

The rubric asks whether a message reads as written by a specific person to a specific recipient. It doesn't prove authorship, and it must not punish competent human habits.

### Thresholds for devices humans use often

| Device | Not a tell when | Tell when |
|---|---|---|
| Em dash (P13) | 1 in a message under 200 words, 2 in 200 to 600 words, at most 1 per 200 words beyond that | Above those counts. Swapping dashes for parentheses doesn't help, because both count toward the same total. |
| Bold (P15) | One bold span marking a deadline or the single action item | Two or more spans in an email under 300 words, or bold on names and acronyms |
| AI vocabulary (P7) | One or two words, in different paragraphs | Three or more distinct list words, or two in one paragraph |
| Triads (P10) | The real count is three, or there is one abstract triad in a long message | Two or more abstract triads in one message |
| "Not just X but Y" (P9) | One instance | Two or more |
| Bullets (B21) | Steps, dates, options, prices, SKUs or line items | Abstract benefits, or full sentences that form one argument |
| Passive voice (P29) | The actor is unknown or irrelevant ("the package was damaged in transit") | The hidden actor is the sender, more than once |
| Curly quotes (P19) | Any email, SMS or LinkedIn message, since word processors and phone keyboards insert them automatically | Only against a written house style for web copy |

### Context exemptions

1. Literal and technical senses of list words: landscape architecture, key account, API key, robust standard errors, an "Enhanced" plan that is the product's real name.
2. Words and phrases quoted from the recipient, a customer or a source. Graders score the writer's prose, not the quote.
3. Mandated text: legal disclaimers, regulatory wording, opt-out lines, accessibility statements.
4. A cliché that carries the only new fact. "Just following up: the quote expires Friday" isn't B3.

### What the rubric never scores

- Grammar, spelling or polish. Wikipedia's AI Cleanup guide lists perfect grammar, "bland" prose, "fancy" words and letter-like formatting as ineffective indicators.\[6\]
- Plain or repetitive vocabulary. Liang, Yuksekgonul, Mao, Wu and Zou (Stanford, Patterns 2023) ran seven widely used GPT detectors on 91 human-written TOEFL essays. The detectors misclassified the essays as AI-generated at an average false positive rate of 61.22%. All seven detectors flagged 18 of the 91 essays, while the same detectors were near-perfectly accurate on US 8th-grade essays. This rubric rewards repeating one term (P11), and it doesn't count low lexical variety against anyone.

### Why co-occurrence carries the weight

Every tell has a human base rate. Wikipedia's editors write that human writers "often like em dashes" and that the sign "is most useful when taken in combination with other indicators, not by itself."\[6\]\[7\] Pangram, which sells a detector, says outright that "No single tell of AI writing is a giveaway."\[1\] Clusters (Part 1, rule 4) and per-message thresholds make a single habit cheap and a pile-up expensive.

---

## Part 6. Worked examples

All companies, people and figures in these examples are fictional.

### Example 1. Cold email

Context: cold outreach tier, email, no prior contact. The recipient is Dana Whitfield, ops director at Brightline Logistics. Her company's public job post from Oct 14 asks for an analyst to "build weekly carrier scorecards in Excel."

Before:

```text
Subject: Quick question 🚀

Hi Dana,

I hope this email finds you well! I noticed that Brightline Logistics is doing great things in the evolving landscape of supply chain management.

At Corvana, we're not just a software provider — we're a partner in your growth journey. Our platform empowers teams to streamline operations, enhance visibility, and unlock new efficiencies.

Industry reports suggest that companies leveraging real-time tracking see significant improvements in customer satisfaction. Our clients have seen remarkable results, from faster deliveries to happier customers.

I'd love to set up a quick 15-minute call to explore how we can help Brightline thrive. Don't hesitate to reach out at your earliest convenience!

Best,
Jordan
```

Score:

| Dim | Score | Evidence |
|---|---|---|
| Disqualifying | B11 + B12 | "I noticed that Brightline Logistics is doing great things" is unanchored flattery and an uncheckable "I noticed" claim, and it is the only personalization |
| D1 | 0 | 9 tells: "evolving landscape", "growth journey", "empowers", "streamline", "enhance", "unlock", "leveraging", "significant improvements", "remarkable results" |
| D2 | 1 | 4 templates: "not just... we're", the abstract triad "streamline... enhance... unlock", "Industry reports suggest", the false range "from faster deliveries to happier customers" |
| D3 | 2 | B6 🚀 in the subject (credibility). One em dash in 105 words is under threshold. |
| D4 | 2 | Check b fails on the run 15, 13, 14, 12. Check c fails because all four paragraphs have 2 sentences and 24 to 28 words. |
| D5 | 0 | No anchors beyond the merge-slot company name. Every sentence is portable. |
| D6 | 0 | Only check d passes. No opinion, no tradeoff, no specific "I", affect at "love", "great" and "remarkable", flattery. |
| D7 | 1 | Fails a (B1 plus two B5 closers), d (B7 with no question in the body, plus B6), and f (two competing asks, no time) |
| Total | 6 / 28 | Raw 6, cap irrelevant. Fails the cold tier on the disqualifier, the total and five floors. |

After:

```text
Subject: your Oct 14 carrier scorecard post

Hi Dana,

Your ops team posted a job on Oct 14 for an analyst to "build weekly carrier scorecards in Excel." We make software that does most of that spreadsheet work, so this is a pitch, but a narrow one.

Corvana pulls carrier scans from your TMS and flags late loads by lane. Freight Partners in Reno cut their weekly scorecard from about six hours to under one after switching in March. It won't help with carriers that never send scans. In our data that's about a third of regional carriers, which is annoying, and I don't see it changing soon.

Want a sample? Send one week of scan exports and I'll return a scorecard for your three busiest lanes by Friday, Oct 30.

Jordan Reyes
Corvana
```

Score:

| Dim | Score | Evidence |
|---|---|---|
| Disqualifying | None | |
| D1 | 4 | 0 tells |
| D2 | 4 | 0 templates. "three busiest lanes" is a true count and "six hours to under one" sits on one scale. |
| D3 | 4 | No dashes, bold or emoji. Straight quotes. |
| D4 | 4 | Lengths 19, 19, 13, 19, 9, 20, 3, 20 give a spread of 17 and no flat run. Paragraphs of 2, 4 and 2 sentences. The fragment "Want a sample?" |
| D5 | 4 | Anchors include Oct 14, the quoted job post, TMS, Freight Partners in Reno, six hours to under one, March, a third, three lanes and Oct 30. The checkable referent is the dated job post. 7 of 8 sentences are portable-false. |
| D6 | 4 | Opinion ("which is annoying, and I don't see it changing soon"), a limit ("It won't help with carriers that never send scans"), specific "I", active voice, no affect words, no flattery |
| D7 | 4 | No clichés. The subject names the referent. One ask with a date. 122-word body. |
| Total | 28 / 28 | Passes the cold tier. A full score means no tells and every positive check met. It doesn't promise a reply. |

### Example 2. Client update

Context: client deliverable tier, email. Maria Chen has been a client for six years. On Tuesday's call she asked whether the old blog URLs would survive the redesign.

Before:

```text
Subject: Project Update: Q3 Website Redesign

Hi Maria,

I hope you're doing well! I wanted to provide a quick update on the website redesign project.

**Progress:** We have made significant progress on the homepage design, ensuring it aligns with your brand vision while enhancing the user experience.

**Challenges:** Despite some challenges with the content migration, the team continues to make strides toward our goals.

**Next Steps:** We will be finalizing the remaining pages and conducting thorough testing to ensure a seamless launch.

Overall, the project is on track, and we're excited about the progress. Let me know if you have any questions!

Best,
Sam
```

Score:

| Dim | Score | Evidence |
|---|---|---|
| Disqualifying | B24 | Zero anchors in the body. "Q3" appears only in the subject. |
| D1 | 1 | 7 tells: "significant progress", "ensuring it aligns...", "aligns with", "enhancing", "make strides", "thorough", "seamless" |
| D2 | 2 | P6 "Despite some challenges... continues to make strides" and P25 "Overall, the project is on track" |
| D3 | 2 | P16 inline-header list with three bold labels (credibility) and P17 Title Case subject (cosmetic) |
| D4 | 3 | Check g fails on the Progress/Challenges/Next Steps scaffold. Lengths 5, 12, 21, 16, 16, 12, 8 pass a and b. |
| D5 | 0 | No anchors, no reference to Tuesday's call |
| D6 | 1 | Passes d and f only. No opinion, "some challenges" names nothing, no specific "I", "excited" about a routine update. |
| D7 | 1 | Fails a (B1 followed by the B2 wind-up "I wanted to provide a quick update"), e (a six-year client gets a template voice), f (no ask and no "nothing needed") |
| Total | 10 / 28 | Raw 10, cap applied (still 10). Fails the client tier. |

After:

```text
Subject: Redesign: homepage on staging, blog fix by Thursday

Hi Maria,

The homepage is done and up on staging. Same link and password as the last round.

The blog migration is the problem. 212 of your 640 posts came over with broken image paths, nearly all from the 2019 batch on the old WordPress install. Priya is fixing them with a script and expects to finish Thursday.

You asked on Tuesday's call whether the old blog URLs will keep working. They will. We're adding redirects for all 640, and I'll send you the list so your team can spot-check the posts that get the most search traffic.

Launch is still Nov 12. If the image fix slips past Thursday, I'd rather move launch to Nov 19 than ship a half-checked blog, and I'll tell you that day. Nothing needed from you this week.

Sam
```

Score:

| Dim | Score | Evidence |
|---|---|---|
| Disqualifying | None | |
| D1 | 4 | 0 tells |
| D2 | 4 | 0 templates |
| D3 | 4 | The subject-line colon is an exempt separator |
| D4 | 4 | Lengths 8, 8, 6, 22, 12, 13, 2, 25, 5, 25, 6 give a spread of 23 and no flat run. Paragraphs of 2, 3, 3 and 3 sentences. Fragments "Same link and password as the last round." and "They will." |
| D5 | 4 | 212 of 640, 2019, WordPress, Priya, Thursday, Nov 12, Nov 19. The shared referent is "Tuesday's call". |
| D6 | 4 | Opinion ("I'd rather move launch..."), a named problem and its contingency, specific "I", active voice, no affect, no flattery |
| D7 | 4 | No clichés, a specific subject, register built on shared history, an explicit "Nothing needed from you this week" |
| Total | 28 / 28 | Passes the client tier |

### Example 3. Marketing announcement

Context: cold/public tier, launch email to existing customers and trial users, also posted as a web page.

Before:

```text
Subject: ✨ Introducing FlowSync 3.0: The Future of Team Collaboration ✨

Hi there,

We're thrilled to announce the launch of FlowSync 3.0 — a groundbreaking release that redefines how teams work together.

In today's fast-paced world, seamless collaboration is more crucial than ever. FlowSync 3.0 isn't just an update; it's a complete reimagining of the collaborative experience.

- 🚀 **Smarter Workflows:** Intelligent automation that adapts to your team's unique needs.
- 🔒 **Enhanced Security:** Robust protection for your most important data.
- 📊 **Powerful Insights:** Actionable analytics that drive meaningful results.

Whether you're a startup or an enterprise, FlowSync 3.0 empowers you to achieve more. The future of work is here — and it's never looked brighter.

Ready to get started? Upgrade today!

The FlowSync Team
```

Score:

| Dim | Score | Evidence |
|---|---|---|
| Disqualifying | B24 + B25 | No anchor beyond the product's own name and version, and every sentence would work for any competitor |
| D1 | 0 | More than 8 tells: B15 "We're thrilled to announce", "Introducing", "In today's fast-paced world" and "Ready to get started?", plus "groundbreaking", "redefines", "seamless", "crucial", "reimagining", "robust", "empowers", "meaningful results" |
| D2 | 0 | 5 templates: "isn't just... it's", the abstract benefit triad, the false range "Whether you're a startup or an enterprise", the generic conclusion "The future of work is here", and synonym cycling across "collaboration", "work together" and "collaborative experience" |
| D3 | 0 | B6 ✨ in the subject, two em dashes in 95 words, P16 inline-header bullets, P18 emoji bullets, Title Case subject |
| D4 | 2 | Check b fails on the run 11, 14, 14, 11. Check f fails because the bullets are abstract benefits. |
| D5 | 0 | Disqualified |
| D6 | 1 | Passes c (brand copy is exempt), d and f. No opinion, no limit stated, affect in "thrilled" and "never looked brighter". |
| D7 | 0 | Fails a (B15 announcement opener), d (B6 plus a generic subject), e ("Hi there" to people who already use the product, with no reference to their use), f ("Upgrade today!" when the update is automatic) |
| Total | 3 / 28 | Fails the cold/public tier |

After:

```text
Subject: FlowSync 3.0: recurring tasks stop duplicating

For two years, the most common ticket in our support queue has said some version of the same thing. Edit a recurring task and FlowSync makes a duplicate. Version 3.0 fixes that. It took us far too long. Change a weekly task once and every future copy updates. Past copies stay as they were, so your history doesn't change under you.

Two smaller changes ship with it. Admins can now set permissions per folder instead of per workspace. And the weekly report shows how long each task sat in review, a number our own team had been exporting to a spreadsheet every Monday in order to track.

One thing 3.0 doesn't fix: the mobile app still can't edit recurring tasks. That's planned for 3.1 in January.

Your workspace updates automatically on Nov 3. Nothing to install. The full list of changes is at flowsync.com/releases/3-0.

Lena Ortiz
Product lead, FlowSync
```

Score:

| Dim | Score | Evidence |
|---|---|---|
| Disqualifying | None | |
| D1 | 4 | One tell (P23 "in order to") in a message over 150 words is under the noise floor |
| D2 | 4 | 0 templates. "Two smaller changes" is a true count. |
| D3 | 3 | One cosmetic tell, the P14 colon in "One thing 3.0 doesn't fix: the mobile app..." |
| D4 | 4 | Lengths run from 3 to 29 with no flat run. Paragraphs of 6, 3, 2 and 3 sentences. "And" opener and fragments. |
| D5 | 4 | Two years, support tickets, folder versus workspace, the Monday spreadsheet, 3.1, January, Nov 3, the URL. The referent is the duplicate-task bug the audience has lived with. |
| D6 | 3 | Fails c because the copy is signed by one person and has no "I". Opinion ("It took us far too long"), a stated limit, one hidden-actor passive ("That's planned") within the allowance, no affect. |
| D7 | 4 | Specific subject, written to existing users' known problem, explicit "Nothing to install", announcement-length |
| Total | 26 / 28 | Passes the cold/public tier, with every dimension at 3 or higher and no credibility-eroding tells |

---

## Part 7. Channel notes

### SMS

- Length changes which checks apply. A single SMS segment holds 160 GSM-7 characters. One emoji switches the message to UCS-2 encoding, which cuts the segment to 70 characters, so emoji cost money as well as tone.
- D4 checks a, b, c and h rarely apply. Score D4 on d, e and U33. Dropped articles are normal in SMS, but arrows (→) and symbol-speak still count.
- D5 needs one anchor in one or two sentences, such as an order number, appointment time or technician name. Any anchor-free SMS at client or cold stakes trips B24.
- Face emoji are normal human SMS behavior. Pangram's data shows humans use 😊 and ❤️ more often than models. UI-style glyphs (✅ 🚀 keycap numbers) remain P18.\[1\]

### LinkedIn

- LinkedIn doesn't render markdown, so `**` and `##` show up literally. That is B16, disqualifying. Bold built from Unicode math letters is B17.
- Connection notes and DMs to strangers use the cold tier. "I came across your profile" and "I see you're the Head of X at Y" are B10. "I'd love to connect" is a B5 closer.
- Posts are a separate genre. Short one-line paragraphs are a common human LinkedIn style, so check c is reversed for posts. It fails only when every line is a single sentence of similar length and the post ends in engagement bait ("Agree?", "Thoughts?"). Treat that bait as a B5 closer.

---

## Part 8. Source notes

### How this rubric relates to unslop

I fetched both versions of unslop on October 25, 2026.

- The backnotprop/pstack mirror has 31 numbered patterns in 7 categories, the same as the brief's inventory. It also has an "Adding soul" section ("Removing patterns is half the job. Sterile, voiceless writing is just as obvious.") and a four-step process ending in the self-audit "What makes this obviously AI generated?".\[2\]
- The upstream cursor/plugins version drops rules 1, 2, 5, 6, 21 and 22 in their original form, drops "Adding soul", and adds rule 32 (mannered prose) and rule 33 (over-compression). It notes that "Rule numbers are stable ids that other skills cite. A removed rule leaves a gap."\[4\] The repository calls itself a mirror "kept in sync", but as of this fetch the two copies differ, so say which version you mean when you cite rule numbers.\[8\]
- This rubric keeps all 31, because puffery and promotional language matter more in sales copy than in engineering docs. It adds 32 and 33 as U32 and U33, and turns "Adding soul" into the D6 checks and D4 check h.
- The source added precision the brief lacked. Puffery includes "setting the stage for" and "deeply rooted". The metaphor list includes harness, scaffolding, gold-plating and endgame. The passive check is "is/are/was/were + past participle". The inline-header exemption covers a bold lead-in that ends in a period and is followed by new detail.\[2\]\[4\]
- Two deliberate departures. unslop says to "Avoid em dashes entirely" and to replace curly quotes.\[4\] This rubric uses a per-message em dash threshold, while keeping unslop's rule that parentheses count against the same total, and never deducts curly quotes in email, SMS or LinkedIn.\[2\]

### Evidence behind the thresholds

- Vocabulary. Kobak et al. (Science Advances, 2025) analyzed 15.1 million PubMed abstracts from 2010 to 2024. "delves" appeared at 28 times its expected 2024 frequency, "underscores" at 13.8 and "showcasing" at 10.7. At least 13.5% of 2024 abstracts were processed with LLMs.\[5\]\[9\] The authors suggest native speakers may be better at deleting marker words, which is one reason D5 carries as much weight as D1.\[5\] Word lists catch careless use, not careful use.
- Formatting rates. Pangram's "9 Signs of AI Writing" reports rates per 10,000 words for human versus AI text. Bold runs 2 versus 65, em dashes 2 versus 17, bullet lists 3 versus 28, triads 5 versus 19 and "not just X but Y" 1 versus 3. A second chart on the same page gives a human em dash average of 5.\[1\] Pangram sells a detector and its two baselines disagree, so the rubric uses these numbers for direction and rough size, not exact cutoffs.
- Passive voice. Reinhart, Markey, Laudenbach et al. (Carnegie Mellon; PNAS 122(8), February 2025) report that "GPT-4o uses the agentless passive voice at roughly half the rate as human texts." The same paper found GPT-4o uses present participial clauses at 5.3 times the human rate and nominalizations 2.1 times as often. The first finding is why P29 is a clarity rule here, and the second supports P3.
- Rhythm. GPTZero, which popularized "burstiness", says there is "no set threshold" for it.\[10\] D4 checks a and b are hand-countable proxies, not a detection score.
- Subject lines. Hunter's State of Email Outreach 2026, based on 31 million emails sent in 2025, reports that "Quick question" subject lines got a 28.7% open rate and 2.5% reply rate, against 32.9% and 2.9% for other subject lines.\[11\]\[12\]\[13\] That gap is why B7 is credibility-eroding rather than cosmetic.

---

## Caveats

- This rubric measures whether a message reads as written by a specific human to a specific recipient. It doesn't detect authorship. A careful editor can bring AI text to 28, and a rushed human can score 10. Use it to improve drafts, not to accuse people.
- The thresholds are calibrated judgments. They are anchored to published human-versus-AI rates and plain-language guidance, but nobody has validated them against a labeled corpus of business email. If your team's own sent mail regularly trips a threshold, raise that threshold rather than rewriting good human writing.
- Model habits drift. Wikipedia's Signs of AI writing page says "delve" "was famously overused by ChatGPT in 2023 and early 2024, but became less frequent later in 2024, then dropped off sharply in 2025." Pangram shows Gemini 3 Pro using fewer em dashes than humans. Re-check the P7 list and the P13 threshold every few months against current output.
- D5 checks that a referent is specific enough to verify. It can only check that it is true when the grader has the facts. A precise but invented referent passes the text-only check, so supply the prior thread or account notes whenever stakes are client or cold.

## Sources

1. [9 Signs of AI Writing, Backed by Data | Pangram](https://www.pangram.com/signs-of-ai-writing)
2. [pstack/skills/unslop/SKILL.md at main · backnotprop/pstack](https://github.com/backnotprop/pstack/blob/main/skills/unslop/SKILL.md)
3. [GitHub - backnotprop/pstack: Skills and principles for rigorous AI-assisted engineering · GitHub](https://github.com/backnotprop/pstack?st_source=ai_overview)
4. [plugins/pstack/skills/unslop/SKILL.md at main · cursor/plugins](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md)
5. [Delving into ChatGPT usage in academic writing through ...](https://arxiv.org/pdf/2406.07016)
6. [agent-toolkit/skills/writing-clearly-and-concisely/signs-of-ai-writing.md at main · softaworks/agent-toolkit](https://github.com/softaworks/agent-toolkit/blob/main/skills/writing-clearly-and-concisely/signs-of-ai-writing.md)
7. [Following The Wikipedia AI Sign of Writing Could Backfire](https://humanizeai.com/blog/wikipedia-signs-of-ai-writing-could-make-your-content-worse/)
8. [GitHub - backnotprop/pstack: Use pstack with claude, codex, pi - Skills and principles for rigorous AI-assisted engineering · GitHub](https://github.com/backnotprop/pstack)
9. [Delving into LLM-assisted writing in biomedical publications through excess vocabulary](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12219543/)
10. [How do I interpret burstiness or perplexity?](https://support.gptzero.me/articles/9585228410-how-do-i-interpret-burstiness-or-perplexity)
11. [The State of Email Outreach 2026 - Hunter.io](https://hunter.io/the-state-of-cold-email)
12. [Cold Email Subject Lines: 15 Best Practices + 25 Examples (2026)](https://outreachbloom.com/cold-email-subject-lines)
13. [Cold Email Subject Lines: 15 Best Practices + 25 Examples (2026)](https://outreachbloom.com/mastering-cold-email-subject-lines-15-best-practices-25-powerful-examples/)
