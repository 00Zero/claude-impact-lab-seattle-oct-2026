# OneTrip design guardrails: competitor complaints we won't repeat

Source: `field-service-apps.md` (App Store, GetApp, Capterra, Software Finder reviews; see URLs there) + `mobile-forms-photo-capture.md` + `ai-output-webapp-ux.md`. Every screen gets checked against this list before it ships.

| # | Complaint (who) | Our rule | Where it applies | How we check |
|---|---|---|---|---|
| 1 | "Ten different things just to accomplish one task" (Jobber); one-click tasks now take several (ServiceTitan) | **New request ≤ 3 fields, ≤ 20 sec.** Every core action ≤ 2 taps from the request list | New request, share, brief | Time it with a stopwatch; count taps |
| 2 | Features only work on desktop (Jobber, HCP) | **Mobile is the product.** Every contractor feature works on a phone; desktop is just a wider layout | Whole contractor app | Build and review at 390px first |
| 3 | Photo uploads slow; techs upload later (HCP, Jobber) | Shrink photos on the phone (~2048px), upload immediately, retry automatically, show per-photo progress; never block the next step on upload | Customer photo stage | Throttle to "Slow 3G" and run the flow |
| 4 | Address / customer info hidden a level down (HCP, Workiz) | **Address and customer name on every request card** and in the brief's sticky header | Request list, brief | Visual check |
| 5 | Text too small; menus move (ServiceTitan) | Body ≥ 16px (customer ≥ 18px), inputs ≥ 16px, 48px+ targets, fixed bottom tabs that never move | Everywhere | Check at 200% zoom and in direct sun |
| 6 | Content can't be copied, so it's retyped (ServiceTitan) | Model, serial and parts are **one-tap copy** | Brief | Tap-to-copy works |
| 7 | Surprise automated texts (HCP, Workiz) | **No message is sent without the contractor seeing it first.** Links go out from their own phone with a visible preview | Share link | No automatic sending in the MVP |
| 8 | Steep learning curve; crews struggle after training (Jobber) | First run shows the link plus a **sample brief** and "send yourself a test request"; no training needed | Onboarding, empty state | Non-technical teammate completes setup without help |
| 9 | Redesign churn (ServiceTitan) | One navigation model: bottom tabs (Requests · My Link · Settings) | Contractor app | — |
| 10 | Paying for junk leads (Thumbtack, Angi) | We're not a marketplace: no lead fees, free and open source | Landing page | Messaging check |
| 11 | Streem: 4 taps and camera + mic permission before anything happens; less tech-savvy customers struggle with permissions | **No walls before the camera**: no terms page, no account; camera opened via the file input at the first photo step only | Customer link | Count taps from opening the link to the first photo (target 1) |
| 12 | AI walls of text (mentor) | Brief fits one phone screen: verdict → equipment → bring → confirm on site; details behind a tap | Brief | Read it in 30 seconds |
| 13 | AI overconfidence | High / Med / Low words + icon; Low = grey; every finding links to its photo or answer; "what the AI didn't see" | Brief | Each AI claim shows its source |
