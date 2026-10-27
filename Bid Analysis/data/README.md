# Source registry

State and local agencies in WA, OR and ID that post bids. Federal bids (SAM.gov) are out of scope. The agent searches these at runtime.

- `sources.seed.json`: the registry, checked into git. Generated, then improved by discovery.
- `../supabase/migrations/`: schema for `sources`, `bids` and `leads`, with RLS.
- `../supabase/seed.sql`: upsert of the seed, safe to run repeatedly.

## Rebuild the seed from the spreadsheet

    pip install openpyxl
    python3 scripts/build_seed.py

## Load into Supabase

Apply the migration once (`supabase db push`, or paste it into the SQL editor), then run
`supabase/seed.sql` the same way. Only one person applies migrations; propose schema
changes as a PR with a new migration file.

## Fields worth knowing

- `status`: `candidate` has a procurement URL nobody has checked yet, `missing` has none,
  `verified` was confirmed to list bids, `dead` is gone.
- `platform`: shared portals (bidnet, bonfire, opengov, questcdn, civicplus, webs, ...)
  so one extractor can cover many agencies. `custom` means a one-off agency page.
- `raw`: the original spreadsheet row, kept for reference.
