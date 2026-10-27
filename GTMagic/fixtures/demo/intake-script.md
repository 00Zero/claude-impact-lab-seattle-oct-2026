# Demo owner script: KeepStrong

> **FICTIONAL. Every person, business, number and source in this file is made up for the GTMagic demo.** KeepStrong, its owner, "TrackAll" and all ad results are invented. Nothing here describes a real company or real people.

In demo mode (`mode: "demo"`), the `gtm-intake` skill plays the interviewer and reads the owner's answers from this file instead of waiting for a person. The answers must produce `fixtures/demo/intake.json`. The prior ad results are in `fixtures/demo/meta-ads.csv`. The owner's ad screenshot is fictional and has no file; its description is recorded in `intake.json`.

**How to use it:** ask the questions in your own words, in roughly this order. Where an answer is marked *vague*, run the vagueness check (one concrete follow-up) and use the owner's clearer answer. Each topic notes the field it feeds.

---

## 1. One-liner

**Owner:** "A fitness app for people on GLP-1s."

→ `baseline.ownerFirstDescription`. The skill reads this line from `fixtures/demo/one-liner.txt`. Demo mode doesn't run the baseline prompt: it copies the `baseline` already recorded in `fixtures/demo/intake.json`.

## Session 1

### What you sell
**Owner:** "It's called KeepStrong. Short strength workouts, about 20 minutes, plus protein tracking. The idea is you keep your muscle while the weight comes off on the medication. The website's at example.com/keepstrong."

→ `business.description`, `business.websiteUrl`

### What you've already made
**Skill:** "Do you have ads, landing pages, headlines or CTAs you've already used? Any results?"

**Owner:** "Two Meta ads from September. The results are in the export, meta-ads.csv. I've also got a screenshot of the muscle one, the woman with the kettlebell. And there's a headline I wrote for the website but never used: 'Strength first, scale second', with '20-minute strength workouts and a daily protein target, built for the months you're losing weight.' The button would say 'Start your first workout'."

→ `creatives[]`: `cr_1` (the muscle ad, an image; `px_1`), `cr_2` (the GLP-1 ad, text; `px_2`), linked to the CSV rows by their headlines; `cr_3` (the website draft, no results). The screenshot is fictional, so `cr_1`'s image description is copied from `fixtures/demo/intake.json`, never made up.

**Skill:** reads back the three, each marked "please confirm", and notes once: "Your September GLP-1 ad names a medication. Ad platforms may restrict ads like that, so it's worth knowing before you run it again."

**Owner:** "Fair enough. That's all of them."

### Price
**Owner:** "$14.99 a month. That's not changing, so don't plan around a different price."

**Skill:** "On average, how many payments does a customer make in their first year, counting people who cancel early?"

**Owner:** "About 9. A few drop off after a couple of months."

→ `business.pricing` (USD 14.99/month, 9 payments in the first year on average); price constraint, **locked**

### Traction
**Owner:** "We launched in the spring. Around 90 paying subscribers, mostly friends of friends and a couple of Facebook groups."

→ `business.stage: "launched"`

### Minimum revenue
**Owner** *(vague)*: "Enough that it's a real business, not a hobby."

**Skill follow-up:** "What's the least you'd need coming in over the next 12 months to keep the business going? One dollar figure is fine."

**Owner:** "At least $180,000 a year. Below that, it's a hobby."

→ `business.revenueGoal12mo: 180000` (the minimum revenue needed in a year to sustain or grow the business)

### What a sign-up is worth
**Skill:** "Do you know the most you can spend on ads to win one new paying customer?"

**Owner:** "Honestly, no. I've never worked it out."

**Skill (walk-through):** "Let's back into it. You charge $14.99 a month and a customer pays about 9 times in their first year; the script will turn that into a yearly figure. First, what does it cost you to serve a customer: payment fees, hosting and software, support, the coaching content? Roughly what share of what they pay is that?"

**Owner:** "Payment fees, hosting and the coach who writes the programs... maybe 30% all in."

**Skill:** (runs the validator) "Then you break even in year one if a new customer costs less than the break-even figure the script just worked out. Knowing that, what share of a customer's first-year revenue do you want to spend to win them, keeping some margin for yourself?"

**Owner:** "I'll cap it at 40% of their first year, so I keep some margin."

→ `business.costToServeShare: 0.3`, `business.acquisitionShare: 0.4`, no `targetCpa`. The script computes `business.unitEconomics` (`targetCpaSource: "derived"`) and judges the ads against that max. Don't quote the dollar figure until the script has written it.

