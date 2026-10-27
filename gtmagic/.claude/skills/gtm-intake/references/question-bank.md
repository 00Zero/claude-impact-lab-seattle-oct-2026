# Question bank

Ask 2–4 questions at a time, numbered. Use the plain wording below with the owner; the "Fills" line is for you only.

Each topic has:
- **Ask:** the plain-language question.
- **If vague:** the one concrete follow-up, used only when the answer has no number, no named group or place, and no observable behavior. Still vague after it: record a hypothesis at confidence 1 plus a research question, and move on.
- **Good answer:** what a concrete answer looks like (examples are fictional).
- **Fills:** where the answer goes in `intake.json`.

"I don't know" is always fine: record `unknown` and move on.

---

## Offer

- **Ask:** "What do you sell, and what does a customer get on day one?"
- **If vague:** "If I bought it right now, what would I actually receive or do first?"
- **Good answer:** "A phone app. Day one you get a 20-minute strength plan and a daily protein target."
- **Fills:** `business.description`, `business.stage`.

## What you've already made (ask in the first round)

- **Ask:** "Do you have ads, landing pages, headlines or CTAs (the button text, like 'Start free trial') you've already used? Any results? Screenshots, exports or copy-and-paste all work, and so do drafts you never ran."
- **If vague:** "What's the headline on your website right now, and what does the main button say?"
- **Good answer:** "Two Facebook ads from last month, here's the export and a screenshot of the better one. And a headline I wrote but never used: 'Strength first, scale second'."
- **Fills:** `creatives[]` (wording verbatim, `status`, `imageFile` and `imageDescription` for images), `priorExperiments[]` for any results, linked both ways. "No results" is a fine answer: record the creative with `experimentIds: []`. Never fill in numbers the owner didn't give. If an ad names a medication or makes a claim, tell the owner once that platforms may restrict it, and record it unchanged.

## Traction

- **Ask:** "How many paying customers do you have today, and roughly how did the last few find you?"
- **If vague:** "Think of your last three customers. Where did each one first hear about you?"
- **Good answer:** "About 120 subscribers. Most of the recent ones came from a Facebook group post and two from a podcast mention."
- **Fills:** `business.stage`, owner-text evidence, `segments[].channels` leads.

## Goals: minimum revenue

- **Ask:** "What is the minimum level of revenue to successfully sustain or grow your business?"
- **If vague:** "What's the least you'd need coming in over the next 12 months to keep the business going? One dollar figure is fine."
- **Good answer:** "At least $180,000 a year. Below that I'd have to go back to consulting."
- **Fills:** `business.revenueGoal12mo`: the minimum revenue needed in a year to sustain or grow the business (same currency as pricing).

## Goals: realistic share of the group

- **Ask:** "Out of 100 people who fit your customer group, how many do you think you could realistically win in a year?"
- **If vague:** "Think of your current customers: roughly what share of the people you reached actually signed up?" Don't offer a benchmark; it's their estimate.
- **Good answer:** "Maybe 1 in 100."
- **Fills:** `business.adoptionRate` as a fraction (0.01). The script uses it for the size check; without it, size isn't judged.

## Goals: price and payments in the first year

- **Ask:** "What does a customer pay, and on average how many times do they pay in their first year? Count people who cancel early."
- **If vague:** "What's the price on your checkout page today, and is it monthly, yearly, or one time?"
- **Good answer:** "$14.99 a month. Some cancel, so about 9 payments in the first year on average." (12 is only right if nobody cancels.)
- **Fills:** `business.pricing` (`amount`, `currency`, `period`, `purchasesPerYear`). The script uses this with the minimum revenue for size math; don't do the math yourself.

## Target cost per sign-up

Many owners don't know this number. Don't treat "I don't know" as the end here: help them back into it.

- **Ask:** "Do you know the most you can spend on ads to win one new paying customer?"
- **If they give a number:** take it. That's `business.targetCpa`.
- **If they don't know, or the answer is vague,** walk them through it. Cost to serve comes first, because it sets what's sustainable:
  1. **What a customer pays in a year.** You already have the price and purchases per year. The script turns those into a yearly figure; don't work it out in the chat.
  2. **Cost to serve.** "Of what a customer pays you, roughly what share goes to serving them?" If they don't know, help them estimate it from their actual cost lines per customer per month: payment fees, hosting and software, support time, content or coaching, materials or shipping, refunds. Add them up with code, not in your head. Still unknown → leave `costToServeShare` empty and say the break-even can't be worked out yet.
  3. **Show the break-even.** Run the validator. It writes `unitEconomics.breakEvenCac`: the most a new customer can cost to win before their first year loses money. Quote that figure, from the script.
  4. **Acquisition share.** "Knowing that, what share of a customer's first-year revenue do you want to spend to win them, keeping some margin for yourself?"
- **Never offer a benchmark or rule of thumb** for these shares. If the owner asks what's normal, say there's no reliable figure for their business without research; if it matters, add it as a research question with sources.
- **Good answer:** "I don't know a number. Payment fees, hosting and the coach who writes programs come to about 30% of what a customer pays. Knowing the break-even, I'll spend up to 40% of their first year to win one."
- **Fills:** `business.targetCpa` only when the owner states one. Otherwise `business.costToServeShare` (step 2) and `business.acquisitionShare` (step 4), as fractions (0.3, 0.4). The script computes `business.unitEconomics` (yearly value, break-even, max cost per sign-up, leftover first-year margin) and warns when serving costs plus acquisition leave no margin. With no owner target, ad verdicts use the max it derives. With no target and no acquisition share, every ad result is inconclusive.

