# QA Report — Clippy 2.0

QA by Agent 5. Each run does: `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npx playwright test`
(real @real tests run once, on the desktop project only, against the dev server on port 3000).

## Runs

| Time (PDT) | tsc | vitest | build | playwright | Notes |
| --- | --- | --- | --- | --- | --- |
| 13:56 | PASS | FAIL (lib tests 65/65 pass; e2e specs are loaded by vitest, see bug 1) | PASS | PASS (27 passed, 3 skipped) | @real: list, cafe invoice (5 items, $358.12/mo), not-an-invoice all pass |
| 14:10 | PASS | PASS (69/69) | PASS | PASS (27 passed, 3 skipped = @real on mobile, by design) | Bugs 1–3 fixed. Manual check of invoice, typed list and real example: OK, no console errors. |
| 14:25 | PASS | PASS (69/69) | PASS | PASS (27 passed, 3 skipped) | With real Tavily key: list 8.9 s, invoice 11.9 s, not-an-invoice 2.3 s. |
| 14:56 | PASS | PASS (71/71) | PASS | PASS local + PASS live (`BASE_URL=https://clippy-nu-eight.vercel.app`: 27 passed, 3 skipped) | Chat UI; a tip for every item; dev badge turned off. Live API checked with a real list. |

## Open bugs

None.

## Fixed (final pass)
- **Bug 1** vitest ran the Playwright files → added `vitest.config.ts` that excludes `e2e/**`. 69/69 pass.
- **Bug 2** lids priced "per cup" → `unitLabel` in `lib/units.ts` now uses the unit word that comes last in the name. Tests added.
- **Bug 3** "you already pay good prices" with no prices given → `lib/suggest.ts` now says "Add the price you pay now…" (or "could not find reliable store prices"). Tests added.
- **Bug 4** empty `TAVILY_API_KEY` (keyless mode, hourly limit) → owner added a real key. Fresh invoice run: 9 offers, ≈ $0.33.
- Vercel keys were first saved as the word "development" (CLI reads the 2nd argument as the value) → re-added with `-e <env>`; live price check works.
- Mobile cards hide "Savings per order" when it is unknown.

## Fixed by Agent 5
- Submit button screenshot looked disabled during a colour transition → removed the transition.
- Big headline wrapped badly on phones → smaller text on mobile.
- No-price list showed "You already pay good prices" and "Not on invoice" → now "Here are the best prices Clippy found" and "Not given".
