# Importing ad results and creatives

How to turn what the owner gives you (ad exports, screenshots, typed numbers) into `priorExperiments[]` and `creatives[]`. Field definitions are in `schema.md`.

## Rules for every import

- **Campaign or ad level only.** Never import person-level rows: lead-form downloads, customer lists, conversion uploads. If a file has name, email, phone or user-ID columns, don't copy those columns into `sources/` (save a copy without them) and never quote them.
- **Copy, don't compute.** Copy spend, impressions, clicks and conversions exactly as the file shows them. Skip the platform's own rate and cost columns (CTR, cost per result, cost per conversion, eCPA): the script works those out from the raw numbers.
- **Never invent or estimate a result.** A missing number stays missing. Don't back spend out of a cost per sign-up, and never fill a gap from a benchmark.
- **One row, one result.** Export at ad level when you can, so each row maps to one creative. A campaign-level row that covers several ads becomes one `priorExperiment` linked to each of those creatives; the script marks their results `shared`.
- **Skip non-data rows:** report titles, date-range lines above the header, and total rows at the bottom.
- **Read the numbers back** to the owner as draft facts marked "please confirm", then ask what a "result" or "conversion" was (see the conversion-type table below).

**How sure we are of these column names:** ✓ = checked against the platform's own help pages on 2026-10-25. *Example* = seen in third-party guides or our demo file but not confirmed by the platform. Platforms rename columns, so always match on the owner's actual file.

## Meta Ads Manager

Export from the **Ads** tab for one row per ad.

| Our field | Column | Checked |
|---|---|---|
| `spend` | "Amount spent", often with the currency in brackets: "Amount spent (USD)" | ✓ name; the currency suffix is an *example* |
| `metrics.impressions` | "Impressions" | *example* |
| `metrics.clicks` | "Link clicks" (clicks to the advertiser's destination). Not "Clicks (all)", which also counts clicks inside Meta | ✓ |
| `metrics.conversions` | "Results": what counts as a result depends on the campaign's objective | ✓ |
| conversion type | "Result type" names what "Results" counted | *example* |
| creative wording | "Ad name" is often the owner's internal label, not the headline: ask before using it as `headline` | *example* |
| `audience` | "Ad set name" (targeting summary) | *example* |

## Google Ads

| Our field | Column | Checked |
|---|---|---|
| `spend` | "Cost" | ✓ |
| `metrics.impressions` | "Impr." (with the full stop) | ✓ |
| `metrics.clicks` | "Clicks" | ✓ |
| `metrics.conversions` | "Conversions". It can have decimals (e.g. 12.5) when credit is shared across clicks: copy it as is. Not "All conv.", which adds secondary actions and view-through conversions | ✓ |
| conversion type | The conversion action the column counts (purchase, sign-up, lead). Segment the report by conversion action to see it | *example* (exact label not confirmed) |
| creative wording | Responsive search ads: the ad's **View asset details** report lists each headline and description in "Assets", with "Asset type" saying which is which | ✓ |

Responsive search ads mix up to 15 headlines and 4 descriptions, so a result belongs to the whole ad, not to one headline. Record each headline the owner wants to keep as its own text creative, all linked to the ad's single result (the script marks them `shared`). Don't turn per-asset numbers into separate results.

## Reddit Ads

Export with **Export Report → Download .csv** ✓.

| Our field | Column | Checked |
|---|---|---|
| `spend` | "Amount Spent" | ✓ metric name in Reddit's help center; the CSV header itself is an *example* |
| `metrics.impressions` | "Impressions" | same as above |
| `metrics.clicks` | "Clicks" | same as above |
| `metrics.conversions` | The event's own column, such as "Purchase" or "Sign up" (from the Reddit Pixel) | same as above |
| don't copy | "CTR", and the "(eCPA)" cost columns per event | ✓ |

Reddit can split each event into click-attributed and view-attributed counts (*example*, from third-party guides). Use the click-attributed count, and tell the owner which event you counted when you read the numbers back.

## TikTok Ads Manager

| Our field | Column | Checked |
|---|---|---|
| `spend` | "Cost" | ✓ |
| `metrics.impressions` | "Impressions" | ✓ |
| `metrics.clicks` | "Clicks (destination)". Not "Clicks (all)", which includes likes and other social actions | ✓ |
| `metrics.conversions` | "Conversions": the event the campaign optimized for | ✓ |
| don't copy | "Cost per conversion" | ✓ |

## Email and hand-entered numbers

There's no standard email export, so use this convention (ours, not a platform's):

- `metrics.impressions` = emails delivered; `metrics.clicks` = people who clicked; `metrics.conversions` = sign-ups the owner attributes to that email; `spend` = what the send cost (0 is a valid answer). Don't use opens: they're unreliable.
- **Typed or spoken numbers** get `source: "manual"` and no `sourceFile`. Record exactly what the owner said. If they only remember a cost per sign-up, ask for the spend and the number of sign-ups behind it. If they give a range or "about", ask for their best single figure, or leave it empty.

## What counted as a conversion (`conversionType`)

Only `paying` results are judged. Ask the owner every time; the column name alone isn't enough.

| The column counted | `conversionType` |
|---|---|
| Purchases or subscriptions (e.g. Meta "Website purchases", Reddit "Purchase") | probably `paying`; confirm with the owner |
| Trials started | `trial` |
| Leads, registrations, sign-ups, installs | `unknown` until the owner says whether these were paying customers |
| Clicks, landing-page views, reach, video views | not a conversion at all: leave `metrics.conversions` empty |

## Creatives from uploads

- **From an export:** one text creative per distinct ad, with `headline` and `body` copied verbatim, `source: "owner-file"`, `sourceFile` the export, and `experimentIds` linking its row (mirror it in the row's `creativeIds`). Ask the owner whether each is `live` or `past`.
- **From an image or screenshot:** copy it into `sources/`, look at it, and write `imageDescription` from what is actually visible: the people, setting and product, any text on the image in quotation marks, and the button. Copy the headline, body and button text into `headline`, `body` and `cta` only when they're legible. If the screenshot shows results (an Ads Manager table, say), copy the legible numbers into a `priorExperiment` with the screenshot as `sourceFile`, and read them back to the owner.
- **From the website or the chat:** the site's main headline becomes a `live` creative with `channel: "website"` and `source: "website"`. Headlines, CTAs and drafts the owner types become creatives with `source: "owner-text"`.
