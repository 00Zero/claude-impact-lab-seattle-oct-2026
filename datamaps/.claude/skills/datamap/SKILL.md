---
name: datamap
description: Turn a small business's pile of text into an interactive map of what's in it plus a plain-language report with suggested actions. Works on customer text (reviews, survey answers, support emails, feedback forms), on notes (an Obsidian vault, a wiki, a "second brain", an OKF knowledge bundle, a folder of documents) and on websites (Claude reads the pages itself). Use when the user types /datamap, asks what their customers are saying, wants to make sense of a lot of reviews or feedback, or wants to see what is in their notes or documents.
---

# /datamap: see everything in your business's text at once

The person you are helping is usually a small business owner, not a developer.
Talk to them in plain words: say "groups", "map" and "report", never
"embeddings", "UMAP", "HDBSCAN", "clusters", "front matter" or "parquet". Run
every command yourself.

All commands run from the repository root: the folder that holds
`pyproject.toml` and `.claude/skills/datamap`. When this skill was installed by
linking it into `~/.claude/skills/`, find that folder with
`git -C <this skill's folder> rev-parse --show-toplevel` (it follows the link).
The owner's files can be anywhere; pass their full path.

If someone asks to install this skill from the repository's URL: clone it (for
example to `~/datamap-skill`), run `uv sync` there (install uv first if it's
missing), and link `.claude/skills/datamap` into `~/.claude/skills/datamap`
(`ln -s` on macOS/Linux, `mklink /J` on Windows). Then tell them to type
`/datamap` in any folder. To update, `git pull` in the clone.

## 1. Find their data

If they didn't say what to map, ask once: "What would you like to map? A CSV or
Excel export of reviews or survey answers, a folder of notes or documents, or a
website?"
Pick a short run name, e.g. `reviews-oct` or `my-notes`. Then decide the route:

| They have | Route |
|---|---|
| CSV or Excel export (reviews, survey, help desk, form answers) | Go to step 3 with the file. |
| Folder of markdown notes (wiki, Obsidian vault, second brain, OKF bundle) | Step 2 first, then step 3. |
| Folder of PDFs or `.txt` files | Go to step 3 with the folder. |
| A website (their own site, help center, blog) | Read it yourself (below), then step 2 with that folder, then step 3. |

Website: read it yourself with your web tools and save one markdown note per
page in `out/<run-name>/site/` (file name from the page's path, e.g.
`meeting-rooms.md`). Find the pages from the site's sitemap (`/sitemap.xml`,
`/sitemap_index.xml` or `/wp-sitemap.xml`) or its menus. Skip category, tag,
author and other listing pages; they only repeat other pages. Start each note
with front matter, then the page's main text without menus or footers:

```
---
type: Web Page
title: <the page's title>
resource: <the page's address>
date: <YYYY-MM-DD, only if the page shows one>
---
```

Aim for the pages that matter, up to about 150, and tell the owner how many you
saved. Only read a site the owner runs or has permission to read, and respect
its robots.txt. Clicking a dot on the final map opens the live page.

CSV/Excel: the text column is detected automatically (the one with the longest
entries). If the wrong one gets picked, rerun with `--text-col "<column name>"`.
A `rating`/`stars` column and a `date` column are used automatically. Exports
from Google reviews, Yelp, Shopify, Typeform, Google Forms and most help desks
are fine as they are.

A map needs at least 10 items and works best from about 100 up.

## 2. Notes folders: check and tidy them into an OKF bundle

Markdown notes are turned into an Open Knowledge Format (OKF) bundle first.
That makes every note readable by AI tools, and it finds problems the owner
can't see. The owner's folder is never changed; the tidied copy goes into
`out/<run-name>/okf_bundle`.

```
uv run datamap okf "<notes folder>" --out out/<run-name>
```

If the first command says the bundle folder already exists, it's from an
earlier run with the same name: delete `out/<run-name>/okf_bundle` (only that
folder, which this skill made) or pick a new run name.

Tell the owner, in one or two plain sentences, what the check found. For
example: "392 of your 398 notes were missing a label saying what kind of note
they are, so I added one. 3 notes had a typo in their header that hid their
tags from any AI tool; that's fixed in the copy. Two notes are identical; I
left both for you to decide." Don't name YAML, fields or OKF sections.

Then go to step 3 with `out/<run-name>/documents.parquet`.

## 3. Prepare (runs on this computer)

```
uv run datamap prepare "<file, folder, or out/<run-name>/documents.parquet>" --out out/<run-name>
```

If `uv` is missing, install it first (https://docs.astral.sh/uv/) and tell the
owner it's a one-time step. The first run downloads a small language model
(about 90 MB) and takes a few minutes; later runs take about a minute.

Tell the owner how many items and groups were found.

## 4. Name the groups (your job)

Read `out/<run-name>/briefing.md`. It lists every group with its size, average
rating, keywords and its most typical examples, then the most unusual
documents. Overwrite `out/<run-name>/labels.json`, keeping this shape:

```json
{
  "title": "What <business>'s customers are saying",
  "flags": {"r094": "crypto spam"},
  "clusters": {
    "0": {"label": "Long weekday morning lines",
          "summary": "One sentence on what these say.",
          "action": "One concrete thing the business could do."}
  }
}
```

- Every group number in the briefing needs an entry with a non-empty `label`.
  Groups are renumbered on every `prepare`, so always label from the current
  briefing, never from an older `labels.json`.
- `label`: 2 to 5 words in the owner's or customer's language ("Mobile orders
  not ready", "Google Ads and keyword research"). Make labels distinct.
- `summary`: one sentence. Mention it if a group mixes two topics.
- `action`: specific and doable this month by a small team, or `""` if there's
  nothing to do.
  - Customer text: a fix ("Add a third person 7:30 to 9:30 on weekdays").
  - Notes: what the owner could do with that knowledge, such as a service to
    sell, a guide to publish, or notes to merge ("Package as a paid workshop").
- `flags`: from the "Most unusual documents" list, only the ones that don't
  belong (spam, scams, reviews meant for another business), with a 2 to 4 word
  reason. Leave real one-offs out. Notes folders rarely have any.
- `title`: use the business's name if you know it.

Only the briefing goes into your context, not the whole dataset.

## 5. Render

```
uv run datamap render --out out/<run-name>
```

If it reports a missing or empty label, fix `labels.json` and run it again.

If the owner asks for the CORD-19 look (serif title, outlined groups, like
DataMapPlot's CORD-19 map), add `--style cord19`. Re-rendering only redraws the
map, so switching looks is quick.

For notes and documents, clicking a dot opens the original file. Those links
only work on this computer. If the notes are also published as a website (for
example a Hugo site built from the same OKF bundle), add
`--link-base <site URL>` so clicks open `<site URL>/<note path, lowercased,
spaces as hyphens>/` instead. Open one link to check that it matches the site.

## 6. Hand it over

Open `out/<run-name>/map.html` for them (`start` on Windows, `open` on macOS,
`xdg-open` on Linux). Then, in a few short lines:

- Customer text:
  1. The top 3 items from "Fix these first" in `insights.md` (or the biggest
     groups if there are no ratings).
  2. One thing customers love, worth keeping or advertising.
  3. Anything under "Worth a look" (spam to report, double posts).
- Notes:
  1. The 3 biggest areas of knowledge and what they could become (a service,
     a guide, a workshop).
  2. What the tidy-up in step 2 fixed, and any duplicates to decide on.
  3. One unusual note worth a second look.

Tell them that `map.html` is a single file they can email to a partner or
employee, and `insights.md` is the full report.
