# Send Check — Test Email Corpus

Oct 25, 2026

Twenty draft emails, one per use case in *Send Check Use Cases*. Each is written the way a real small-business owner writes it: one blast, same coat for every recipient. Each entry includes the fictional business, the recipient list it would go to, the draft itself, and the expected Send Check findings — the per-segment flags the verdict should surface, grounded in observable recipient facts. These are test fixtures: the drafts are *supposed* to contain the failure modes.

---

## Money at risk

### 1. Price-increase announcement

**Business:** Cascade Self Storage, 340 unit renters
**List:** All paying customers — mix of 10-year tenants, month-to-month renters under 6 months, customers who negotiated rates last year, small-business commercial units

**Subject:** Important update about your storage rate

> Hi,
>
> Due to rising operating costs, including insurance, utilities, and property taxes, we will be increasing rates by 12% effective December 1, 2026.
>
> We know price increases are never welcome, but our costs have gone up significantly and we can no longer absorb them.
>
> Thank you for your understanding.
>
> — Cascade Self Storage Management

**Expected flags:**
- All segments: cost-based framing ("our costs went up") — the framing shown to perform no better than silence
- 10-year tenants: no tenure acknowledgment; highest-LTV segment gets the same boilerplate as a 3-month renter
- Negotiated-rate customers: draft implies uniform 12%; contradicts their prior agreement, invites a dispute
- Commercial units: no mention of invoice/billing implications they will actually ask about
- No value framing anywhere (what the customer gets, what hasn't changed)

---

### 2. Overdue-invoice reminders

**Business:** Pioneer Design Co., web/brand studio, 14 open invoices
**List:** Mix — a 10-year retainer client 8 days late (never late before), a new client 45 days late who disputed scope, a chronic late payer at 60+ days

**Subject:** Overdue invoice — immediate payment required

> Hello,
>
> Our records show your invoice is past due. Per our terms, payment was required within 30 days. Please remit payment immediately to avoid late fees and suspension of services.
>
> If payment has already been sent, disregard this notice.
>
> Accounts Receivable, Pioneer Design Co.

**Expected flags:**
- 10-year client at 8 days: threat language ("suspension of services") to a relationship that has never been late; also factually wrong — they aren't past the 30-day term yet
- Scope-dispute client: reminder ignores the open dispute in the thread history; escalates instead of resolving
- Chronic 60+ payer: tone is appropriate here, but "disregard this notice" undercuts urgency; needs a concrete deadline and consequence
- "Accounts Receivable" signature from a 3-person studio reads as fake

---

### 3. Renewal / contract-expiry notice

**Business:** BrightBooks, bookkeeping SaaS, 89 annual plans expiring in 30–60 days
**List:** Heavy daily users, accounts that haven't logged in for 4 months, two accounts that negotiated discounts at last renewal

**Subject:** Your BrightBooks plan renews soon

> Hi there,
>
> Your annual BrightBooks subscription will renew automatically at the current list price of $588/year. No action is needed.
>
> We've added lots of great features this year and we're excited for what's ahead!
>
> The BrightBooks Team

**Expected flags:**
- Discounted accounts: "current list price" silently repricing a negotiated rate — churn trigger and possible terms violation
- Dormant 4-month accounts: "no action needed" auto-renews someone who has stopped using the product; highest cancellation-and-chargeback risk, needs a re-engagement path before the charge
- Heavy users: "lots of great features" is unspecific; this segment would respond to the features they actually use
- Price named with no value recap for anyone

---

### 4. Subscription pause / save offer

**Business:** Emerald Meal Prep, weekly delivery, 56 customers who clicked "manage subscription" this month
**List:** Price-sensitive skippers (skip 2 of 4 weeks), customers whose delivery had quality complaints, customers moving away (zip change on file)

**Subject:** Wait! Before you go — 20% off your next box

> Don't cancel yet!
>
> We'd hate to lose you. Take 20% off your next 3 boxes if you stay. Just click below.
>
> [KEEP MY DISCOUNT]
>
> Emerald Meal Prep

**Expected flags:**
- Quality-complaint customers: a discount answers a complaint they didn't make; ignores the actual churn reason in thread history
- Moving-away customers: discount can't fix geography; correct move is pause/transfer info
- Price-sensitive skippers: right lever, but 3-box horizon mismatches their skip pattern; per-box or skip-friendly framing fits the observed behavior
- "Don't cancel yet!" presumes intent; some recipients only changed delivery day

---

### 5. Service failure apology / recall

**Business:** Sound Roasters, coffee subscription — one roast batch (Oct 12 ship) had a packaging defect affecting ~15% of orders
**List:** Entire customer base, 1,200 people — only 180 received the defective batch

**Subject:** An apology from Sound Roasters

> Dear customers,
>
> We recently became aware of a packaging issue that may have affected your order. We take quality seriously and sincerely apologize for any inconvenience. Affected customers will receive a replacement.
>
> We're sorry we let you down.
>
> Sound Roasters

**Expected flags:**
- Unaffected 85%: blanket apology alarms customers whose orders were fine — "may have affected your order" creates doubt where none existed; send should be scoped to the Oct 12 batch
- Affected customers: no batch identification, no action required/not required, no timeline for the replacement
- "We let you down" overclaims severity for a packaging defect; calibrate to actual impact
- Highest asymmetric downside: recommend splitting into two sends minimum

---

## Revenue recovery and growth

### 6. Win-back lapsed customers

**Business:** Lakeview Pet Grooming, 410 lapsed clients
**List:** Lapsed 3 months (previously every 6 weeks), lapsed 14 months, one-visit-only customers from a Groupon run

**Subject:** We miss you and your pup! 🐶

> It's been a while! Come back and see us — book this month and get $10 off any groom.
>
> We've missed you!
>
> Lakeview Pet Grooming

**Expected flags:**
- 3-month lapsed regulars: "it's been a while" overstates the gap; they may just be on a longer cycle — tone reads needy to a recent regular
- 14-month lapsed: $10 off a $85 service is too weak to reactivate a cold relationship; also no acknowledgment anything may have gone wrong
- Groupon one-timers: these were deal-shoppers, not lapsed regulars; "we've missed you" is false intimacy, and the draft assumes a relationship that never existed
- No pet name / service history personalization despite it being on file

---

### 7. Upsell / cross-sell announcement

**Business:** Rainier IT Services, managed IT for small offices, 62 clients
**List:** Basic-plan clients maxing out ticket volume, premium clients already on the top tier, new clients in onboarding month 1

**Subject:** Upgrade to Rainier Premium and get 24/7 support

> Good news — Rainier Premium is here. Get 24/7 support, priority response, and quarterly security reviews. Upgrade today for just $200/month more.
>
> Rainier IT Services

**Expected flags:**
- Premium clients: pitched an upgrade to the tier they already pay for — signals the sender doesn't know who they are; worst flag in the set
- Onboarding clients: upsell in month 1, before any value delivered
- Basic clients at ticket max: right audience, but the draft never cites their usage ("you filed 14 tickets last month") — the one fact that makes the pitch land

---

### 8. New product or service launch

**Business:** Ballard Bike Works, repair shop launching winter storage service
**List:** Customers with service history — road racers, cargo-bike families, e-bike commuters

**Subject:** NEW: Winter bike storage at Ballard Bike Works

> We're launching winter storage! $35/month includes climate-controlled storage and a spring tune-up. Spots are limited — reserve now.
>
> Ballard Bike Works

**Expected flags:**
- E-bike commuters: they ride through winter; storage is irrelevant and reads as not knowing the customer — suppress or reframe (winterization service instead)
- Cargo-bike families: size/pricing question unaddressed ($35 for a cargo bike?)
- Road racers: right fit; draft fine but misses the spring-tune-up angle tied to their race-season service history
- "Spots are limited" with no number is empty scarcity

---

### 9. Back-in-stock / waitlist release

**Business:** Madrona Ceramics, online shop — the oat-glaze mug set is back
**List:** Waitlist signups from this week, signups from 7 months ago, past purchasers of the same set (likely gift buyers)

**Subject:** It's back: the Oat Glaze Mug Set

> The wait is over! The Oat Glaze set is back in stock. Quantities are limited — order before they're gone again.
>
> Madrona Ceramics

**Expected flags:**
- 7-month waitlisters: "the wait is over" with no acknowledgment of a 7-month wait reads tone-deaf; this segment earned an apology or early-access window
- Past purchasers: "it's back" assumes they want another; gift framing fits their purchase pattern better
- This-week signups: fine as-is — the no-change case Send Check should pass cleanly (negative test)

---

### 10. Seasonal / holiday promotion

**Business:** Alpine Candle Co., ecommerce, holiday sale
**List:** Full-price loyalists (never use codes), discount-only buyers, wholesale accounts on the same list by accident

**Subject:** 🎄 30% OFF EVERYTHING — Holiday Sale starts NOW

> Our biggest sale of the year! 30% off sitewide through Sunday. Stock up on gifts!
>
> Use code HOLIDAY30.
>
> Alpine Candle Co.

**Expected flags:**
- Full-price loyalists: training your best-margin customers to wait for codes; 30% blast erodes the segment that never asked for one
- Wholesale accounts: retail promo to wholesale buyers undercuts their negotiated pricing and invites channel conflict
- Discount buyers: correct audience; fine
- Sitewide 30% with no exclusions stated — support-ticket generator

---

### 11. Referral-program ask

**Business:** Greenwood Tutoring, 95 families
**List:** Families with strong results (grade improvements on file), families mid-complaint about scheduling, families in their first 2 weeks

**Subject:** Know a family who needs tutoring? Get $50!

> Love Greenwood? Refer a friend and you both get $50 off. Share the link below!
>
> Greenwood Tutoring

**Expected flags:**
- Mid-complaint families: asking for a referral during an open complaint thread is the single worst timing available; suppress
- First-2-weeks families: no results yet to refer on; premature
- Strong-results families: right ask, but generic — "love Greenwood?" when their kid's grade improvement is on file and citable
- "You both get $50" ambiguity: off what, when, how

---

### 12. Cold intro to a prospect list

**Business:** Semaphore Payroll, B2B payroll for restaurants, purchased list of 800 owners
**List:** Single-location cafés, 5+ location groups, food trucks, several non-restaurant records (list is dirty)

**Subject:** Quick question about your payroll

> Hi,
>
> I'll keep this short. Most restaurant owners overpay for payroll. Semaphore saves restaurants an average of 20% and handles tip reporting automatically. Worth a 15-minute call?
>
> Best,
> Dana, Semaphore Payroll

**Expected flags:**
- All segments: no recipient fact cited anywhere — pure template; at 0.45% expected reply rate the draft needs role/segment grounding to clear baseline
- Multi-location groups: "owners overpay" framing is wrong buyer (they have controllers/GMs); wrong stakes
- Food trucks: tip-reporting pitch fits, but "restaurant" language misses them
- Dirty records: non-restaurant recipients = complaint risk against the 0.3% Gmail/Yahoo ceiling; flag list hygiene before send, full stop
- Should carry the "last resort / highest domain risk" warning per the use-case doc

---

## Reputation and relationship

### 13. Review requests

**Business:** Fremont Family Dental, 220 patients seen this quarter
**List:** Patients seen this week, patients from 2+ months ago, patients with an unresolved billing issue

**Subject:** How was your visit? Leave us a review!

> Thanks for visiting Fremont Family Dental! If you have a moment, please leave us a 5-star review on Google. It really helps our small practice.
>
> [LEAVE A REVIEW]

**Expected flags:**
- "5-star review" ask: soliciting a specific rating violates Google policy — flag regardless of segment
- 2+ month patients: recency gone; ask quality drops with time since visit, adapt or drop
- Billing-issue patients: do NOT filter them out (review gating) — flag is *timing*: resolve the billing thread first, then ask the same ask
- This-week patients: correct timing; strip the star language and it passes

---

### 14. Apology / make-good after a bad-review wave

**Business:** Interbay Auto Repair — three 1-star reviews in two weeks, all about one departed technician's work
**List:** Entire customer base (600); only 22 customers were serviced by that technician in the window

**Subject:** We're making things right

> You may have seen some recent reviews about our shop. We want you to know we hear you, we've made staffing changes, and anyone unhappy with recent work gets a free re-inspection.
>
> Interbay Auto Repair

**Expected flags:**
- 578 unaffected customers: broadcasting the bad reviews to people who never saw them — manufactures doubt; suppress or send a quality-commitment message with no review reference
- 22 affected customers: these deserve a direct, specific message naming the service window and the concrete remedy — the blast underserves exactly the people it exists for
- "Staffing changes" is vague enough to worry everyone and satisfy no one

---

### 21. Tour operator apology sent to the whole past-guest list

**Business:** Saltwind Kayak & Whale Tours, a husband-and-wife outfit on Larkspur Island. In August their hired ferry-pickup shuttle no-showed twice (Aug 9, Aug 16), 31 guests missed tours they had paid for, and four 2-star reviews followed. The owners now drive the pickup van themselves. No one on staff manages email; the draft came from an AI writing tool and went to everyone.
**List:** Entire past-guest list since 2019 (520) — the 31 guests stranded at the ferry terminal when the shuttle no-showed in August (missed tours they had paid for), 58 guests with a 2027 trip already booked and deposit paid, repeat guests with 3+ trips and no problems on file, one-time guests from 2019–2023 who have not heard from us in years

**Subject:** An apology from all of us at Saltwind

> Hi there!
>
> You may have seen some recent reviews mentioning problems with our tours this summer. We want you to know we hear you, and we're truly sorry. We've made some changes to our transportation partners to make sure it never happens again.
>
> As a thank-you for your patience, anyone who had a less-than-perfect experience with us can enjoy 20% off their next adventure. Just reply to this email!
>
> Warmly,
> The Saltwind Team

**Expected flags:**
- Unaffected guests (489 of 520): the draft points them to reviews they never read and "problems with our tours" they never had — manufactures doubt about a business they trust; suppress, or send a no-incident seasonal note with no review reference
- 2027 deposit holders: "problems with our tours" plus "changes to our transportation partners" months before their trip invites worry about their own pickup and early cancel/refund requests; they need logistics reassurance (who meets them at the ferry), not an apology
- Stranded 31: they paid for a tour they never got; 20% off a future trip reads as an upsell, not a make-good — they need a direct message naming the date and the shuttle no-show, plus a full refund or a free rebooked trip
- "Anyone who had a less-than-perfect experience" plus "just reply" is an open-ended offer to 520 people: unaffected guests can claim it, an uncapped cost for a two-person business, and every reply lands in the owners' one inbox
- "Transportation partners" is vague: it never says what happened (shuttle no-show at the ferry) or what changed (the owners drive the van now), so it worries everyone and reassures no one
- One-time 2019–2023 guests: the first email in years is an apology for something they were not part of — the wrong reintroduction; a dormant segment gets a welcome-back or nothing

---

### 15. Testimonial / case-study ask

**Business:** Northgate Marketing Studio, 30 B2B clients
**List:** A client whose campaign tripled leads, clients with ordinary results, a client whose contract is in renegotiation

**Subject:** Can we feature you?

> Hi!
>
> We're putting together case studies and would love to feature your business. It's great exposure for you too! Just reply and we'll send over some questions.
>
> Northgate Marketing Studio

**Expected flags:**
- Tripled-leads client: the one fact that makes this ask land (their result) is on file and unused — specific asks convert, generic asks burn goodwill
- Ordinary-results clients: "feature you" with nothing to feature; either skip or reframe as feedback ask
- Renegotiation client: asking for a favor mid-negotiation reads as leverage-seeking; suppress until closed
- "Great exposure for you too!" is seller-benefit dressed as recipient-benefit

---

## Operations, scheduling, and niche verticals

### 16. Policy change notice

**Business:** Columbia City Yoga, new 12-hour cancellation policy (was 4)
**List:** Daily members, drop-in occasional attendees, members on medical hold

**Subject:** Updated cancellation policy

> Starting November 1, class cancellations require 12 hours' notice or a $15 fee will apply. This helps us keep classes available for everyone.
>
> Columbia City Yoga

**Expected flags:**
- Mostly clean — the judge-question deflection case: the policy is uniform, so uniform wording is largely correct
- Medical-hold members: fee language to people who can't attend at all; exempt or address
- Drop-ins: unclear whether the fee applies to class packs vs memberships — the one genuine per-segment ambiguity
- Expected verdict: minor flags only; a good negative/low-severity test

---

### 17. No-show follow-ups / appointment reminders

**Business:** Delridge Hair Studio
**List:** First-time no-show (10-year client), 3rd no-show this quarter, a client the stylist actually double-booked (shop's fault, logged in notes)

**Subject:** You missed your appointment

> Our records show you missed your scheduled appointment. Please note that repeated no-shows may result in a required deposit for future bookings.
>
> Delridge Hair Studio

**Expected flags:**
- 10-year first-timer: deposit threat on a first miss in a decade — relationship damage for zero policy gain
- Double-booked client: the "no-show" was the shop's error per the appointment notes; sending this is an apology owed delivered as an accusation — highest-severity flag
- 3rd-time no-show: appropriate tone, but should state the policy concretely (deposit amount, effective when), not "may result"

---

### 18. Event / workshop / open-house invite

**Business:** Georgetown Pottery Studio, holiday open house + intro wheel workshop
**List:** Past workshop attendees, newsletter-only subscribers who've never visited, members with studio access

**Subject:** You're invited: Holiday Open House 🎉

> Join us Dec 6 for our Holiday Open House! Try the wheel, shop the member sale, and enjoy cider. First-timers welcome!
>
> Georgetown Pottery Studio

**Expected flags:**
- Members: "try the wheel" and "first-timers welcome" to people with 24/7 studio access — wrong frame; their hook is the member sale and bringing guests
- Past workshop attendees: "try the wheel" to people who already did; next-step framing (intermediate workshop) fits their history
- Never-visited subscribers: draft actually fits this segment as-is
- Three audiences, one invitation — classic split-the-send case

---

### 19. Nonprofit fundraising appeal

**Business:** Duwamish River Youth Sailing, year-end appeal
**List:** Major donors ($1K+ annual), lapsed donors (gave 2023, nothing since), active volunteers who've never donated, monthly $10 donors

**Subject:** We need your help before Dec 31

> Dear friend,
>
> This year, 200 kids learned to sail because of supporters like you. But we're $40,000 short of our year-end goal. Please give today — every dollar counts.
>
> [DONATE NOW]

**Expected flags:**
- Major donors: "every dollar counts" + generic ask to four-figure givers; this segment gets a call or a named-amount ask, not the blast
- Volunteers-never-donated: "supporters like you" is accurate but the ask ignores that they already give time; acknowledge it or the ask reads blind
- Monthly donors: "please give today" to people already giving monthly — the #1 unsubscribe trigger in the segment; upgrade ask or gratitude framing instead
- Lapsed donors: draft works, but no acknowledgment of their 2023 gift
- Sector context: 50 emails/subscriber/year and 16% list loss — every blind blast spends list equity

---

### 20. Hiring blast to past applicants

**Business:** Othello Hardware, hiring two floor associates and one assistant manager
**List:** Past applicants — some rejected at résumé stage, some who interviewed well but lost to another candidate, one former employee who left on good terms

**Subject:** We're hiring again — apply now!

> Othello Hardware is hiring! We have openings for floor associates and an assistant manager. If you applied before, we'd love to hear from you again. Apply through the link below.
>
> Othello Hardware

**Expected flags:**
- Interviewed-well candidates: "apply through the link" sends warm, pre-vetted talent back to the cold top of the funnel; these deserve a direct note referencing their interview and a skip-ahead path
- Résumé-stage rejects: fine for the associate roles, but inviting them to the assistant-manager posting ignores why they were screened out — scope the role per prior stage reached
- Former employee: a blast template to someone who worked there; the one name on this list that warrants a personal email, not a campaign

---

## Using this corpus

- Each draft is a *should-flag* fixture except where noted (9's this-week segment, 16 overall) — those are the negative tests that keep Send Check from crying wolf.
- Every expected flag is traceable to a recipient fact (tenure, payment history, usage, purchase/service history, thread state, role, list hygiene). No flag should require persona inference — that's the design directive.
- Severity ordering for scoring tests: 17 (double-booked accusation), 7 (upsell to premium), 5 (blanket recall) are the high-severity anchors; 16 is the low-severity anchor.
