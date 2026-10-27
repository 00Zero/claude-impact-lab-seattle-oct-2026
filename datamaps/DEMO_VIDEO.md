# Demo video script (target 2:45)

Judges score five things equally, 1 to 8: **does it work**, **easy for a small
business to set up**, **impact on operations**, **creativity**, **teamwork**.
Each section below is aimed at one of them. The demo is the point, so most of
the time is a real run, not slides.

## Before recording

- Run `/datamap` on `examples/lakeview-cafe/reviews.csv` once already, so the
  90 MB model is cached and the on-camera run takes about a minute.
- Fill in the Team table in README.md (it still has a TODO) and push every
  change, so the repo judges open matches the video.
- Record at 1080p, large terminal font, browser zoom 125%.
- Have open: the GitHub repo page, Claude Code in the repo folder, a browser
  tab ready for `out/lakeview/map.html`.

## Shot list

| Time | Criterion | On screen | Who speaks | What they say |
|---|---|---|---|---|
| 0:00–0:15 | Impact (the problem) | Face to camera, or a long scroll of reviews.csv | Jolie | "A café owner we talked to has hundreds of reviews and survey answers. Nobody reads them all, so the same complaints keep costing them customers. We built a way to hear all of them at once." |
| 0:15–0:40 | Ease of setup | GitHub repo → Code → Download ZIP → open folder in Claude Code → type `/datamap` | Jolie | "No code. Download the project, open it in Claude Code, type slash datamap. Claude asks which file, installs what it needs, and does the rest." |
| 0:40–1:20 | Does it work | Real run on reviews.csv (cut or 4× speed the middle), then map.html opens. Hover a dot, search "mobile order", drag the month filter | Cato (run), Poonam (map) | Cato: "Everything runs on this laptop: a small open-source model groups the 260 reviews. Claude only sees about eight examples per group, to name them." Poonam: "Each dot is a review. Similar ones sit together, and every group has a plain name. Hover to read it, search, filter by month. It's one file you can email to your staff." |
| 1:20–1:50 | Impact (the answer) | insights.md, "Fix these first" section, then the spam and double-post list | Jolie | "And the report says what to do Monday: 22 people say mobile orders aren't ready, average 1.9 stars. Send the 'ready' notice at hand-off, not when the ticket prints. It also flags spam and double posts so they don't skew things." |
| 1:50–2:20 | Creativity | examples/knowledgeforge/map.html, then the DATA_CURATION.md table | John | "The same pipeline maps an owner's own notes. Here, 398 notes from a consultant's second brain become 16 areas, like 'Google Ads and keyword research', each a service they could sell. On the way, it tidies a copy into Open Knowledge Format and found three notes whose broken headers were silently hiding all their tags." |
| 2:20–2:35 | Teamwork | Team table from README, or quick cuts of each person at work today | Poonam | "Five of us: Jolie talked to owners and wrote the README, Cato built the skill and the report, Poonam the map and this video, John the pipeline, and Brendan, our mentor, set it up cold from the README to prove it works." |
| 2:35–2:45 | Close | Repo URL and the map | John | "Datamaps for Small Business. Open source today. Your data stays on your computer." |

Edit the Teamwork line once the README Team table is final; it must match it.

## If there is time

- Show `web/index.html` (the owner-facing page) for 10 seconds after the map,
  as where this goes next.
- Add on-screen captions for the three numbers: 260 reviews, 22 people at
  1.9★, 398 notes.