### What you've tried
**Owner:** "Just those two Meta campaigns in September, the ones in the CSV I gave you. The muscle one did okay, I think? The GLP-1 one flopped."

→ `priorExperiments` px_1 and px_2, read from `meta-ads.csv` and linked to `cr_1` and `cr_2`. The script decides the verdicts, not the owner's impression.

**Skill:** reads back the campaign numbers from the CSV as draft facts, "please confirm".

**Owner:** "Yes, that's right — 14 sign-ups on the muscle one, 3 on the GLP-1 one."

**Skill:** "Were those sign-ups paying customers, or free trials?"

**Owner:** "Paying. We don't have a free trial."

### What people use instead
**Owner:** "Mostly TrackAll, the big calorie tracker. Or free workout videos online. A lot of people just do nothing structured."

→ `hypotheses[].insteadOf`, `serviceability.incumbents`

### Who it's for (the owner's first guess)
**Owner** *(vague)*: "Honestly? Everyone on these meds."

**Skill follow-up:** "If you could only reach one group of people on these medications next month, who would it be, and what are they doing today?"

**Owner:** "People who just started the medication and are new to fitness. They've never really followed a plan, and they don't know where to start. Right now they're watching free videos, or doing nothing."

→ the owner's guess: `hyp_2` and `seg_2` "New-to-fitness medication starters" (`isOwnerGuess: true`)

### Why people buy
**Owner** *(vague)*: "They want to feel better."

**Skill follow-up:** "Think of one recent customer. What happened that week that made them sign up?"

**Owner:** "A couple of them told me they'd noticed they were getting weaker, carrying groceries, that kind of thing, and they were scared of losing muscle. And everyone's scared of gaining it back once they stop the medication."

→ `hypotheses[].motivation`; research question on muscle-loss worry

### Where
**Owner:** "US only. We can't take payments anywhere else yet."

→ geography, **locked** (`US`)

### Age
**Owner:** "35 to 64. Younger people aren't really our customer, and I don't want to deal with Medicare-age stuff."

→ age range 35–64, **locked** (targeting)

### Health and targeting limits
**Skill:** "Ad platforms don't let you target people by a health condition or a medication, so we'll never aim ads at 'people on GLP-1s.' Research can still study that group. Is that OK?"

**Owner:** "Yes, that makes sense."

→ `healthCondition`, **locked**: no targeting by medication or diagnosis (source: inferred, owner agreed)

### Ad copy rules
**Owner:** "My lawyer was really clear: no medical claims, and never name the drugs by brand in an ad."

→ `regulatory`, **locked** (messaging): no medical claims, no drug brand names

### Channels
**Owner:** "Meta, because I know how it works. And Reddit, because that's where these folks actually talk. I'm open to others if you find a reason."

→ `channel`, **preference** (`meta`, `reddit`)

### Interests
**Owner:** "Strength training and weight loss. Those are the two things they care about."

→ `interest`, **hypothesis** (`strength training`, `weight loss`)

---

## Research turn (between sessions)

The skill runs its capped research turn here. In demo mode, the evidence is the fictional `evidence[]` already in `intake.json`.

## Session 2

### Send-back (the first question of session 2)
**Skill:** "Lots of free apps and videos already target beginners. Is your user mainly protecting muscle, or mainly losing weight?"

**Owner:** "Protecting muscle, if I'm honest. The weight is happening anyway on the medication."

### Findings and the counter-case
The skill shows the two customer groups, what they worry about, the real quotes, the ad results, and the skeptic's counter-case.

**Owner:** "Huh. So the muscle ad was the one that actually worked."

### One pushback on a must-have (age)
**Skill:** "Based on a survey, we estimate about a quarter of US adults on these medications are 25 to 39. Do you want to keep ads limited to 35 to 64?" *(cites ev_15 and the `int_1` age estimate)*

**Owner:** "Keep it at 35 to 64. That's who I built it for."

→ age `pushback: { evidenceIds: ["ev_15"], ownerKept: true }`. Age is never raised again.

### Ranking the customer groups
**Skill:** "Research points to a group you didn't name: **midlife strength protectors**, adults 40–60 losing weight on medication who care more about staying strong than the number on the scale. Your original group is new-to-fitness medication starters. How would you rank them?"

**Owner:** "Midlife strength protectors first. That's exactly the people who email me. The beginners second, maybe later."

→ `seg_1` `ownerRank: 1`; `seg_2` `ownerRank: 2`

### Confirming the brief
**Skill:** reads back the target customer sentence, the must-haves, the disqualifier and the four message lines.

**Owner:** "Yes, that's it. Lock it in."

→ readiness check "Owner confirmed the brief" passes
