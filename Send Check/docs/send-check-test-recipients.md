# Send Check test recipients: fixture roster and real-user sourcing

Oct 25, 2026

## Fixtures, not personas

The design directive stands: verdicts never role-play personas, and the Upworthy result (synthetic persona panels ranked copy worse than no personas) is the reason. But testing still needs recipients. Call them **fixtures**: named recipients defined entirely by observable fields — dates, dollars, counts, thread history. No psychographics. No "busy mom who values convenience."

Each fixture sets a **trap**: the specific thing a one-size blast gets wrong for that recipient. A test passes when Send Check's verdict cites the fact behind the trap. This also supplies the ground truth for the humanization rubric's D5 swap test ("would this sentence be false sent to a different recipient?") — you need at least two recipients per segment for "different" to mean anything.

## Fact schema

Every fixture instantiates these fields. Real-user crawls fill the same fields. Verdicts cite these and nothing else.

- **Identity** — name; type (buyer / end user / consumer / donor / applicant); role, company, industry, headcount (B2B only)
- **Relationship** — first transaction date; tenure; plan, tier, or average ticket; lifetime orders or spend; last interaction date and what it was
- **Money** — payment terms; on-time rate; current balance and days overdue; disputes; grandfathered pricing
- **Engagement** — open/click recency; last inbound message date and register (formal, casual, terse); support tickets; complaint or praise on record
- **Status flags** — lapse length; renewal date; usage trend; no-show count; waitlist join date; review left (stars, date); referral count; event attendance; donor tier and last gift date; application stage reached

Buyer vs. end user matters in every B2B case: the person who reads the email and the person who signs are often different people, and the draft that works on one fails on the other.

## Fixture roster

Five fictional sender businesses, seventeen recipients. Numbers in the last column are the use cases from the Oct 25 doc.

### Brightwell Studio — design agency (B2B services)

| Fixture | Type | Facts | The trap | Covers |
|---|---|---|---|---|
| Marcus Yee, COO, Tidepool Analytics (42-person SaaS) | Buyer | Client since 2020; $8.5K/mo retainer; net-15, never late across 71 invoices; NPS 9 in March survey; emailed praise after the Mar 18 rebrand launch | Collections tone on an invoice reminder insults a flawless payer. A price increase that ignores six years reads as tier-blind. He is the testimonial and referral ask, not the dunning list. | 1, 3, 11, 15; exclusion for 2 |
| Dana Okafor, owner, Grove Dental (solo practice) | Buyer | Client 14 months; $1,200/mo; invoice #2041, $2,400, 37 days overdue; this is the second reminder; her Oct 2 reply: "cash flow is tight after the new chair, paying partial Friday"; opens every email | Ten-year-client warmth is unearned here. Legal-threat voice burns a salvageable account. The verdict should require the partial-payment thread to appear and a plan option to be offered. | 2 |
| Priya Raman, marketing manager, Castline Foods | End user | Day-to-day contact; the CFO signs; renewal Dec 9; logins down 60% since their June rebrand pause; two check-ins unanswered | Renewal copy written for the buyer lands on the user. "Hope you're loving the platform" collides with the usage drop. Flag assumed-active-use. | 3, 4 |
| Jonah Pratt, owner, Pratt & Sons Plumbing (11 trucks) | Cold prospect / buyer | No relationship. Public facts only: Oct 12 LinkedIn post hiring a dispatcher; 4.1 stars across 214 Google reviews; site advertises 24/7 emergency service | The fake-personalization trap. "Love what you're building" cites nothing. A passing draft must cite the dated post or the review record — nothing softer counts. | 12 |

### Loop & Ladle — ecommerce (kitchen goods)

