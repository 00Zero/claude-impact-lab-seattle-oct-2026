# Service Area Explorer

A signed-in vendor previews how adding or removing Washington counties changes the open work their service area reaches, then **applies** the change to their profile or **cancels** it. Changes are a preview until Apply. Apply saves a new profile revision through the app's existing profile lifecycle, and the store's matching reruns once for that revision.

SRS coverage: J-02 step 7, AT-08, MAP-07, MAP-09, §8.3, §11.3, §12.8, §13.6, REC-07, REC-09, ONB-09.

## Where it appears

- **Entry:** the profile strip at the top of the results panel has an **Explore service area** row once a profile is confirmed.
- **Panel:** the explorer takes the results panel's place on wide and medium layouts and the bottom sheet on phones. **Results**, **Cancel** and **Done** return to the list.
- **Map:** while the explorer is open, the main map shows the preview. Confirmed counties stay dashed gold, added counties turn solid gold, and removed counties get a dotted neutral outline. Newly reachable pins are outlined in gold and drawn as "not assessed". Pins that would drop out fade. Clicking a county edits the preview instead of the county filter. The legend gains the two preview rows.
- **Detail:** selecting a row opens the shared detail panel. For work that is reachable only in the preview, the detail shows "Not assessed for this preview" instead of the confirmed revision's label.

## How it connects

| Concern | Uses | Notes |
| --- | --- | --- |
| Profile | `state.profile` (`VendorProfile`) | `serviceArea` is read and written in its persisted `ProfileField<ServiceArea>` shape. |
| Save | `actions.confirmProfile(fields, originalDescription)` → `services.profile.saveMine(fields, originalDescription, expectedRevision)` | All other fields and provenance are preserved (`fieldsWithServiceArea`). The service area is saved with `provenance: "confirmed"`. |
| Fit recalculation | The store's matching effect, `services.matching.match(profile, filter)` → `{ profileId, profileRevision, filter }` | **Single owner.** The explorer never calls matching. It reports the store's run for the saved revision (`fitRefreshFor`). Stale responses are dropped by the store reducer (REC-07). |
| Catalog | `state.catalog` when the shared filter has no geography; otherwise `services.catalog.listOpportunities(geographyFreeFilter(filter))` | Keyword, work type, agency and date filters stay. County, map-area and fit-tier filters are removed so work outside them can surface. The explorer refetches when the map's `catalogVersion` changes. Opportunities are counted once by canonical ID. |
| Map | `MapView` props `serviceAreaPreview` (county name → `current/kept/added/removed`) and `MapPoint.preview`; county clicks via `onCountyClick(name)` | Names come from `src/map/assets/wa-geo.json`, which also supplies FIPS (`core/counties.ts`). The highlight carries both. |
| Selection and hover | `select(id)` and `dispatch({ type: "hover" })` | Explorer-opened work stays selected even when the map's county filter hides it from the list. |
| Auth | Errors from the explorer's own catalog fetch or save with `unauthenticated` dispatch `auth/expired`, like the store. | The HTTP client's `credentials: "include"` is unchanged. |

Files:

- `core/`: pure logic, tested without rendering. Scope resolution (`geography.ts`), comparison and tallies (`comparison.ts`), preview reducer (`draft.ts`), current-revision fit (`assessments.ts`), map highlight (`highlight.ts`), name↔FIPS (`counties.ts`), and the `ServiceArea` boundary (`serviceArea.ts`).
- `integration.ts`: pure translation to and from the store and contracts.
- `useServiceAreaExplorer.ts`: local preview and apply state. It adds no store and holds no profile or fit data of its own.
- `useServiceAreaInApp.ts`: wires that hook to `useExplorer()`.
- `ServiceAreaExplorer.tsx`, `CountyPicker.tsx`: the panel. Styles live in `src/styles/service-area.css` and use `app.css` tokens.

## Semantics

- **Geography is not fit.** "Newly reachable" means reachable by location only. Those rows, pins and detail views show no fit label, because the active revision's assessments were made for the old area and often say *Not a fit* for exactly this work. Rows that would drop out keep their current-revision label, so the vendor sees what they'd lose.
- **Counted once.** Duplicate IDs are ignored. Multi-site work is reachable if any confirmed county is selected, so it drops only when none remains.
- **Statewide** work is reachable from any non-empty area and is called out separately.
- **Unknown stays unknown.** Missing locations, `precision: "unknown"`, a city without a county, and non-Washington county names sit in a **Not tied to a county** bucket that county changes never move. **Remote** work sits there too. Display points are never used to place work.
- **Agency-derived locations.** A location with `resolutionMethod: "agency_record"` was copied from the issuing agency's record. It never counts toward confirmed before/after numbers, never makes work "newly reachable", and is listed under **Work location not confirmed** with the agency's county shown as agency information. A confirmed site on the same opportunity still counts.
- **Revision safety.** Apply sends the store's current `expectedRevision`. A conflict or failure keeps the preview and explains what happened. A save response older than the active revision is not adopted, and the store reducer now ignores an older `profile/set` as well.
- **Honest status.** After Apply the footer says what actually happened. In fixture mode it reads "Saved for this session… re-checked by simulated development rules". In live mode it reads "recalculated by the matching service" only when `meta.mode === "live"`. Matching failures say fit labels are unavailable and offer Retry. Nothing claims that a summary or embedding was regenerated.

## Backend and data requirements

**Implemented against (existing contract):**

- `PUT /api/v1/me/profile` body `{ fields, originalDescription, expectedRevision }` returns `{ data: VendorProfile }` with the new `revision`.
- `POST /api/v1/matches` body `{ profileId, profileRevision, filter }` returns `meta.profileRevision` echoed.

**Required behavior, not yet verified against a real backend:**

- `PUT /me/profile` must answer **409 `revision_conflict`** when `expectedRevision` isn't the stored revision, and must not partially apply the change. The UI keeps the preview and asks the user to reload.
- Each confirmed revision should regenerate the text summary and embedding server-side (ONB-13). The explorer doesn't depend on it and doesn't claim it.
- `GET /opportunities` must apply county and viewport filters exactly as `queryCatalog` does, because the explorer omits them and relies on that.

**Proposed for workstream C (contract change, not yet agreed):**

- Add `"agency_record"` to `PerformanceLocation.resolutionMethod` for values copied from the source or agency record. Today `scripts/pull_bids.py` copies `county`, `city`, `lat` and `lng` from the source record, and `docs/supabase-frontend-integration.md` maps them into `countyNames` and `displayPoint`. The explorer recognizes the marker at runtime already. Until producers set it, such records are indistinguishable from real work sites.
- Extract place of performance from listings and documents, and keep location provenance (`resolutionMethod`, `rawLocationText`, `evidenceRef`) so county-level comparisons rest on work-location evidence.
- Follow-up for the main map (workstream A): `agency_record` locations shouldn't be pinned as work sites either. This PR only changes the explorer's counts.

## Verification

- `npm test` runs `tests/serviceArea.*.test.ts`, alongside the existing suites.
  - Name↔FIPS from the map's data.
  - Location scope, including the agency-record regression ("an agency's county alone cannot make an opportunity newly reachable").
  - Partition and count invariants on the real fixtures.
  - Preview, cancel and apply reducer.
  - Profile payload and `expectedRevision` over the real HTTP adapter.
  - Geography-free catalog input.
  - A headless `ExplorerProvider` showing exactly one matching refresh after Apply, abort and drop of a superseded revision's response, and conflicts that change nothing.
- `npm run typecheck`, `npm run build` and `npm run build:artifact`.
- In-app walkthroughs on `next start`. These are kept outside the repo; see PR #6 for results.
