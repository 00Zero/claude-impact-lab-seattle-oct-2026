# Send Check fixture eval

Fixtures: 20. Judge and grader model: `claude-opus-5-5` (judge overridable with SENDCHECK_JUDGE_MODEL).

**Expected problems caught: 56 of 71.**
**Clean cases passed without false alarms: 6 of 7.**

| # | Fixture | Verdict | Segments | Caught |
|---|---|---|---|---|
| 1 | 1. Price-increase announcement | fix 62 | 10-year tenants: fix 61, month-to-month renters under 6 months: fix 62, customers who negotiated rates last year: fix 60, small-business commercial units: fix 67 | 5/5 |
| 2 | 2. Overdue-invoice reminders | scrap 59 | a 10-year retainer client 8 days late (never late before): fix 60, a new client 45 days late who disputed scope: scrap 44, a chronic late payer at 60+ days: fix 74 | 3/4 |
| 3 | 3. Renewal / contract-expiry notice | scrap 66 | Heavy daily users: send 87, accounts that haven't logged in for 4 months: fix 66, two accounts that negotiated discounts at last renewal: scrap 44 | 3/4 |
| 4 | 4. Subscription pause / save offer | fix 68 | Price-sensitive skippers (skip 2 of 4 weeks): send 79, customers whose delivery had quality complaints: fix 64, customers moving away (zip change on file): fix 61 | 4/4 |
| 5 | 5. Service failure apology / recall | scrap 58 | Affected: 180 received the defective batch: fix 73, Not affected: the rest of the list (Entire customer base, 1,200 people): scrap 44 | 3/4 |
| 6 | 6. Win-back lapsed customers | fix 77 | Lapsed 3 months (previously every 6 weeks): send 88, lapsed 14 months: send 77, one-visit-only customers from a Groupon run: fix 66 | 1/4 |
| 7 | 7. Upsell / cross-sell announcement | scrap 61 | Basic-plan clients maxing out ticket volume: send 78, premium clients already on the top tier: scrap 44, new clients in onboarding month 1: fix 62 | 3/3 |
| 8 | 8. New product or service launch | fix 76 | road racers: send 84, cargo-bike families: fix 68, e-bike commuters: send 75 | 3/4 |
| 9 | 9. Back-in-stock / waitlist release | fix 76 | Waitlist signups from this week: send 84, signups from 7 months ago: send 78, past purchasers of the same set (likely gift buyers): fix 67 | 2/3 |
| 10 | 10. Seasonal / holiday promotion | scrap 69 | Full-price loyalists (never use codes): fix 72, discount-only buyers: send 90, wholesale accounts on the same list by accident: scrap 44 | 4/4 |
| 11 | 11. Referral-program ask | scrap 65 | Families with strong results (grade improvements on file): send 82, families mid-complaint about scheduling: scrap 44, families in their first 2 weeks: fix 70 | 4/4 |
| 12 | 12. Cold intro to a prospect list | scrap 70 | Single-location cafés: send 87, 5+ location groups: send 78, food trucks: fix 71, several non-restaurant records (list is dirty): scrap 44 | 2/5 |
| 13 | 13. Review requests | scrap 72 | Patients seen this week: send 90, patients from 2+ months ago: send 81, patients with an unresolved billing issue: scrap 44 | 3/4 |
| 14 | 14. Apology / make-good after a bad-review wave | scrap 56 | Affected: 22 customers were serviced by that technician in the window: fix 68, Not affected: the rest of the list (Entire customer base (600)): scrap 44 | 3/3 |
| 15 | 15. Testimonial / case-study ask | scrap 62 | A client whose campaign tripled leads: fix 74, clients with ordinary results: fix 68, a client whose contract is in renegotiation: scrap 44 | 4/4 |
| 16 | 16. Policy change notice | fix 73 | Daily members: send 79, drop-in occasional attendees: fix 74, members on medical hold: fix 66 | 3/4 |
| 17 | 17. No-show follow-ups / appointment reminders | scrap 57 | First-time no-show (10-year client): fix 62, 3rd no-show this quarter: fix 68, a client the stylist actually double-booked (shop's fault, logged in notes): scrap 42 | 3/3 |
| 18 | 18. Event / workshop / open-house invite | send 80 | Past workshop attendees: send 80, newsletter-only subscribers who've never visited: send 80, members with studio access: send 80 | 3/4 |
| 19 | 19. Nonprofit fundraising appeal | fix 70 | Major donors ($1K+ annual): fix 66, lapsed donors (gave 2023, nothing since): fix 72, active volunteers who've never donated: fix 69, monthly $10 donors: fix 72 | 4/5 |
| 20 | 20. Hiring blast to past applicants | fix 75 | some rejected at résumé stage: send 78, some who interviewed well but lost to another candidate: fix 73, one former employee who left on good terms: fix 74 | 2/3 |

## Flag by flag

### 1. Price-increase announcement
- **caught**: All segments: cost-based framing ("our costs went up") — the framing shown to perform no better than silence  
  Every segment's recipient_fit flags the cost explanation as doing no better than giving no reason, and suggests dropping it.
- **caught**: 10-year tenants: no tenure acknowledgment; highest-LTV segment gets the same boilerplate as a 3-month renter  
  The 10-year segment says the message gives a 10-year tenant the same notice as someone who moved in last month and nothing acknowledges their tenure. The suggested fix opens by thanking them for 10 years.
- **caught**: Negotiated-rate customers: draft implies uniform 12%; contradicts their prior agreement, invites a dispute  
  It notes the draft reads as if they pay the standard price and that a blanket 12% may conflict with last year's agreement. It also says the draft invites them to negotiate again and suggests stating whether the agreement is honored.
- **caught**: Commercial units: no mention of invoice/billing implications they will actually ask about  
  The commercial segment says the draft gives no billing details a business needs (invoices, PO numbers, autopay). The suggested fix adds a billing section.
- **caught**: No value framing anywhere (what the customer gets, what hasn't changed)  
  All four segments flag that nothing says what stays the same or what they keep. Each suggested fix adds a 'nothing else changes' line.

### 2. Overdue-invoice reminders
- **MISSED**: 10-year client at 8 days: threat language ("suspension of services") to a relationship that has never been late; also factually wrong — they aren't past the 30-day term yet  
  Send Check caught the threat language as out of proportion for a 10-year, never-late client. It missed the factual error: it never notes that at 8 days the client isn't past the 30-day term, and its rewrite still treats the invoice as past due.
- **caught**: Scope-dispute client: reminder ignores the open dispute in the thread history; escalates instead of resolving  
  Send Check says the draft ignores the open scope dispute and that a standard overdue notice will harden the client's position. It recommends acknowledging and resolving the dispute before asking for payment.
- **caught**: Chronic 60+ payer: tone is appropriate here, but "disregard this notice" undercuts urgency; needs a concrete deadline and consequence  
  Send Check says the firm tone fits but there is no actual deadline or specific consequence, and asks for a pay-by date and what pauses. Its rewrite replaces "disregard this notice" with a request to reply with payment details.
- **caught**: "Accounts Receivable" signature from a 3-person studio reads as fake  
  Send Check flags the "Accounts Receivable" department sign-off in every segment as anonymous and impersonal for a studio. It recommends signing with a real person's name.

### 3. Renewal / contract-expiry notice
- **caught**: Discounted accounts: "current list price" silently repricing a negotiated rate — churn trigger and possible terms violation  
  The discounted segment says quoting list price contradicts the prior agreement, could charge more than agreed, and invites a dispute or cancellation.
- **caught**: Dormant 4-month accounts: "no action needed" auto-renews someone who has stopped using the product; highest cancellation-and-chargeback risk, needs a re-engagement path before the charge  
  The dormant segment flags "No action is needed" as nudging inactive users toward an unexpected $588 charge, inviting refunds and chargebacks. The suggestion and fix add a heads-up, a cancel path and a re-engagement walkthrough.
- **caught**: Heavy users: "lots of great features" is unspecific; this segment would respond to the features they actually use  
  The heavy-users segment notes daily users care most about specific features, that none are named, and suggests naming features they would touch.
- **MISSED**: Price named with no value recap for anyone  
  The price-versus-value link appears only for the discounted segment, and only as a feature-specificity point. It was never raised as a draft-wide gap; the only draft-wide gaps listed were the missing renewal date and how to manage the plan.

### 4. Subscription pause / save offer
- **caught**: Quality-complaint customers: a discount answers a complaint they didn't make; ignores the actual churn reason in thread history  
  The quality-complaint segment notes the draft never mentions the bad delivery. It says the discount without an apology or a fix reads as brushing off the complaint, and it rewrites the email apology-first.
- **caught**: Moving-away customers: discount can't fix geography; correct move is pause/transfer info  
  The movers segment says a discount is the wrong offer for someone who may not get deliveries at the new home. Its rewrite centers on updating the address and service-area info, which covers the transfer part of the correct move.
- **caught**: Price-sensitive skippers: right lever, but 3-box horizon mismatches their skip pattern; per-box or skip-friendly framing fits the observed behavior  
  The skippers segment calls the discount the right lever and flags that '3 boxes' is unclear given they skip 2 of 4 weeks. It suggests applying the discount to boxes actually received and letting them keep skipping, which is skip-friendly framing.
- **caught**: "Don't cancel yet!" presumes intent; some recipients only changed delivery day  
  The skippers segment says "Don't cancel yet!" assumes they're leaving, when they may have clicked manage subscription just to skip a week. It suggests softening the opening, which matches the presumed-intent problem.

### 5. Service failure apology / recall
- **caught**: Unaffected 85%: blanket apology alarms customers whose orders were fine — "may have affected your order" creates doubt where none existed; send should be scoped to the Oct 12 batch  
  The unaffected segment explicitly flags that "may have affected your order" tells 1,200 unaffected customers their coffee might be bad. It recommends sending the apology only to affected customers and notes the Oct 12 batch is never named.
- **caught**: Affected customers: no batch identification, no action required/not required, no timeline for the replacement  
  The affected segment's evidence names all three gaps: the batch and ship date (Oct 12) are never named, it isn't clear whether customers need to act, and there's no ship date for the replacement. The suggested fix addresses each one.
- **MISSED**: "We let you down" overclaims severity for a packaging defect; calibrate to actual impact  
  Send Check praised the closing apology for affected customers as "good" and kept it in the fix. Its only comment on the line was for unaffected customers, where it called it misdirected, not overclaimed. It never raised severity calibration.
- **caught**: Highest asymmetric downside: recommend splitting into two sends minimum  
  The unaffected segment recommends sending the apology and replacement details only to affected customers and skipping this group or sending a short reassurance. That amounts to splitting the send by segment.

### 6. Win-back lapsed customers
- **MISSED**: 3-month lapsed regulars: "it's been a while" overstates the gap; they may just be on a longer cycle — tone reads needy to a recent regular  
  Send Check explicitly said "It's been a while!" fits this segment and called "We've missed you!" honest. It never raised the overstated gap or the needy tone, and it scored the segment 88/send.
- **MISSED**: 14-month lapsed: $10 off a $85 service is too weak to reactivate a cold relationship; also no acknowledgment anything may have gone wrong  
  The weak $10 offer was flagged, but the second half was missed: Send Check never noted that the draft fails to acknowledge something may have gone wrong. It also scored the segment 77/send.
- **caught**: Groupon one-timers: these were deal-shoppers, not lapsed regulars; "we've missed you" is false intimacy, and the draft assumes a relationship that never existed  
  Send Check said the draft talks to them like regulars when they never were, called the tone false familiarity, and said it assumes a routine that never existed. Its rewrite drops the 'missed you' framing.
- **MISSED**: No pet name / service history personalization despite it being on file  
  Pet-name personalization was never raised. The only nearby comment was mentioning the every-6-weeks routine for one segment, which is not a draft-wide call to use on-file pet and service data.

### 7. Upsell / cross-sell announcement
- **caught**: Premium clients: pitched an upgrade to the tier they already pay for — signals the sender doesn't know who they are; worst flag in the set  
  Premium segment scored scrap/44 (lowest). Evidence says the draft pitches an upgrade to people already on the top plan and asks them to pay for a tier they have. It recommends removing them from the list.
- **caught**: Onboarding clients: upsell in month 1, before any value delivered  
  Evidence calls a $200/month 'today' ask before they've finished setting up the wrong ask. It suggests holding the message until onboarding is done, and the rewrite frames Premium as an option for later.
- **caught**: Basic clients at ticket max: right audience, but the draft never cites their usage ("you filed 14 tickets last month") — the one fact that makes the pitch land  
  Personalization evidence says the draft never mentions that they're maxing out ticket volume and reads the same to a low-ticket client. It suggests opening with their ticket usage as the reason they're hearing about Premium, and it notes the offer itself fits.

### 8. New product or service launch
- **MISSED**: E-bike commuters: they ride through winter; storage is irrelevant and reads as not knowing the customer — suppress or reframe (winterization service instead)  
  Send Check noted some commuters ride all year but still treated storage as a good fit (battery care) and scored the segment send (75). It never recommended suppressing the send or reframing it as a winterization service.
- **caught**: Cargo-bike families: size/pricing question unaddressed ($35 for a cargo bike?)  
  Send Check explicitly flagged that it is unclear whether cargo bikes fit and whether the flat $35 applies. Its rewrite adds cargo-specific pricing and spot count.
- **caught** (clean case): Road racers: right fit; draft fine but misses the spring-tune-up angle tied to their race-season service history  
  Send Check scored road racers send (84), raised no real problem, and suggested tying the spring tune-up to race season.
- **caught**: "Spots are limited" with no number is empty scarcity  
  Send Check flagged in every segment that "Spots are limited" gives no number and reads as pressure, and suggested giving the real count or dropping the line.

### 9. Back-in-stock / waitlist release
- **MISSED**: 7-month waitlisters: "the wait is over" with no acknowledgment of a 7-month wait reads tone-deaf; this segment earned an apology or early-access window  
  Send Check flagged that seven-month signups may not remember joining and suggested a reminder line. It never said the cheerful opener is tone-deaf after a long wait, and it never suggested an apology or early access. It also scored the segment send (78).
- **caught**: Past purchasers: "it's back" assumes they want another; gift framing fits their purchase pattern better  
  Send Check noted that the restock pitch suits people who missed out, not owners of the set. It recommended gift framing ("easy to give again"), and its rewrite for this segment uses that framing.
- **caught** (clean case): This-week signups: fine as-is — the no-change case Send Check should pass cleanly (negative test)  
  Send Check scored this segment send at 84. Its comments here were the cross-segment points (vague scarcity, no link, em dash) plus a minor note about mentioning the waitlist. It raised no segment-specific problem.

### 10. Seasonal / holiday promotion
- **caught**: Full-price loyalists: training your best-margin customers to wait for codes; 30% blast erodes the segment that never asked for one  
  Recipient_fit evidence says the 30% blanket discount is more than this group needs and 'can teach your best customers to wait for sales.' The suggestion asks whether the group needs the discount at all.
- **caught**: Wholesale accounts: retail promo to wholesale buyers undercuts their negotiated pricing and invites channel conflict  
  Scored scrap 44. Evidence says the code invites buying at a retail discount instead of wholesale terms, 'muddies your pricing with stockists,' and that the site is undercutting shops that sell the candles. That is the pricing undercut and the channel conflict.
- **caught** (clean case): Discount buyers: correct audience; fine  
  Scored send at 90. The only note is a minor suggestion to state the code's limits, which is not a real problem with the fit.
- **caught**: Sitewide 30% with no exclusions stated — support-ticket generator  
  The discount-buyers evidence notes the draft doesn't say whether HOLIDAY30 stacks or excludes anything, leaving out 'a limit they're likely to ask about.' The suggestion is to add a line on limits 'so discount shoppers don't have to ask.' That matches the missing-exclusions and inbound-questions substance, though it was raised only for this segment.

### 11. Referral-program ask
- **caught**: Mid-complaint families: asking for a referral during an open complaint thread is the single worst timing available; suppress  
  Scored scrap (44). Send Check says the referral ask during an unresolved complaint is tone-deaf and recommends taking this group off the referral send list.
- **caught**: First-2-weeks families: no results yet to refer on; premature  
  Send Check notes these families 'haven't seen results yet' and that asking before they've seen progress is 'an early ask', scoring the segment fix (70). It softens the ask rather than holding it, but it names the same problem.
- **caught**: Strong-results families: right ask, but generic — "love Greenwood?" when their kid's grade improvement is on file and citable  
  Send Check says the referral offer fits this group, but 'Love Greenwood?' ignores the grade improvement on file. It suggests opening with the child's improvement.
- **caught**: "You both get $50" ambiguity: off what, when, how  
  Send Check flags that '$50 off' doesn't say off what, when it applies, or any limits (strong-results and first-2-weeks segments). Its rewrite adds a placeholder for what the credit applies to.

### 12. Cold intro to a prospect list
- **MISSED**: All segments: no recipient fact cited anywhere — pure template; at 0.45% expected reply rate the draft needs role/segment grounding to clear baseline  
  Send Check passed cafés at 87 and 5+ groups at 78 as 'send'. It never flagged the draft as a pure template that fails across all segments, and never raised the low-reply baseline.
- **MISSED**: Multi-location groups: "owners overpay" framing is wrong buyer (they have controllers/GMs); wrong stakes  
  For 5+ groups it only asked for multi-location product details. It never said the owner is the wrong buyer or that controllers or GMs are the real audience, and it scored the segment 'send'.
- **caught**: Food trucks: tip-reporting pitch fits, but "restaurant" language misses them  
  It flagged that 'restaurant owners' addresses food truck owners wrongly, and its rewrite names the food truck while keeping the tip reporting pitch.
- **caught**: Dirty records: non-restaurant recipients = complaint risk against the 0.3% Gmail/Yahoo ceiling; flag list hygiene before send, full stop  
  It said the email reads as spam and hurts sender reputation, and told the user to filter the list to confirmed restaurants and remove non-restaurant records before sending.
- **MISSED**: Should carry the "last resort / highest domain risk" warning per the use-case doc  
  There is no overall warning that a cold purchased-list send is a last resort or carries the highest domain risk. It only mentioned sender reputation for the dirty segment and opt-out hygiene for cafés.

### 13. Review requests
- **caught**: "5-star review" ask: soliciting a specific rating violates Google policy — flag regardless of segment  
  All three segments flag the 5-star ask, citing Google's policy against steering ratings, and suggest asking for an honest review.
- **caught**: 2+ month patients: recency gone; ask quality drops with time since visit, adapt or drop  
  For the 2+ month segment, Send Check notes the draft reads like a next-day note, ignores the time gap and feels out of the blue. It suggests acknowledging the delay, which is an adaptation.
- **MISSED**: Billing-issue patients: do NOT filter them out (review gating) — flag is *timing*: resolve the billing thread first, then ask the same ask  
  One suggestion says to remove this group 'until their billing issue is resolved', but another says to 'leave the review request out entirely'. It never says to send the same ask once the issue is resolved and never mentions the review-gating risk, so the advice leans toward filtering them out rather than delaying.
- **caught** (clean case): This-week patients: correct timing; strip the star language and it passes  
  This-week patients scored 90 (send) and the timing was confirmed as right. The only real issue raised was the 5-star language. Its evidence quotes a 'How was your visit?' line that is not in the draft, but that does not count as a raised problem.

### 14. Apology / make-good after a bad-review wave
- **caught**: 578 unaffected customers: broadcasting the bad reviews to people who never saw them — manufactures doubt; suppress or send a quality-commitment message with no review reference  
  The not-affected segment says the apology points them to bad reviews they probably haven't read. It also says it inflates the issue into a shop-wide problem and recommends not sending to them, which is the suppress option.
- **caught**: 22 affected customers: these deserve a direct, specific message naming the service window and the concrete remedy — the blast underserves exactly the people it exists for  
  The affected segment notes the draft never says they were serviced in the window, and that the offer is conditional and has no booking details. Its suggested fix names the date window and offers a free re-inspection outright with a way to book.
- **caught**: "Staffing changes" is vague enough to worry everyone and satisfy no one  
  Both segments flag it. For the affected group it is too vague to tell whether their car was touched, which leaves them unsatisfied. For the unaffected group it 'makes happy customers wonder what else changed', which worries them.

### 15. Testimonial / case-study ask
- **caught**: Tripled-leads client: the one fact that makes this ask land (their result) is on file and unused — specific asks convert, generic asks burn goodwill  
  Personalization evidence says the draft never mentions the tripled leads, even though that result is why they're being asked. The suggested fix opens with 'Your campaign tripled your leads.'
- **caught**: Ordinary-results clients: "feature you" with nothing to feature; either skip or reframe as feedback ask  
  Send Check names the core problem: these clients 'may wonder what there is to feature' and may worry about being tied to unremarkable numbers. It recommends reframing the story around the process or working relationship. That is not the skip-or-feedback-ask remedy in the flag, but it recognizes the same mismatch and reframes the ask.
- **caught**: Renegotiation client: asking for a favor mid-negotiation reads as leverage-seeking; suppress until closed  
  Evidence says asking a favor mid-negotiation 'can look like you're trying to get something for free or gain leverage.' The suggestions say to hold the message or take this client off the list until the new contract is signed. No fix was written, and the verdict is scrap.
- **caught**: "Great exposure for you too!" is seller-benefit dressed as recipient-benefit  
  All three segments flag that the case study mainly helps the studio while the line frames it as the recipient's benefit. The suggestions say to drop the line or be honest that the case study helps the studio.

### 16. Policy change notice
- **caught** (clean case): Mostly clean — the judge-question deflection case: the policy is uniform, so uniform wording is largely correct  
  The overall score is 73. Daily members scored send at 79. Send Check praised the uniform rationale line and marked the shared gaps (no greeting) as minor and applying to every group. It did not demand a rewrite of the uniform policy wording.
- **caught**: Medical-hold members: fee language to people who can't attend at all; exempt or address  
  For the medical-hold segment, Send Check said the $15 fee likely doesn't fit people who aren't attending and that they need to know whether they're exempt. Its rewrite frames the notice as a heads-up for when they return and adds a placeholder on whether the fee applies during the hold.
- **caught**: Drop-ins: unclear whether the fee applies to class packs vs memberships — the one genuine per-segment ambiguity  
  For drop-ins, Send Check flagged that the draft doesn't say whether or how the fee applies to them (booked ahead vs walk-in) or how it's collected. That is the same fee-applicability ambiguity for this group, though it isn't framed as class packs vs memberships.
- **MISSED** (clean case): Expected verdict: minor flags only; a good negative/low-severity test  
  Send Check returned an overall 'fix' verdict with 2 of 3 segments needing changes. Medical hold scored 66, with recipient_fit at 40. That is more than minor flags only.

### 17. No-show follow-ups / appointment reminders
- **caught**: 10-year first-timer: deposit threat on a first miss in a decade — relationship damage for zero policy gain  
  Send Check says a deposit warning on a first miss after 10 years risks losing a loyal client. It suggests dropping the warning for this segment.
- **caught**: Double-booked client: the "no-show" was the shop's error per the appointment notes; sending this is an apology owed delivered as an accusation — highest-severity flag  
  Send Check scrapped this segment at 42, its lowest score. It notes the shop's own records show the mistake was the shop's and calls for an apology instead of a no-show warning.
- **caught**: 3rd-time no-show: appropriate tone, but should state the policy concretely (deposit amount, effective when), not "may result"  
  Send Check flags "may result" as the wrong strength and notes the missing amount and terms. Its suggested fix states the deposit applies from now on and includes an amount placeholder.

### 18. Event / workshop / open-house invite
- **caught**: Members: "try the wheel" and "first-timers welcome" to people with 24/7 studio access — wrong frame; their hook is the member sale and bringing guests  
  Members recipient_fit says "Try the wheel" and "First-timers welcome!" are written for newcomers who already use the wheel. It names the member sale as the right hook and suggests a bring-a-friend invite instead.
- **caught**: Past workshop attendees: "try the wheel" to people who already did; next-step framing (intermediate workshop) fits their history  
  Personalization evidence for this segment says "First-timers welcome!" and "Try the wheel" are newcomer lines and that nothing acknowledges they've already been in. The core wrong-frame problem is caught, though the suggested fix is a welcome-back line rather than an intermediate-workshop next step.
- **caught** (clean case): Never-visited subscribers: draft actually fits this segment as-is  
  Scored 80/send and said "First-timers welcome" and "Try the wheel" fit this group. The only issues raised are minor: member-sale clarity and the missing time/address that affects every segment.
- **MISSED**: Three audiences, one invitation — classic split-the-send case  
  The overall verdict is send at 80 with the summary "all 3 segments ready to send". Send Check never recommends splitting the send or writing separate versions, and no per-segment fixes were written.

### 19. Nonprofit fundraising appeal
- **caught**: Major donors: "every dollar counts" + generic ask to four-figure givers; this segment gets a call or a named-amount ask, not the blast  
  Send Check said "every dollar counts" sizes the ask for small givers and that "Please give today" plus the button is a mass-appeal ask. It said this group expects a suggested amount and a person to contact, and its rewrite asks for a specific renewed gift.
- **caught**: Volunteers-never-donated: "supporters like you" is accurate but the ask ignores that they already give time; acknowledge it or the ask reads blind  
  Send Check said "supporters like you" never mentions that these readers already give their time, and suggested thanking them for volunteering first. Its rewrite does this.
- **caught**: Monthly donors: "please give today" to people already giving monthly — the #1 unsubscribe trigger in the segment; upgrade ask or gratitude framing instead  
  Send Check flagged that "Please give today" ignores that these donors already give monthly. It suggested thanking them and framing the ask as an optional extra. It didn't name the unsubscribe risk, but the core problem and the gratitude-framing fix match.
- **caught**: Lapsed donors: draft works, but no acknowledgment of their 2023 gift  
  Send Check said explicitly that nothing acknowledges their 2023 gift, and its rewrite names that gift. The score of 72 roughly fits "draft works".
- **MISSED**: Sector context: 50 emails/subscriber/year and 16% list loss — every blind blast spends list equity  
  No segment mentions email volume, list attrition, or the cost to list equity of sending one undifferentiated blast.

### 20. Hiring blast to past applicants
- **caught**: Interviewed-well candidates: "apply through the link" sends warm, pre-vetted talent back to the cold top of the funnel; these deserve a direct note referencing their interview and a skip-ahead path  
  Send Check says "Apply through the link below" sends them back to the start. It recommends a direct note that references their interview, and its rewrite offers to skip the first interview.
- **MISSED**: Résumé-stage rejects: fine for the associate roles, but inviting them to the assistant-manager posting ignores why they were screened out — scope the role per prior stage reached  
  Send Check asks the draft to acknowledge the earlier rejection and give a reason to reapply. It never says to limit this group to the associate roles or to leave out the assistant-manager posting. It also scored the segment send (78).
- **caught**: Former employee: a blast template to someone who worked there; the one name on this list that warrants a personal email, not a campaign  
  Send Check flags the draft as a public job ad sent to a former team member. It asks for a direct, personal note signed by a person, and it rewrote the email that way.
