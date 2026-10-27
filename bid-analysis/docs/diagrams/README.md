# System flows

Hand-drawn system diagrams for Bid Analytics. Each one is a PNG plus an `.excalidraw` source you can open and edit at [excalidraw.com](https://excalidraw.com) (File, then Open).

Dashed boxes are planned work. The tags mean:

- **simulated**: a labeled stand-in that runs today.
- **not deployed**: code that is in this repo but not live yet.
- **in review**: from an open pull request.

| Flow | What it shows |
|---|---|
| [01 Before and after](01-before-after.png) | The vendor's problem today, and the two pipelines that solve it |
| [02 User journey](02-user-journey.png) | Sign-in, exploring the map, personalizing, then save, contact or book a call with Jon |
| [03 Data pipeline](03-data-pipeline.png) | Agency lists to the source registry, then `pull_bids.py` to the `open_bids` view |
| [04 Profile and matching](04-matching.png) | Interpretation, revisioned profiles, rule checks, similarity and fit labels |
| [05 Stale-response guard](05-revision-race.png) | Why a slow answer for revision 2 never overwrites revision 3 |
| [06 Service Area Explorer](06-service-area-explorer.png) | Previewing a service-area change before saving it (draft PR #6) |
| [07 Frontend architecture](07-frontend-architecture.png) | UI, store, the `ExplorerServices` boundary, fixtures versus live |
| [08 Deployment](08-deployment.png) | GitHub to Vercel, config, and where secrets live |
