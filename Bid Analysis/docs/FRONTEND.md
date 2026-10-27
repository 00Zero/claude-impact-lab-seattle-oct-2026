# Washington Contract Explorer: frontend

Map-first discovery of Washington public contracting work, built to `Washington_Contract_Explorer_SRS.md` v1.1 (the final plan). Accounts are required, the handoff is the agency's own website, email, and phone, coverage is Washington only, and opportunities are collected ahead of time by the data team.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000, sample data by default
npm run typecheck      # tsc --noEmit
npm test               # node:test suites in tests/, bundled with esbuild
npm run build          # next build
npm run build:artifact # single-file HTML demo in artifact/dist/
```

Copy `.env.example` to `.env.local` to change modes. Never commit a real `.env`.

| Variable | Values | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_DATA_MODE` | `fixtures` (default), `live` | `fixtures` runs on labeled sample data and simulated services. `live` calls the backend. |
| `NEXT_PUBLIC_API_BASE_URL` | URL or empty | Origin of the `/api/v1` routes. Empty means same origin. |
| `NEXT_PUBLIC_BOOKING_URL` | https URL or empty | Overrides Jon's scheduling page. Empty uses https://calendly.com/jjcochran-nxvb. Shown as "Book a call with Jon" on Good fit and Possible fit jobs. |

Nothing secret belongs in a `NEXT_PUBLIC_` variable. They ship to the browser.

## Layout of the code

| Path | What it holds |
| --- | --- |
| `src/lib/contracts.ts` | Types for every entity and response in SRS §12 and §13. The single source the backend should match. |
| `src/lib/services/` | `ExplorerServices` interface, the HTTP adapter (`httpServices.ts`), and the fixture adapter (`fixtureServices.ts`). The UI only talks to this interface. |
| `src/lib/catalogQuery.ts`, `dates.ts`, `taxonomy.ts` | Filtering, sorting, Washington-time deadline rules, work categories, counties, places. |
| `src/lib/sim/` | Simulated profile reading and rule-based matching. Development stand-ins for workstream B, following SRS 11.3. Never shown as the real service. |
| `src/fixtures/dev/` | 28 real agencies (real websites, placeholder email and phone) and 38 invented opportunities, all flagged `isDevelopmentFixture`. |
| `src/map/` | `MapView` (d3 + SVG, bundled terrain image and county shapes, no tile service), clustering, projection. Replaceable behind its props and imperative handle. |
| `src/explorer/` | State store (`store.tsx`), the app shell, and components: results, detail, filters, onboarding, fit, chrome. |
| `src/serviceArea/` | Service Area Explorer: preview county changes, then apply them to the profile. Uses the store, `confirmProfile`, the store's matching run and `MapView`; see its README. Styles in `src/styles/service-area.css`. |
| `artifact/`, `scripts/build-artifact.mjs` | Builds the same app into one HTML file for demos. |

## What the backend needs to provide

The HTTP adapter calls these routes under `${NEXT_PUBLIC_API_BASE_URL}/api/v1`, with cookie sessions (`credentials: "include"`). Every response uses `{ data, meta? }` or `{ error: { code, message, retryable } }`, as in SRS §13. A 401 anywhere triggers the re-sign-in screen.

| Method and route | Used for | Notes |
| --- | --- | --- |
| `GET /auth/session` | Restoring a session on load | **Not in the SRS.** Workstream C needs to add it. Return `{ data: Session }` or 401. |
| `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout` | Accounts | Body `{ username, password }`. |
| `GET /opportunities?…` | Map and list | Query keys come from `encodeFilter`: `query`, `workCategories`, `agencyIds`, `agencyTypes`, `countyNames`, `publishedAfter`, `deadlineBefore`, `deadlineUnknown`, `includeUnknownDates`, `includeStatewide`, `includeUnknownLocations`, `viewportBounds` (west,south,east,north), `sort`. Must return `facets`, `meta.totalFiltered`, `mappedCount`, `unmappedCount`, and the agencies referenced. |
| `GET /opportunities/{id}` | Detail | `{ opportunity, agency }`. |
| `GET /coverage` | "Data and coverage" sheet | Counts may be `null` when unknown. |
| `POST /profile/interpret` | Onboarding | Body `{ description, baseLocation?, serviceAreaText? }`. Returns draft fields with provenance and at most three follow-up questions. Must not infer credentials. |
| `GET /me/profile`, `PUT /me/profile` | Profile | Body `{ fields, originalDescription, expectedRevision }`; returns the new revision. Must answer 409 `revision_conflict` without applying anything when `expectedRevision` is stale. Onboarding and the Service Area Explorer both save through it. |
| `POST /matches` | Fit labels | Body `{ profileId, profileRevision, filter }`. `meta.profileRevision` must echo the request so stale responses can be dropped (REC-07). `meta.mode` says `live` or `simulated`. |
| `GET/PUT/DELETE /me/saved-opportunities[/{id}]` | Saving | List returns ids. |