## What's been tried

- **Ask:** "What have you already tried to find customers, and what happened? If you've run ads, can you share the export?"
- **If vague:** "Pick the one thing you spent the most money or time on. What did you try, and roughly what came back?"
- **Good answer:** "Two Meta campaigns last spring, about $700 total. The muscle one got sign-ups; the general one barely did. Here's the CSV."
- **Fills:** `priorExperiments[]` (metrics copied from the file at campaign or ad level, or typed exactly as the owner says them with `source: "manual"`; column names in `imports.md`), linked to the matching `creatives[]`, plus owner-text evidence. Skip this if the owner already covered it under "What you've already made".

## Alternatives and who customers switch from

- **Ask:** "Before they found you, what were your customers using instead? Who do they switch away from?"
- **If vague:** "Name one app, product, person or habit a customer told you they stopped using when they started with you."
- **Good answer:** "Mostly a big calorie-tracking app. A few had a personal trainer they couldn't afford anymore."
- **Fills:** `hypotheses[].insteadOf`, `serviceability.incumbents` leads (verify in research), `currentSolution` attribute.

## Who it's for

- **Ask:** "Who is it for? Describe the customer you have in mind."
- **If vague:** "If you could only reach one group of people next month, who would it be, and what are they doing today?"
- **Good answer:** "People in their 40s and 50s who've just started losing weight and have never followed a strength plan. Today they walk or watch free videos."
- **Fills:** the owner's-guess hypothesis and its segment (`isOwnerGuess: true`), plus research questions to test it. It's a guess, not a must-have, unless the owner says "only".

## Why people buy

- **Ask:** "What's usually going on in someone's life when they decide to buy?"
- **If vague:** "Think of one recent customer. What happened that week that made them sign up?"
- **Good answer:** "They notice they're weaker, like struggling with groceries, a few months into losing weight."
- **Fills:** `hypotheses[].motivation`, `serviceability.motivation`, research questions for concern mining.

---

## Today's targeting dimensions

Each answer becomes a `Constraint`. Listen for the bucket: "only" or "never" is a must-have (`locked`); "mostly" or "ideally" is a `preference`; a guess is a `hypothesis`; "not sure" is `unknown`. Geography and price can't stay unknown for `ready`.

### Geography

- **Ask:** "Where can you serve customers? Anywhere, one country, or a local area?"
- **If vague:** "Is there any place you couldn't take a customer from, like outside the US or more than 20 miles away?"
- **Good answer:** "US only, because of payments and support hours."
- **Fills:** `dimension: "geography"`, e.g. `include ["US"]`.

### Age

- **Ask:** "What ages are your customers, and are there ages you won't serve?"
- **If vague:** "Picture your three most typical customers. Roughly how old are they?"
- **Good answer:** "Mostly 40s and 50s. Must be 35 to 64 for the ads; we don't market to under-35s."
- **Fills:** `dimension: "age"`, e.g. `range` 35–64.

### Price

- **Ask:** "Is your price fixed for now, or open to change?"
- **If vague:** "If research said a lower price would sell more, would you change it this year?"
- **Good answer:** "Fixed at $14.99 a month for this year."
- **Fills:** `dimension: "price"` (usually `locked` when fixed).

### Channel

- **Ask:** "Where would you want to reach people: which ad platforms, communities, or places?"
- **If vague:** "If you could only run ads in one place next month, where would it be?"
- **Good answer:** "Meta first, maybe Reddit. Not TikTok."
- **Fills:** `dimension: "channel"`, with excludes for anything ruled out.

### Health and regulatory limits

- **Ask:** "Are there things you can't say or can't do, like health claims, naming a medication, or targeting people by a condition?"
- **If vague:** "Has a platform, lawyer or partner ever told you not to say something? Do you have permission to use any brand names?"
- **Good answer:** "No medical claims, and we can't name any drug brands."
- **Fills:** `dimension: "regulatory"` and `"healthCondition"`, usually `locked`, `appliesTo: "messaging"` or `"targeting"`. See the sensitive-topic rules in SKILL.md.

### Interests (up to 3 today)

- **Ask:** "What are your customers into, besides your product? Name up to three interests."
- **If vague:** "What groups, pages, or shows would your typical customer follow?"
- **Good answer:** "Weight loss, strength training, and high-protein cooking."
- **Fills:** `interests[]` (each with `researchDefinition` and `targetableProxies`), plus an `interest` constraint, usually `hypothesis`.

Every other dimension (sex, income, life stage, language, audience type) defaults to `unknown` today without asking.

---

## Send-back (narrowing) questions

Use these in session 2 when research finds the owner's target crowded or vague. The pattern:

1. **State the evidence** in one plain sentence, with a number only if it was copied from a source or computed by the script.
2. **Offer two concrete options** that would each narrow the group.
3. **Ask the owner to pick one,** or name a third.

**Example:** "Five well-rated apps already target GLP-1 fitness. Is your user mainly protecting muscle, or mainly losing weight?"

**Another example:** "Reviews of the big dog-grooming chains keep coming back to wait times, not price. Are your customers mainly busy professionals who want it done at home, or mainly people looking for the cheapest option?"

Record the answer as a sharpened hypothesis (or a must-have, if the owner says "only"), and cite the evidence IDs behind the question in that hypothesis's `evidenceIds`.