| Fixture | Type | Facts | The trap | Covers |
|---|---|---|---|---|
| Sofia Marin | Consumer | 9 orders in 12 months; last order 11 days ago (cast-iron skillet, $84); average order $64; opens 80% of sends | "We miss you" to an active buyer tells her the sender can't read its own data. She gets launch and upsell voice. Discounts burn margin she'd pay anyway. | 7, 8, 10; exclusion for 6 |
| Derrick Cole | Consumer | 3 orders total; last Feb 14; both purchases in February — gifting pattern; zero opens in 6 months | A draft assuming a lapsed habit ("restock your favorites") misses that he never had one. Gift angle or nothing. This is the demo's lapsed case. | 6 |
| Alma Reyes | Consumer | Order arrived broken Sep 3; refund issued Sep 5; left a 2-star review Sep 6; no orders since | A seasonal promo before a make-good reads as amnesia. A review request here is self-harm. The verdict should sequence the apology (14) before anything else reaches her. | 14; exclusion for 6, 13 |
| Theo Brandt | Consumer | Joined the Dutch oven waitlist Jul 2 (115 days ago); emailed twice asking for an ETA; zero purchases | "Welcome back" to someone who never bought. Urgency copy that ignores a 115-day wait. The verdict wants the wait acknowledged and a hold window stated. | 9 |

### Cedar & Steam — salon and spa

| Fixture | Type | Facts | The trap | Covers |
|---|---|---|---|---|
| Nguyet Tran | Consumer | 26 visits; monthly facial, always books Hana; rebooks same-day; referred 2 clients; pays full price | A percent-off promo trains a full-price loyalist to wait for discounts. She is the review and referral ask. The policy notice barely concerns her. | 10, 11, 13, 16, 18 |
| Kyle Dempsey | Consumer | 3 no-shows in his last 5 bookings; latest Oct 18; the new $45 deposit policy applies to him | A policy notice voiced at everyone but written for him reads as public shaming. His reminder needs the deposit stated flat, without the lecture. | 16, 17 |
| Imani Walsh | Consumer | First visit Oct 21, on a gift-card redemption; hasn't rebooked | "Thanks for your loyalty" on visit one. She hasn't chosen or paid yet. Review timing is right (the BrightLocal 83% window), but the ask must match a first visit. | 13, 18 |
| Shawna Little | Applicant | Applied for the stylist role Mar 2026; reached final interview; declined the offer for another job; said "keep me in mind" | A hiring blast that reads like first contact erases the history. Stage-reached is the fact the verdict must see cited. | 20 |

### FieldKit — micro-SaaS for trades

| Fixture | Type | Facts | The trap | Covers |
|---|---|---|---|---|
| Rosa Delgado, ops manager, Summit Electric | Buyer + user | 4 years; grandfathered at $49/mo against the new $89; daily logins; filed 3 feature requests, 2 shipped | The J. Marketing case: wording moved attrition 29.5% and cost-based framing did no better than silence. Her email must cite tenure and the shipped requests, not "rising costs." | 1, 3, 8 |
| Ben Tooley, owner, solo handyman | Buyer + user (trial, day 9 of 14) | 2 of 6 features activated; no team invited; opened 1 of 4 onboarding emails | Enterprise upsell voice at a solo operator. Launch copy for features he hasn't touched. A save offer before he's shown churn intent. | 4, 7, 8 |
| June Park, admin, Hartley Crane Co. | End user | Sync outage Oct 9, 11 hours, during their payroll run; filed 2 tickets; still logs in daily | The asymmetric-downside case. Severity must be named (11 hours, payroll day), the make-good must match it, and the unaffected must not receive this email at all. | 5, 14 |

### Rainier Trail Alliance — nonprofit

| Fixture | Type | Facts | The trap | Covers |
|---|---|---|---|---|
| Evelyn Marsh | Donor | Six gifts of $2,500, 2019–2024; nothing since Dec 2024; attended 5 galas | A $25-ask template to a $2.5K donor. Guilt framing on a lapse. Against the M+R backdrop (50 emails per subscriber, 16% list loss), this email gets one shot. | 18, 19 |
| Caleb Ortiz | Volunteer, non-donor | 14 trail-work days logged in 2026; zero donations | A donor-voiced appeal ignores that he already gives, in hours. "You haven't given yet" is false on its face. The verdict should require the volunteer record to appear or the ask to change. | 18, 19 |

## Swap-test pairs

A draft that scores the same against both members of a pair is segment-blind — the headline failure Send Check exists to catch.

- Sofia / Derrick — active buyer vs. 8-month lapse
- Marcus / Dana — flawless payer vs. 37 days overdue
- Rosa / Ben — legacy power user vs. day-9 trial solo
- Evelyn / Caleb — lapsed major donor vs. active volunteer
- Nguyet / Kyle — full-price loyalist vs. chronic no-show