Data the UI depends on, which the collection and matching teams should populate:

- **Agency contact fields**: `websiteUrl`, `email`, `phone`. Missing values show "Not available"; nothing is invented.
- **Locations**: each `PerformanceLocation` needs `precision` (site, address, road segment, city, county, statewide, remote, unknown), `countyNames`, and `displayPoint` as `[lon, lat]` or `null`. Approximate points are drawn with a dashed ring and labeled.
- **Location provenance** (proposed): county, city or coordinates copied from the issuing agency's record, as `scripts/pull_bids.py` does today, aren't evidence of a work site. Mark such locations `resolutionMethod: "agency_record"`, which is not yet in `contracts.ts`. The Service Area Explorer then keeps them out of reachability counts and lists them as "Work location not confirmed". Extracting the real place of performance is the long-term fix.
- **Dates**: `DateValue` with `precision` and `timeZone`. A date-only deadline stays open through that day in Washington time.
- **Requirements**: `kind`, `mandatory`, and the source text, so matching can cap tiers for unknown registration, bonding, experience, or equipment.
- **Fit**: `tier`, `reasons`, `mismatches`, `unknowns`, and `rankingScore` (ordering only, never shown as a probability).

## Verification done

Run against the single-file build in headless Chromium and against `next start`:

- `npm run typecheck`, `npm test` (49 passing, including the Service Area Explorer suites), and `next build` all pass.
- Sign-up and sign-in gate the app. Sign-out clears the profile, saved items, and matches.
- Map: clusters expand on click, selecting a card flies the map there, keyboard focus plus Enter on a marker opens the detail, Escape closes it. "Search this area" appears after a user pan or zoom and adds an "In map area" filter chip.
- Onboarding: description, follow-up questions, editable review with provenance, confirm. Fit labels appear on cards and markers once matching finishes. Rapid profile edits never show an older revision's results.
- Detail: contact section shows the agency website, email, and phone with copy buttons. Save works and shows a toast.
- Empty state, catalog failure with retry (via the dev failure switches in "Data and coverage"), and recovery.
- Wide (1440), medium (900), and phone (390) layouts, no horizontal scroll. Reduced motion is respected.
- Service Area Explorer, run against `next start` in fixture mode:
  - Opened from the profile strip. A county added with the keyboard and a county removed from the map both show their counts and map preview.
  - Opening newly reachable work shows the detail without a stale fit label.
  - Cancel restores the area, filters and map. Apply saves a new revision, and fit is re-checked once.
  - Save failure, revision conflict and matching failure all keep the preview and say what happened. "Data and coverage" now has profile-saving failure switches.
- The same flows in a `live` build against an intercepted `/api/v1`:
  - The PUT body and `expectedRevision` are correct, with exactly one `POST /matches` after Apply.
  - A superseded revision's slow response is aborted and dropped. A 409 keeps the preview.

## Limitations

- All listings in fixture mode are invented and labeled as samples. Matching and profile reading are simulated rules, labeled as such in the UI.
- Fixture accounts live in memory only and disappear on reload.
- The terrain image is a fixed bundled raster, so it softens at the closest zoom levels. A vector tile service could replace `MapView` later without touching the rest of the app.
- The live adapter has not been run against a real backend yet; it is written to the SRS contract.
- Dark theme only, by design.
