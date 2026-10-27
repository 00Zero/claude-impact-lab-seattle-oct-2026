# Clark: test notes for the sample log

New notes to run against `sample-decisions.csv` (Fernwood Coffee, a fictional café, 17 past decisions) and `where-rules-live.csv`. Each has the result Clark should give. Use them to test the prompts, fill the README test table and rehearse the demo.

Rule for every update checklist: Clark only names places from `where-rules-live.csv`. A checklist that names a booking page or anything else not on the list is a failure.

## 1. Demo headline: clash, then one-time exception

**Note:** "Let's do 20% off everything for the holidays."

| Step | Expected |
|------|----------|
| Check | Flags D01 (Mar 4): discounts stay under 15% because margins are thin. Asks: replace the rule, or one-time exception? |
| Owner taps | One-time exception |
| What changes | 20% off everything for the holidays (asks for dates if none were said, or marks them "not said") |
| What stays the same | The 15% cap the rest of the year; D01 stays Active |
| Update checklist | Register (POS), Menu board, Instagram, Staff group chat |
| Staff message | Short and plain, e.g. "Holiday promo: 20% off everything [dates]. After that, discounts go back to 15% max." |

## 2. Clash, then replace

**Note:** "From now on staff can comp up to $20."

| Step | Expected |
|------|----------|
| Check | Flags D16 (Oct 1): comps up to $10 without asking |
| Owner taps | Replace |
| Sheet | New row is Active; D16 becomes Replaced |
| Update checklist | Back-room binder, Staff group chat |
| House rules | Shows $20, not $10 |

## 3. More notes that should flag a clash

| # | Note | Clashes with | Expected flag |
|---|------|--------------|---------------|
| 3 | "Let's put $100 into an Instagram ad for the pumpkin latte." | D05 (Apr 15) | You stopped paid ads because $50 brought about 2 visits |
| 4 | "I want to hire a weekend barista starting in November." | D07 (May 6) | No hires until revenue is over $28k a month for two months. Has that happened? |
| 5 | "Just give her cash back for the cracked mug, it's fine." | D03 (Mar 20) | Store credit only, because of drawer shortages. Likely a one-time exception |
| 6 | "For December let's do a peppermint mocha and a gingerbread latte." | D09 (Jun 3) | One seasonal drink at a time |

## 4. Should not flag a clash

| # | Note | Expected |
|---|------|----------|
| 7 | "Switch trash pickup to Tuesdays, the bins overflow on weekends." | New one-time Operations decision, no clash, no staff checklist needed beyond the group chat |
| 8 | "Okay two things. We're opening Sundays 8 to 2 starting November 2nd since the farmers market moved next door. And Jess is our new shift lead." | **Two decisions in one note.** The first settles D11 (still deciding): say it closes an open question; checklist: Window sign, Website, Instagram, Staff group chat. Jess as shift lead is a promotion, not a hire, so no clash with D07; she can now approve swaps (D17) |

## 5. Tricky (for tuning)

| # | Note | Why it's tricky |
|---|------|-----------------|
| 9 | "Double punches on Tuesdays." | About 20% off on Tuesdays (D02 punch card), which breaks the 15% cap in D01. A good check says so; a weak one misses it. **Second demo moment.** |
| 10 | "Let's raise the oat milk drinks by a quarter." | Not an oat milk upcharge, so not strictly a D08 clash, but close. Mention D08 without calling it a clash |
| 11 | "Close at 2 on Mondays." | Same direction as D04. Offer to replace D04, don't call it a contradiction |
| 12 | "Shift leads can also approve comps up to $15." | Touches D16 ($10, any staff) without fully replacing it. Should ask whether this is a separate rule for shift leads |

## 6. "Why did we…?" and staff questions

| Question | Should cite |
|----------|-------------|
| "Why did we cap discounts?" | D01, Mar 4, 2026, with the original quote |
| "Why do we close early on Mondays?" | D04, Apr 2, 2026 |
| "Why did we stop the grocery pastries?" | D13, Aug 12, 2026 |
| "Why don't we charge for oat milk?" | D08, May 19, 2026 |
| "Can I comp a muffin for a customer who waited forever?" (staff, stretch) | Yes, D16: up to $10 without asking |
| "Why did we fire the dishwasher?" | Nothing in the log. Should say so, not invent an answer |
