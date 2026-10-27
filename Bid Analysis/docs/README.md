# Docs

Start with the [project README](../README.md) for what Bid Analytics does and how to set it up.

| Doc | What's in it | Lane |
|---|---|---|
| [`system-design.md`](system-design.md) | System design diagram (Mermaid): components, data flow, what's live vs sample vs planned | All |
| [`FRONTEND.md`](FRONTEND.md) | Running, testing and building the map explorer; code layout; the `/api/v1` routes it expects | Product and front end |
| [`../src/serviceArea/README.md`](../src/serviceArea/README.md) | Service Area Explorer: previewing county changes, how it uses the store and map, and the location-provenance requirement for collected bids | Product and front end |
| [`supabase-frontend-integration.md`](supabase-frontend-integration.md) | Field-by-field mapping from the Supabase tables to the app's types | Data integration |
| [`bid-data-model.md`](bid-data-model.md) | The `sources`, `bids` and `leads` tables and every bid field | Bid finding |
| [`diagrams/`](diagrams/) | Eight hand-drawn system flows (PNG and editable Excalidraw) | All |
| [`../data/README.md`](../data/README.md) | The 1,450+ source state and local agency registry and how to rebuild and load it | Bid finding |
| [`../Washington_Contract_Explorer_SRS.md`](../Washington_Contract_Explorer_SRS.md) | Full software requirements spec for the explorer | Product |
| [`demo-video-script.md`](demo-video-script.md) | Script for the demo video | Team |
| [`team/`](team/) | Team slide (PNG and HTML) | Team |

## Scripts

| Script | What it does |
|---|---|
| `scripts/build_seed.py` | Builds `data/sources.seed.json` and `supabase/seed.sql` from the spreadsheet and agency lists |
| `scripts/build_or_id_agencies.py` | Builds the Oregon and Idaho agency lists |
| `scripts/geocode_wa.py` | Adds map coordinates to Washington sources |
| `scripts/pull_bids.py` | Pulls open bids from CivicPlus, OpenGov and OregonBuys into the `bids` table |
| `scripts/audit_sources.py` | Static audit of the registry (missing or suspect procurement links) |
| `scripts/build-artifact.mjs` | Bundles the app into one HTML file for demos |
