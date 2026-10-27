# Demo site

`index.html` introduces the `/datamap` skill. It shows three datamaps made in real `/datamap`
sessions, each next to an example conversation built on that map: `maps/knowledgeforge.html`
(585 notes from the KnowledgeForge repo), `maps/thinkspace.html` (629 pages of thinkspace.com)
and `maps/sourcegraph.html` (837 pages of Sourcegraph's public handbook). Highlighted regions
and searches in the conversation drive the map beside it, and the page links to
https://connoiter.com/datamap/ for more demos. To swap in
a new map, replace the file in `maps/` and update the conversation's numbers to match.

Published on GitHub Pages by `.github/workflows/pages.yml`. To preview locally, serve the
repository root (`python -m http.server`) and open http://localhost:8000/web/.

# Builder prototype (`builder.html`)

A static page a small business owner visits to say what they want to map, hand over their files with a note on each, and see the datamap.
No build step, no Hugo.

## Flow
1. **What to map.** "One dot per…" customer, product or service, message or request, document or note, or something else (free text). Plus an optional "what are you hoping to spot?" and an optional business name and one-line description.
2. **Your files.** Add files, folders or GitHub links. Each file picked on its own and each folder becomes one *source*, and every source gets a "What's in here?" note.
   The **Build the map** button is at the bottom of this step. It shows a progress screen while the pipeline runs, then opens the map.
3. **Your datamap.** The map in a frame, with a list of regions.

Samples on the page:
- **Lakeview Café** (default): 260 made-up reviews, one dot per review. Map and report are the real output of the team's `/datamap` pipeline (github.com/Connoiter/claude_for_small_businesses_hackathon, `examples/lakeview-cafe`).
- **Northside Yoga**: 238 made-up member survey answers, one dot per answer. Map and report from the team pipeline (`examples/northside-yoga`; data from `demo-data/`).
- **Rainier Paws**: 241 made-up dog grooming reviews, one dot per review. Map and report from the team pipeline (`examples/rainier-paws`; data from `demo-data/`).
- **Fern & Kettle**: made-up tea shop one dot per customer, six sources with owner notes. Its map comes from the simpler stand-in pipeline, so it has no report.
- **KnowledgeForge**: 398 real notes, one dot per note. Map and report from the team pipeline (`examples/knowledgeforge`).

Samples always open their ready-made map, so the demo never waits on the pipeline.

The last step shows the pipeline's `map.html` in a frame, a list of regions, and a **Report** tab that renders `insights.md`.

## Files
- `index.html`: the site. The Lakeview and KnowledgeForge samples load `../examples/*/map.html` and `insights.md`, so serve the repository root, not just this folder: `python3 -m http.server` from the root, then open http://localhost:8000/web/.
- Maps use this page's look (fonts, colours, cards) from `datamap/theme.py`. Each `map.html` embeds Bricolage Grotesque and Atkinson Hyperlegible (both SIL OFL 1.1, licenses in `datamap/assets/fonts/`), so it looks the same offline.
- `vendor/marked.min.js`: marked 12.0.2 (MIT), kept local so the Report tab renders without internet.
- `teashop-datamap.html`: the Fern & Kettle customer map (made with a simpler stand-in pipeline), with its scripts inlined.

## Handoff contract (draft, for Puna and whoever runs the map step)
Run `uv run datamap serve` from the repository root (code in `datamap/server.py`). It serves this page at http://localhost:8000/web/, and the page connects to it on its own. Build then sends the owner's own files (samples stay ready-made):
- `POST {PIPELINE_URL}/jobs`, multipart: a `manifest` field (JSON below) plus one `files` part per uploaded file, named `{source id}/{path}`. Returns `{"job_id": "..."}`.
- `GET {PIPELINE_URL}/jobs/{job_id}` returns `{"stage": "okf|embed|cluster|name|render", "status": "running|done|failed", "map_url": "...", "report_url": "...", "regions": [{"name": "...", "count": 0}], "error": "..."}`.

```json
{
  "schema": "datamap-job/0.3",
  "map": {"unit": "customer | product | conversation | document | other", "unit_label": "only when unit is other", "goal": "optional"},
  "business": {"name": "optional", "description": "optional"},
  "sources": [
    {"id": "s1", "kind": "upload", "label": "shopify_orders.csv",
     "description": "My Shopify orders export. Each row is one item in an order; the email is the customer.",
     "files": [{"path": "shopify_orders.csv", "bytes": 137972}]},
    {"id": "s2", "kind": "github", "label": "github.com/owner/repo", "url": "https://github.com/owner/repo", "subfolder": "wiki", "description": "..."},
    {"id": "s3", "kind": "website", "label": "yourbusiness.com", "url": "https://yourbusiness.com/", "description": "..."}
  ]
}
```

A `github` source is cloned. A `website` source isn't read by the server: websites are read by Claude through the `/datamap` skill in the Claude app, which saves each page as a note that links back to the live page.

**How the converter should use it:** `map.unit` decides what gets one OKF note each. Per customer, that means joining rows from every source about the same person (see `customer-datamap/join_to_okf.py`). Per document, it means one note per file. Each source's `description` says how to read that file, for example which column is the customer. `goal` and `business.description` mostly help with naming regions, and may help choose which fields go into each note.
