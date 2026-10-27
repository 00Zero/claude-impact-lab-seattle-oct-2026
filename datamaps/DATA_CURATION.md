# Data curation: KnowledgeForge wiki to OKF v0.2

This part of the project gets real data ready for the datamap pipeline. It takes the wiki from [KnowledgeForge](https://github.com/internexio/knowledgeforge), turns it into a conformant [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog) v0.2 bundle, and writes the `documents` table that Seshette (`/datamap`) reads before its Embedder runs.

The KnowledgeForge wiki is a good real world test case: 399 markdown notes written by people and agents over several months, sorted into folders like diagnostics, patterns and infrastructure. It looks like an LLM wiki, but like most real knowledge bases it doesn't quite follow the standard.

## What we found in the raw data

| Issue | Count | What it means |
| --- | --- | --- |
| Missing the required OKF `type` field | 393 of 398 concepts | Not a conformant OKF bundle as is |
| Tags written as `tags: a, b` instead of a YAML list | 299 files | Tools expecting OKF's list form would read them as one long string |
| Broken YAML from an unquoted colon in the title | 3 files | Any tool reading these silently loses every tag and field |
| `index.md` carrying front matter | 1 file | OKF reserves `index.md` and allows no front matter there |
| File with no front matter at all | 1 file | `operations/routing-log/2026-08.md` |
| Identical text saved twice | 1 pair | Same note in `integration/` and `patterns/` |

The broken YAML is the one worth remembering. Titles like `Chrome Extension MV3: CORS-free API calls` look fine to a person, but the colon makes the whole front matter block unreadable to a parser, so the file quietly loses its metadata.

## What the converter changes

[`datamap/convert_to_okf.py`](datamap/convert_to_okf.py) copies the wiki to a new folder and never touches the original. It makes only the changes OKF needs. It adds `type` based on each file's `domain` (diagnostics becomes `Diagnostic`, patterns becomes `Pattern`, and so on). It rewrites tags into list form while keeping the same tags. It quotes values that contain a colon so the YAML parses. It removes front matter from `index.md` (keeping `okf_version: "0.2"` at the bundle root) and gives the one bare file a minimal header.

Everything else is left exactly as it was. Every original front matter field is kept, and the markdown body of each file is unchanged. We checked this by comparing files before and after.

Site generators like Hugo and Next use `index.md` as a real page, which OKF would skip, so the converter renames any `index.md` below the root with 40+ words of prose (not counting folder-listing lines like `- [Page](page.md) - summary`) to `overview.md`; on the [Sourcegraph handbook](https://github.com/sourcegraph/handbook) this keeps 139 pages that would otherwise vanish from the map (696 documents become 835).

We left the duplicate in place on purpose. Deleting data is a decision for the bundle's owner, so the tools report it instead.

## What the mapper produces

[`datamap/okf_to_documents.py`](datamap/okf_to_documents.py) reads any OKF bundle and writes two files.

`documents.parquet` follows Seshette's `documents` table: `id` (the OKF concept ID, meaning the path without `.md`), `text` (the body), `title` (from front matter, then the first heading, then the filename) and `url` (a `file://` link, so clicking a point on the map opens the file).

`okf_metadata.parquet` holds the OKF fields Seshette's fixed schema has no column for: folder, type, domain, topic, tags, related entries, status, `stale_after`, and the trust tier from OKF section 5.3 (unverified, machine-confirmed or human-reviewed). These are useful for coloring the map and for flagging stale or unverified content.

The mapper skips reserved files (`index.md`, `log.md`) and hidden folders, checks that every concept has a `type`, and warns about very short documents and exact duplicates, as the Seshette spec asks callers to do.

## Running it

The `/datamap` skill runs both steps for you whenever you give it a folder of
notes. To run them by hand, from this repo with KnowledgeForge cloned next to it
(`uv` installs the dependencies from `pyproject.toml` on first run):

```
uv run datamap okf ../knowledgeforge/wiki --out out
```

This writes the bundle to `out/okf_bundle` and the documents table to
`out/documents.parquet`. Each step also runs on its own:
`uv run python -m datamap.convert_to_okf <wiki> <bundle>` and
`uv run python -m datamap.okf_to_documents <bundle> --out-dir <folder>`.

Expected output:

```
OKF bundle written to out/okf_bundle
  added type to 392 files (5 already had one)
  converted tags to lists in 299 files
  added front matter to 1 files
  removed front matter from 1 index.md files
  repaired broken YAML by quoting 3 values that contained a colon

Wrote 398 documents to out/documents.parquet
  skipped index.md: reserved OKF file
  warning: identical text in integration/2026-05-21_vendor-in-decision-framework-flat-script-python, patterns/2026-05-21_vendor-in-decision-framework-flat-script-python
```

After this, all 398 concepts are OKF v0.2 conformant and `out/documents.parquet` is ready for the Embedder.

## Why this matters for small businesses

In the event's own survey of small business owners, unreliable or inaccurate AI output was one of the top two barriers to adopting AI. A big part of that comes from the knowledge AI is given: files that contradict each other, go stale, or can't even be parsed. This curation step shows the problem on real data. A knowledge base that looked fine had almost no conformant files, three files silently losing their metadata, and a duplicate. Checking and fixing that before AI reads it is the first step toward answers a business can trust.

## Next steps

`datamap prepare` reads `out/documents.parquet` directly, along with the type,
domain, topic, trust tier and dates from `okf_metadata.parquet` next to it:

```
uv run datamap prepare out/documents.parquet --out out
# Claude names the groups in out/labels.json (the skill does this)
uv run datamap render --out out
```

Clicking a dot on the map opens that note's file. Still to do: color points by
type or trust tier, and decide with the bundle owner what to do about the
duplicate.
