# Bid data model

Owned by the bid-finding lane. The front end and matcher read it; only bid-finding
scripts write it (with the Supabase secret key). Change it only through a new migration
in `supabase/migrations/` and a PR, after the team agrees.

## Tables

- **`sources`**: places that post bids (agencies and shared portals). See `data/README.md`.
- **`bids`**: one row per solicitation found at a source. Public read.
- **`open_bids`** (view): `bids` where `status = 'open'` and the deadline hasn't passed.
  The app should read this, not `bids`.
- **`open_bids_near(lat, lng, miles)`**: open bids within a radius, soonest deadline first.
- **`leads`**: "Get help winning this" handoffs. No public access.

## `bids` fields

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Generated. |
| `source_id` | text | `sources.id` it was found on (agency or portal). |
| `agency` | text | Agency that issued it, as shown to the vendor. Required. |
| `title` | text | Required. |
| `solicitation_number` | text | Agency's number. Unique per source when present. |
| `bid_type` | text | `itb`, `rfp`, `rfq`, `rfi`, `small_works`, `roster`, `other`. |
| `status` | text | `open`, `closed`, `awarded`, `cancelled`, `unknown`. |
| `summary` | text | 1-2 plain-language sentences for the detail view. |
| `description` | text | Fuller text as extracted. |
| `categories` | text[] | Plain work types matching the intake chips (`paving`, `landscaping`, `janitorial`, `snow_removal`, ...). |
| `naics_codes` | text[] | NAICS codes the agency tagged, most specific only (2-6 digits; OpenGov tags some bids only at the sector level). Titles in `raw.naics`. |
| `requirements` | text[] | `licensed`, `bonded`, `insured`, `prevailing_wage`, `small_works_roster`, ... |
| `set_asides` | text[] | `small_business`, `women_owned`, `minority_owned`, `veteran_owned`, `dbe`. |
| `state`, `county`, `city` | text | Where the work happens. `state` is WA, OR or ID. |
| `location_text` | text | Address or place as written in the bid. |
| `lat`, `lng` | float | Work location (or the agency's location if unknown). Needed for the map. |
| `posted_date` | date | |
| `deadline` | timestamptz | Response due. |
| `prebid_at`, `questions_due_at` | timestamptz | Optional. |
| `contact_name`, `contact_email`, `contact_phone` | text | The contact named in the bid. |
| `contact_title`, `contact_address` | text | That contact's job title and mailing address, when listed. |
| `estimated_value_text` | text | Only as published by the agency. We never estimate prices. |
| `source_url` | text | Link to the bid. Unique; upsert key. |
| `documents` | jsonb | `[{"name", "url", "type"}]` for specs, plans and addenda. |
| `extraction_method` | text | `api`, `html`, `pdf`, `llm`, `manual`. |
| `last_checked` | timestamptz | Shown as "last checked". Set on every re-crawl. |
| `raw` | jsonb | Extraction evidence. Not for display. |
| `created_at`, `updated_at` | timestamptz | |

## What the matcher adds

"Why this matched" depends on the vendor, so it is not stored. The matcher returns each
bid row plus:

```json
{ "why_matched": "Matches your paving work, 12 miles away, closes in 9 days", "distance_miles": 12.1 }
```

No scores or prices. The PRD rules those out.

## Writing bids

Upsert on `source_url`. Always set `last_checked = now()`. When a re-crawl no longer finds
a bid, set `status = 'closed'`. Don't delete it. Mock rows for building against are in
`data/mock/bids.json`.
