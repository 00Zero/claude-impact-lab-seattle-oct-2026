# Send Check Use Cases

Oct 25, 2026

One message to many recipients is never one message. It is N messages wearing the same coat. Twenty small-business scenarios where that breaks, grouped by what is at stake, with the evidence behind each.

## The demo set

**Live demo: win-back campaign.** Segments are visible and safe to show (recent, lapsed, complained). Behavior-triggered sends were 2% of volume but 30% of email revenue (Omnisend, 150K brands).

**High-stakes close: the price-increase email.** One send touches every paying customer. A 2026 Journal of Marketing field experiment found wording alone changed attrition by 29.5%, and the default owners write (our costs went up) performed no better than silence.

**Q&A spare: invoice reminders.** 56% of US small businesses are owed money, $17,500 on average (QuickBooks 2025). The same reminder cannot go to a 10-year client and a chronic late payer.

## Money at risk

| # | Use case | What varies by recipient | Evidence |
| --- | --- | --- | --- |
| 1 | Price-increase announcement | Tenure, plan tier, usage | Wording changed churn 29.5%; cost-based framing = silence (J. Marketing 2026) |
| 2 | Overdue-invoice reminders | Relationship length, payment history | 56% of SMBs owed, $17.5K avg (QuickBooks 2025); 47% have invoices 30+ days late |
| 3 | Renewal / contract-expiry notices | Tenure, usage level, prior negotiation | 47% of subscription cancellations cite price (Zuora 2025) |
| 4 | Subscription pause / save offers | Churn-risk signals, price sensitivity | Retention economics; segment-sensitive by definition |
| 5 | Service failure apology / recall | Severity of impact, tenure | Highest asymmetric downside of any send |

## Revenue recovery and growth

| # | Use case | What varies by recipient | Evidence |
| --- | --- | --- | --- |
| 6 | Win-back lapsed customers | Lapse length, prior frequency and spend | Triggered emails: $2.87 vs $0.18 revenue per send (Omnisend 2026) |
| 7 | Upsell / cross-sell announcement | Current tier, usage signals | Segmented sends \~2x clicks (Mailchimp) |
| 8 | New product or service launch | Past category purchases | Same Mailchimp segmentation data |
| 9 | Back-in-stock / waitlist release | Wait time, prior purchase | Timing plus history decide tone |
| 10 | Seasonal / holiday promotion | Purchase category, discount sensitivity | Highly segmented campaigns: 3x revenue per recipient (Klaviyo) |
| 11 | Referral-program ask | Satisfaction proxy, tenure | Ask quality gates response |
| 12 | Cold intro to a prospect list | Role, industry | Avg B2B cold reply rate 0.45% (Belkins, 7.5M emails). Riskiest for the domain; furthest from your-actual-customers premise. Last resort |

## Reputation and relationship

| # | Use case | What varies by recipient | Evidence |
| --- | --- | --- | --- |
| 13 | Review requests | Recency, satisfaction signal | 83% of consumers asked actually leave one (BrightLocal 2026). Adapt timing and tone per segment only; filtering out unhappy customers is review gating and violates Google policy |
| 14 | Apology / make-good after a bad-review wave | Affected vs not | Blanket apologies alarm the unaffected |
| 15 | Testimonial / case-study ask | Relationship depth, results achieved | Specific asks convert; generic asks burn goodwill |

## Operations, scheduling, and niche verticals

| # | Use case | What varies by recipient | Evidence |
| --- | --- | --- | --- |
| 16 | Policy change notice (hours, fees, booking rules) | Frequency of use, who is affected | Nobody expects this to be a personalization problem; good judge-question deflection |
| 17 | No-show follow-ups / appointment reminders | No-show history, service type | Strong for salons, trades, clinics |
| 18 | Event / workshop / open-house invites | Past attendance, interest tags | Welcome-series CTR runs \~3x standard appeals (M+R) |
| 19 | Nonprofit fundraising appeal | Donor tier, lapsed vs active, volunteer vs donor | Nonprofits sent 50 emails per subscriber in 2025 and lost 16% of their lists (M+R 2026) |
| 20 | Hiring blast to past applicants | Role fit, prior stage reached | Cheapest warm talent pool most businesses ignore |

## Pitch-ready statistics

| Stat | Source | Flag |
| --- | --- | --- |
| Price-increase wording changed attrition 29.5%; cost-based explanation did no better than silence | Journal of Marketing, May 2026 field experiment, 1,600+ customers | Single industry (self-storage), high switching costs |
| 56% of US small businesses owed money; $17,500 average | QuickBooks Late Payments Report 2025 (n=2,487) | Solid; 2026 edition says $17.7K |
| Segmented campaigns: +100.95% clicks, +14.31% opens, -9.37% unsubscribes | Mailchimp, \~11K campaigns | SMB-heavy base; dataset is old |
| Triggered emails: 2% of sends, 30% of email revenue ($2.87 vs $0.18 per send) | Omnisend 2026 report, 150K brands | Ecommerce-skewed |
| Gmail/Yahoo spam ceiling 0.3%; 30 complaints on a 10,000 send | Google bulk-sender rules, enforcement escalated Nov 2025 | Applies at scale, but complaint thresholds hit all senders |
| 83% of consumers asked for a review left one | BrightLocal 2026 | US consumers |
| 47% of subscription cancellations cite price increases | Zuora 2025 / Harris Poll | Consumer subscriptions, not SMB-specific |
| Avg B2B cold email reply rate: 0.45% | Belkins 2025, 7.5M emails | Agency-derived, definitions vary |

Do not quote: the circulating 10% increase = 25% churn figure and the 17%-to-4% churn-save claim. No traceable methodology.

## Design directive: facts, not personas

A July 2026 study (Upworthy A/B archive, 399 tests) found synthetic persona panels ranked copy variants worse than a no-persona baseline. Send Check grounds every verdict in observable recipient facts: last purchase date, price tier, days overdue, engagement recency, past thread tone. Never role-play personas.

This is the architecture answer to the isn't-this-just-AI-guessing question, and the counter to any synthetic-audience tool. Verdicts cite the recipient fact they rest on, so every score is explainable: flagged because this segment lapsed 8 months ago and the draft assumes active use.

Flag: single-author preprint on headline CTR, not per-segment email. Say ranked worse than no personas, nothing stronger.