## Coverage matrix

| Use case | Primary fixtures | Exclusion fixtures |
|---|---|---|
| 1 Price increase | Marcus, Rosa | — |
| 2 Overdue invoices | Dana | Marcus |
| 3 Renewal | Marcus, Priya, Rosa | — |
| 4 Pause / save | Priya, Ben | — |
| 5 Service failure | June | everyone unaffected |
| 6 Win-back | Derrick | Sofia, Alma |
| 7 Upsell | Sofia, Ben | — |
| 8 Launch | Sofia, Rosa, Ben | — |
| 9 Waitlist release | Theo | — |
| 10 Seasonal promo | Sofia, Nguyet | Alma |
| 11 Referral ask | Nguyet, Marcus | — |
| 12 Cold intro | Jonah | — |
| 13 Review request | Nguyet, Imani | Alma |
| 14 Apology / make-good | Alma, June | — |
| 15 Testimonial ask | Marcus | — |
| 16 Policy change | Kyle, Nguyet | — |
| 17 No-show follow-up | Kyle | — |
| 18 Event invite | Nguyet, Imani, Evelyn, Caleb | — |
| 19 Fundraising appeal | Evelyn, Caleb | — |
| 20 Hiring blast | Shawna | — |

Exclusion means the fixture proves the draft should not reach that segment as written.

## Real users: sourcing and crawling

Three tiers, in the order to use them.

**Tier 1 — consent panel.** Five to ten real people who opt in: current clients, collaborators, friendly SMB owners. They supply real relationship facts (or you already hold the thread history) and can validate verdicts against the only ground truth that matters — would this have landed on me. Use for the client-deliverable and apology cases, where thread tone carries the most weight.

**Tier 2 — public professional figures.** SMB owners and operators with an active public footprint, used for the cold-intro case and realism checks. Selection bar: posts about their business at least monthly, with at least two checkable artifacts — a dated post, a job listing, a launch, a pricing page, a podcast appearance, an owner reply to a review. Someone without two checkable artifacts can't test fake-personalization detection, and that detection is the point.

**Tier 3 — synthetic (this roster).** For the stage demo and automated regression. Fully controlled, covers edge cases on purpose, zero privacy surface.

### Where to crawl, and the access reality

| Source | Access | Notes |
|---|---|---|
| Their own site + blog RSS | Open | Best artifacts: pricing, launches, hiring pages. Respect robots.txt. |
| Newsletter archives (Substack, Beehiiv) | Open | Dated, quotable, stable URLs |
| Podcast appearances | Open | Show notes give dated, checkable quotes |
| Bluesky | Open API | Public firehose; no key gymnastics |
| YouTube | Official API | Channel uploads, dated |
| Google Business Profile | Page-visible | Owner replies to reviews show register and recency |
| X / Twitter | Paid API | Basic tier covers a handful of accounts |
| LinkedIn | No automated collection | Richest source, and its ToS prohibits scraping. Collect manually or through licensed data. Do not automate this one. |
| Reddit | Restricted API | Only where the person is openly themselves |

### Collect / never collect

**Collect:** role, company, industry, headcount signals, dated public statements about the business, hiring posts, launches, pricing changes, review volume, owner replies, event appearances.

**Never collect:** home location, family, health, age, protected attributes, political or religious signals, personal-account content, or any inferred trait ("seems detail-oriented"). Two reasons, one conclusion: inference is the persona trap the Upworthy result killed, and a verdict can only cite what's observable. If it isn't a dated fact about the business, it doesn't enter the schema.

**Sending is a different act than testing.** These profiles are internal test data. Actually emailing Tier 2 people brings CAN-SPAM (permissive for B2B), CASL, and GDPR into play depending on the list. Decide per list before anything leaves the building; this note is a flag, not legal advice.

## Next steps

1. Recruit the consent panel: a one-paragraph opt-in ask to 5–10 people you already correspond with. Give-first framing, one ask, no Calendly in the opener.
2. Nominate five Tier 2 figures against the two-artifact bar and fill the schema manually for each.
3. Wire the 17 fixtures into the test harness as structured rows keyed to the schema, one trap assertion per fixture: *verdict must cite fact X*. A verdict that passes without citing the fact is instrument capture wearing a new coat.
