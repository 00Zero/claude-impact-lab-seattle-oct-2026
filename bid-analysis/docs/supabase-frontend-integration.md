# Connecting the map frontend to Supabase

How the explorer in `src/` can read live data from the bid-finding lane. The schema is in `supabase/migrations/` and the field docs are in `docs/bid-data-model.md` on main.

## What to read

- Project URL: `https://jpqkpyfccgzayoyrudkb.supabase.co`
- Key: the **publishable** (anon) key only. Put it in `.env.local` as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and never commit it. Never put the secret key in a `NEXT_PUBLIC_` variable.
- Anon can read:
  - `sources`: the agency registry, 1,450+ state and local agencies in WA/OR/ID (no federal).
  - `open_bids`: a view of `bids` where `status = 'open'` and the deadline hasn't passed.
  - `open_bids_near(p_lat, p_lng, p_miles)`: an RPC that returns open bids within a radius.
- `leads` has no anon access. Writing a lead needs a server route that uses the secret key.
- Check first that `bids` actually has rows. If it's empty, the map will be empty. Run `scripts/pull_bids.py` to fill it, or fall back to `data/mock/bids.json`.

## Smallest change that works

Keep everything in `fixtureServices` (auth, profile, matching, saving) and replace only `catalog`:

1. Fetch every `open_bids` row plus the `sources` rows they reference, with `supabase-js` or plain REST (`/rest/v1/open_bids?select=*`).
2. Map them to `Agency[]` and `Opportunity[]` using the tables below.
3. Feed the mapped list through the existing `queryCatalog()` so the filters, facets and sorting all keep working client-side. That's fine at this data size.
4. Add a mode such as `NEXT_PUBLIC_DATA_MODE=supabase` in `createServices`, and set `integration.catalog = "live"`.

## sources -> Agency

| Agency field | From |
| --- | --- |
| `id` | `id` |
| `name`, `sourceNames` | `name`, `[name]` |
| `agencyType` | `agency_type`. Map `higher_ed` to `university`, keep `state`/`county`/`city`/`port`/`school`/`utility`/`transit` as they are, and map everything else (hospital, fire, water, parks, special_district, platform...) to `other`. |
| `jurisdiction` | `city ?? county ?? state` |
| `websiteUrl` | `homepage_url ?? procurement_url` |
| `email`, `phone` | `null` (shows "Not available") |
| `sourceIds` | `[id]` |
| `procurementCoverage` | `status`: `verified` maps to `checked`, `candidate` to `not_checked`, `missing` to `no_public_listing_found`, `dead` to `inaccessible` |

## open_bids row -> Opportunity

| Opportunity field | From |
| --- | --- |
| `id`, `version` | `id`, `updated_at` |
| `agencyId` | `source_id` (when null, create a synthetic agency from the `agency` text) |
| `title`, `description`, `summary` | `title`, `description`, `summary`. Set `summaryIsGenerated: extraction_method === 'llm'`. |
| `solicitationType` | `{ sourceLabel: solicitation_number, normalized: bid_type }`. `rfi` and `roster` map to `other`. |
| `status` | `status`. Map `cancelled` to `canceled`. |
| `workCategories` | `categories.map(id => ({ id, provenance: 'source' }))`. Unknown ids map to `other`. |
| `classificationCodes` | `naics_codes.map(code => ({ scheme: 'NAICS', code, label: null, provenance: 'source' }))` |
| `publication` | `posted_date` -> `{ rawText: null, value, precision: 'date', timeZone: 'America/Los_Angeles' }` |
| `deadline` | `deadline` -> the same shape with `precision: 'datetime'` |
| `locations`, `locationStatus` | When `lat`/`lng` are set, use one location: `displayPoint: [lng, lat]`, `precision: city ? 'city' : 'county'`, `countyNames: county ? [county] : []`, `cityName: city`, `rawLocationText: location_text`, status `approximate`. Otherwise use `[]` and `unknown`. |
| `requirements` | `requirements.map(r => ({ id: r, category: r === 'bonded' ? 'bonding' : r === 'licensed' ? 'license' : r === 'insured' ? 'insurance' : 'other', text: r, mandatory: null, evidenceRef: null, extractionStatus: 'extracted' }))`. Set `requirementsCompleteness: 'partial'`. |
| `documentLinks` | `documents.map(d => ({ label: d.name, url: d.url, access: 'public' }))` |
| `publicContact` | `{ name: contact_name, role: contact_title, email: contact_email, phone: contact_phone, evidenceRef: null }`. `contact_address` has no field in `PublicContact`; show it in the detail view if wanted. |
| `publishedValue` | `estimated_value_text ? { amount: null, min: null, max: null, currency: 'USD', rawText: estimated_value_text, evidenceRef: null } : null` |
| `sourceReferences` | `[{ sourceId: source_id, sourceNativeId: solicitation_number, url: source_url, evidenceRef: null }]` |
| `lastVerifiedAt`, `firstSeenAt` | `last_checked`, `created_at` |
| everything else | `null` / `[]` |

`set_asides` (women-owned, small business and so on) has no matching field in `Opportunity`. Put it in `completeness` or show it in the detail view.

**Location provenance (proposed, needs the data owner's agreement).** `scripts/pull_bids.py` copies `county`, `city`, `lat` and `lng` from the source record, so today they say where the agency is, not where the work happens. Until the collector extracts place of performance, set `resolutionMethod: "agency_record"` on locations built from those values. The Service Area Explorer then keeps them out of reachability counts and lists them as "Work location not confirmed". See `docs/FRONTEND.md` and `src/serviceArea/README.md`.

## Differences from the PRD

The frontend follows the SRS. The PRD, which wins where they differ, calls for no accounts, coverage of WA, OR and ID, no fit scores or tiers, and a "Get help winning this" phone/email handoff that writes to `leads`. Colin will raise these with you separately. The adapter above works either way.
