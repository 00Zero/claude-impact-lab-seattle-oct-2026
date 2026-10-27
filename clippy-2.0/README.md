# Clippy 2.0 — Team Clippy

**Small businesses overpay for supplies because nobody has time to price-check every invoice. Clippy does it in under a minute: snap a photo of your supply invoice, and Clippy shows which real stores sell the same items for less — and how much you'd save per order, per month and per year.**

- **Demo video:** https://www.loom.com/share/f5c983ed838e498299a42cb0df5495bc
- **Live demo:** https://clippy-nu-eight.vercel.app
- **Code:** https://github.com/Calypso11/Team-Clippy

| Chat | Results (phone) | Results (computer) |
| --- | --- | --- |
| ![Start screen](public/screenshots/input.png) | ![Results on a phone](public/screenshots/results-mobile.png) | ![Results on a computer](public/screenshots/results-desktop.png) |

---

## For judges: try it in 60 seconds

1. Open the [live demo](https://clippy-nu-eight.vercel.app) and click into the app.
2. Pick one:
   - **Upload an invoice photo** — try [`samples/invoice-cafe.png`](samples/invoice-cafe.png) (a 5-item café invoice).
   - **Type a list** — e.g. `50 lb bread flour, 1000 12 oz cups`.
   - **Talk** — hit the mic and say your list.
   - **Capture your screen** — grab an invoice that's open in another tab.
3. Watch live progress, then get a savings table: cheapest store per item, product link, date checked, savings per order / month / year.

Want to see it refuse to guess? Upload [`samples/not-an-invoice.png`](samples/not-an-invoice.png).

## The problem

A café, salon or small shop re-orders the same flour, cups, gloves and cleaning supplies every month from the same supplier. Comparing prices means opening a dozen tabs and doing unit math by hand (is a 25 lb bag at $18 better than 50 lb at $31 plus shipping?). So owners don't — and quietly overpay.

## What Clippy does

1. **Reads your invoice.** Claude Sonnet extracts each item, pack size and the price you pay now from a photo, screenshot, typed list or voice.
2. **Searches real stores.** Tavily searches public store pages for the same items (optionally near your city/ZIP).
3. **Extracts real offers.** Claude reads those pages and pulls out price, pack size and shipping — every price keeps its **source URL and the date it was checked**.
4. **Compares fairly.** Deterministic TypeScript (not the LLM) converts everything to price per lb / per cup / per item, including shipping, so big and small packs compare apples-to-apples.
5. **Shows your savings.** Cheapest store per item, link to buy, plus per-order, monthly and yearly savings and a short plain-English tip for each item.
6. **Keeps a history.** A savings dashboard and past checks, with optional email login.

**Clippy never buys anything.** It only shows links — you decide where to shop.

## Trust by design

- **Never guesses a price.** If no reliable price is found, Clippy says *"No reliable price found."*
- **Every number is traceable** to a source URL and a check date.
- **Money math is code, not AI.** All unit conversion and savings live in [`lib/compare.ts`](lib/compare.ts) and are unit-tested.
- **Structured outputs only.** Every Claude call uses a forced tool call (`tool_choice`) validated with `zod`, so bad model output is rejected rather than shown.
- **Bounded runs.** Up to 6 items per check, with a 55 s whole-run deadline that returns partial results instead of hanging.

## How it's built

```
 photo / screenshot / text / voice
              │
              ▼
   /api/analyze  (streams progress events)
              │
   ┌──────────┴───────────┐
   │ lib/input.ts         │  Claude Sonnet 5.5 reads invoices · Haiku 5.5 parses lists
   │ lib/tavily.ts        │  Tavily web search for store pages
   │ lib/offers.ts        │  Claude Sonnet 5.5 extracts offers (price, pack, shipping, URL)
   │ lib/units.ts         │  unit normalisation
   │ lib/compare.ts       │  ranking + savings math (pure, tested)
   │ lib/suggest.ts       │  Claude Haiku 5.5 writes a short tip per item
   └──────────┬───────────┘
              ▼
   Results · Top findings · Dashboard · History
```

| Layer | Tech |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 |
| AI | Anthropic Claude (`claude-sonnet-5-5`, `claude-haiku-5-5`) via `@anthropic-ai/sdk`, `zod` |
| Search | Tavily (`@tavily/core`) |
| Voice | ElevenLabs Scribe speech-to-text ([`app/api/transcribe`](app/api/transcribe/route.ts)) |
| Auth (optional) | Supabase email/password; the app runs without it |
| Hosting | Vercel |
| Tests | Vitest (~100 unit tests) + Playwright (6 end-to-end specs, desktop + mobile) |

Key code: pipeline [`lib/pipeline.ts`](lib/pipeline.ts) · API [`app/api/analyze/route.ts`](app/api/analyze/route.ts) · UI [`components/`](components/).

## Quality

QA was run repeatedly through the day: type-check, unit tests, production build and Playwright against both local and the live Vercel site. See [`QA-REPORT.md`](QA-REPORT.md) for each run and every bug found and fixed.

## What it costs

About **$0.35 per invoice check** (measured on the 5-item sample): ~$0.17 Claude + ~$0.16 Tavily. Tavily's free tier (1,000 credits/month) covers ~50 checks. Measured with [`scripts/measure-cost.ts`](scripts/measure-cost.ts).

## Run it locally

```bash
npm install
# create .env.local with the keys below
npm run dev                  # http://localhost:3000
```

`.env.local`:

```
ANTHROPIC_API_KEY=...          # required
TAVILY_API_KEY=...             # required
ELEVENLABS_API_KEY=...         # optional, enables voice input
NEXT_PUBLIC_SUPABASE_URL=...   # optional, enables login
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Tests:

```bash
npx vitest run          # unit tests
npx playwright test     # end-to-end (UI + screenshots)
```

Or deploy your own copy in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCalypso11%2FTeam-Clippy&env=ANTHROPIC_API_KEY,TAVILY_API_KEY&envDescription=Your%20Anthropic%20and%20Tavily%20API%20keys)

## Companion project: BuyOnce

[`buyonce/`](buyonce/) explores the next step — letting an agent actually *place* the reorder, safely. You show it how you buy once; it saves that as a plain-text skill, compares vendors against your own rules (budget, minimum rating, approved vendors), shows one approval card, and **stops before payment**. It halts on surprises like a changed total or a web page trying to instruct the agent. Pure Python, no install: `python3 buyonce/tools/demo.py`. See [`buyonce/README.md`](buyonce/README.md).

## Limits

- Only public store pages are read — prices behind a login, member or contract pricing aren't seen.
- Prices change daily; each one shows the date it was checked. Verify on the store page before buying.

## What's next

- **Invoice forwarding:** email your invoice weekly, get a savings report back.
- **Price alerts** when something you buy gets cheaper.
- **Local stock:** which nearby stores have it today.
- **Clippy → BuyOnce:** go from "here's a cheaper option" to "approve this reorder" in one tap.

## License

[MIT](LICENSE)
