# Fixtures: synthetic test emails

Twenty-one draft emails: one per use case in `docs/Send Check Use Cases.md`, plus #21, a travel-industry variant of #14. Each is written the way a small-business owner writes it: one blast, the same text for every recipient. The businesses and people are fictional, so these are safe to commit. They are *not* the real emails in `corpus/samples/`.

Each file has the business, the recipient list, the subject, the draft, and the expected Send Check findings: the per-segment flags the verdict should surface, grounded in observable recipient facts. The drafts are *supposed* to contain the failure modes, so em-dashes, filler and generic openers in them are intentional.

| # | Use case | Category |
|---|---|---|
| 1 | [Price-increase announcement](01-price-increase-announcement.md) | Money at risk |
| 2 | [Overdue-invoice reminders](02-overdue-invoice-reminders.md) | Money at risk |
| 3 | [Renewal / contract-expiry notice](03-renewal-contract-expiry-notice.md) | Money at risk |
| 4 | [Subscription pause / save offer](04-subscription-pause-save-offer.md) | Money at risk |
| 5 | [Service failure apology / recall](05-service-failure-apology-recall.md) | Money at risk |
| 6 | [Win-back lapsed customers](06-win-back-lapsed-customers.md) | Revenue recovery and growth |
| 7 | [Upsell / cross-sell announcement](07-upsell-cross-sell-announcement.md) | Revenue recovery and growth |
| 8 | [New product or service launch](08-new-product-or-service-launch.md) | Revenue recovery and growth |
| 9 | [Back-in-stock / waitlist release](09-back-in-stock-waitlist-release.md) | Revenue recovery and growth |
| 10 | [Seasonal / holiday promotion](10-seasonal-holiday-promotion.md) | Revenue recovery and growth |
| 11 | [Referral-program ask](11-referral-program-ask.md) | Revenue recovery and growth |
| 12 | [Cold intro to a prospect list](12-cold-intro-to-a-prospect-list.md) | Revenue recovery and growth |
| 13 | [Review requests](13-review-requests.md) | Reputation and relationship |
| 14 | [Apology / make-good after a bad-review wave](14-apology-make-good-after-a-bad-review-wave.md) | Reputation and relationship |
| 15 | [Testimonial / case-study ask](15-testimonial-case-study-ask.md) | Reputation and relationship |
| 16 | [Policy change notice](16-policy-change-notice.md) | Operations, scheduling, and niche verticals |
| 17 | [No-show follow-ups / appointment reminders](17-no-show-follow-ups-appointment-reminders.md) | Operations, scheduling, and niche verticals |
| 18 | [Event / workshop / open-house invite](18-event-workshop-open-house-invite.md) | Operations, scheduling, and niche verticals |
| 19 | [Nonprofit fundraising appeal](19-nonprofit-fundraising-appeal.md) | Operations, scheduling, and niche verticals |
| 20 | [Hiring blast to past applicants](20-hiring-blast-to-past-applicants.md) | Operations, scheduling, and niche verticals |
| 21 | [Tour operator apology sent to the whole past-guest list](21-tour-operator-apology-to-whole-guest-list.md) | Reputation and relationship |

## Using the fixtures

- Each draft is a *should-flag* fixture except where noted: #9's this-week segment and #16 overall are the negative tests that keep Send Check from crying wolf.
- Every expected flag traces to a recipient fact (tenure, payment history, usage, purchase or service history, thread state, role, list hygiene). No flag should need persona inference.
- Severity anchors for scoring tests: #17 (double-booked accusation), #7 (upsell to premium) and #5 (blanket recall) are high severity. #16 is the low-severity anchor. #21 pairs with #14: same blast-to-everyone failure, travel vertical, with a recipient CSV at `data/saltwind-tours-guests.csv` (regenerate with `scripts/make_tour_csv.py`).

Source: `docs/send-check-test-emails.md`, split one file per email.
