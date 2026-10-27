# Datamaps for Small Business

Map the oceans of data in your small business's LLM Wiki. This repo
contains an Agent Skill, `/datamap`, that turns your Open Knowledge
Format (OKF) formatted second brain, OpenWiki, LLM Wiki,
etc. Into a highly visual and interacive datamap.

**[See the live demo →](https://connoiter.github.io/claude_for_small_businesses_hackathon/)** Three real datamaps made with `/datamap` (a consultant's 587 notes, thinkspace's 629-page website and Sourcegraph's 835-page handbook), each next to an example conversation showing how an owner works with the map, plus two much bigger maps from [connoiter.com/datamap](https://connoiter.com/datamap/). No install needed.

## Introduction

Give Claude all your data in a private LLM Wiki, formatted in the new standard
for second brains, Google's Open Knowledge Format (OKF). A few minutes later
you get **a visual map of your small business's data that your agent has in
its wiki.** Similar comments sit together, each group is named in plain words,
and you can hover over any dot to read the comment. It's one file you can
email to your partner or staff. It opens in any browser and keeps working
offline, because the map's data and code are inside the file.

You don't need to write any code, and your files stay on your computer:
Claude only reads a few examples from each group so it can name the groups.
(For a website, Claude reads the public pages itself to save them as notes.)

### Example: your own notes

It works on your own notes too. Point it at a folder of documents, such
as an Obsidian vault, a "second brain", or an
[OKF](https://www.gitbook.com/blog/what-is-okf-open-knowledge-format) bundle,
and it shows what you know and which topics you could sell as a service. See
[`examples/knowledgeforge`](examples/knowledgeforge): 398 notes from a solo
consultant's knowledge base, grouped into 16 areas like "Running teams of AI
agents" and "Google Ads and keyword research".

### Example: a café's reviews

> **See it first:** download [`examples/lakeview-cafe/map.html`](examples/lakeview-cafe/map.html)
> and open it in your browser, then read the
> [report](examples/lakeview-cafe/insights.md). It maps 260 reviews of
> Lakeview Coffee & Bakery, a made-up Seattle café (the reviews are synthetic).

From the example report:

> **Fix these first**
> 1. **Mobile orders not ready**: 22 people, average 1.9★. Send the 'ready'
>    notification when the drink is handed off, not when the ticket prints.
> 2. **Long weekday morning lines**: 21 people, average 2.4★. Add a third
>    person on weekdays from 7:30 to 9:30.
> 3. **Loyalty app losing points**: 15 people, average 2.3★. Restore lost points
>    for anyone with a screenshot.


## Getting started

### What you need

- [Claude Code](https://claude.com/claude-code), with any paid Claude plan.
- Nothing else to download yourself. Claude installs the skill and its tools
  ([uv](https://docs.astral.sh/uv/) and a few Python packages) for you.
- Ideally an OKF Bundle but the skill can also make OKF Bundles out of,
  say, CSV or Excel export of your customer text, or a folder of
  documents (`.md`, `.txt`, `.pdf`). 
  
  

### Set up (once)

Open Claude Code (in the Claude desktop app or the terminal) and ask:

```
Install the /datamap skill from https://github.com/Connoiter/claude_for_small_businesses_hackathon
```

That's it: no ZIP, no code. Claude downloads the project, installs what it
needs and makes `/datamap` available in every folder, so you can run it right
where your files are. To get improvements later, ask Claude to *"update the
datamap skill"*.

<details>
<summary>What Claude does when it installs the skill</summary>

1. Clones the repository, for example into `~/datamap-skill`.
2. Runs `uv sync` there (installing [uv](https://docs.astral.sh/uv/) first if
   it's missing).
3. Links the skill into your personal skills folder so it works anywhere:
   - macOS / Linux: `ln -s ~/datamap-skill/.claude/skills/datamap ~/.claude/skills/datamap`
   - Windows: `mklink /J "%USERPROFILE%\.claude\skills\datamap" "%USERPROFILE%\datamap-skill\.claude\skills\datamap"`

Updating is `git pull` in that folder. Opening the cloned folder itself in
Claude Code also works; the skill is found there automatically.
</details>

### Use it

Type:

```
/datamap
```

Claude asks which file or folder to map, runs everything, names the groups,
and opens the map. You can also just say, for example, *"what are my customers saying in
reviews.csv?"* or *"what's in my notes folder?"* or *"map my website, https://yourbusiness.com"*

If you give it a folder of notes, Claude first checks and tidies a copy of
them (your folder is never changed). It tells you what it found, such as
notes missing a label, headers too broken for AI tools to read, or the same
note saved twice. See [DATA_CURATION.md](DATA_CURATION.md) for what this found
in a real knowledge base.

The first run downloads a small language model (about 90 MB) and takes a few
minutes. Later runs take about a minute.



## Built on the King Tutte Datamap Scrolls

<div align="center">
  <a href="https://en.wikipedia.org/wiki/Mask_of_Tutankhamun">
    <img src="./images/king_tutte_funerary_mask.png" width="100%" alt="Funerary mask of Bill Tutte" />
  </a>
  <p>Funerary mask of Bill Tutte</p>
</div>

We coded this with Claude Code, using the
[King Tutte Datamap Scrolls](https://github.com/Connoiter/king_tutte_datamap_scrolls)
as our datamap SDK. The Scrolls are a how-to manual for building
"King Tutte pipelines": code, docs, papers and recorded talks for the
open-source datamapping tools from the
[Tutte Institute for Mathematics and Computing](https://github.com/TutteInstitute),
gathered in one place so a developer, human or agent, can build datamaps
from them. Claude read the Scrolls and built this repo's pipeline from them:

- **The pipeline shape.** Embed the text, lay it out with UMAP, group it with
  HDBSCAN, and draw it with DataMapPlot, as the Scrolls describe.
- **The `documents` table.** For notes folders, `/datamap` writes the `documents` table
  (`id`, `text`, `title`, `url`) that the Scrolls specify for Seshette, their
  generic `/datamap` toolkit, so this repo can switch over to Seshette's
  scribes when they ship.
- **The small-business part is ours.** Reading review exports, tidying notes
  into OKF, having Claude name the groups, and the plain-language report.

### Why "King Tutte"?

Bill Tutte was the British-Canadian codebreaker and
mathematician the Tutte Institute is named after. The name is a nod to King
Tut, who has been immortalized in song, as
[can be seen on YouTube](https://www.youtube.com/embed/k-fc3UrLRLQ?autoplay=1&mute=1&loop=0).

<div align="center">
  <a href="https://www.youtube.com/embed/k-fc3UrLRLQ?autoplay=1&mute=1&loop=0">
    <img src="./images/king_tut_on_snl.jpg" alt="King Tut on SNL, 1978" width="50%" />
  </a>
</div>

## For developers

The skill is [`.claude/skills/datamap/SKILL.md`](.claude/skills/datamap/SKILL.md).
It drives a short command line:

```
# Notes folders only (a website becomes one when Claude saves its pages as notes):
# tidy a copy into an OKF bundle, then write Seshette's documents table
uv run datamap okf <notes folder> --out out/<name>

uv run datamap prepare <csv|xlsx|folder|documents.parquet> --out out/<name>   # read → embed → lay out → group
# Claude reads out/<name>/briefing.md and writes out/<name>/labels.json
uv run datamap render --out out/<name>                                        # map.html + insights.md
```

<div align="center">
  <a href="https://connoiter.com/blog/data_map_pipeline/">
    <img src="./images/data_map_pipeline.jpeg" width="80%" alt="King Tutte datamap pipeline" />
  </a>
</div>

| Stage | Tool |
|---|---|
| Tidy notes into OKF | [`datamap/convert_to_okf.py`](datamap/convert_to_okf.py), [`datamap/okf_to_documents.py`](datamap/okf_to_documents.py) |
| Embed | [sentence-transformers](https://www.sbert.net/) `all-MiniLM-L6-v2`, on the CPU |
| Lay out | [UMAP](https://github.com/lmcinnes/umap) |
| Group | [fast_hdbscan](https://github.com/TutteInstitute/fast_hdbscan) |
| Name groups, flag spam | Claude, from `briefing.md` |
| Render | [DataMapPlot](https://github.com/TutteInstitute/datamapplot), single file |

Options: `prepare` takes `--text-col`, `--title-col` and `--min-cluster-size`. `render` takes
`--style site|cord19` (the default look matches the demo page; `cord19` mimics DataMapPlot's
CORD-19 map) and `--link-base <site URL>`. Clicking a dot normally opens the original file (for folders and
OKF bundles); with `--link-base` it opens that document's page on a site built from the same
folder instead, for example a Hugo site of the OKF bundle.

`uv run datamap serve` runs the earlier file-upload prototype (`web/builder.html`) locally with
the pipeline behind its Build button; groups are named with headless Claude Code. The demo
site (`web/index.html`) is static and published to GitHub Pages by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml); see [`web/README.md`](web/README.md).

## Hackathon

### Credits

This is a "King Tutte pipeline": the open-source datamapping tools from the
[Tutte Institute for Mathematics and Computing](https://github.com/TutteInstitute)
(UMAP, HDBSCAN, DataMapPlot), packaged for small businesses. The pipeline
design comes from the
[King Tutte Datamap Scrolls](https://github.com/Connoiter/king_tutte_datamap_scrolls)
and [Connoiter](https://connoiter.com/blog/).

Built at the Claude for Small Business hackathon, Seattle, October 25, 2026.

### How this meets the judging criteria

The demo video follows the same five criteria; its script and shot list are in
[DEMO_VIDEO.md](DEMO_VIDEO.md).

#### Does it work

Yes, end to end. `/datamap` will read an OKF Bundle and generate an HTML file
that is the datamap there of.

If the data to be datamaped is not OKF compliant, the OKFifier part can read a
CSV, Excel file, folder or website, groups the text, has Claude name the
groups, and writes the map and report. Everything in [`examples/`](examples) is
real output from it: 260 café reviews ([`lakeview-cafe`](examples/lakeview-cafe)),
238 yoga survey answers ([`northside-yoga`](examples/northside-yoga)), 241
grooming reviews ([`rainier-paws`](examples/rainier-paws)) and 398 real notes
([`knowledgeforge`](examples/knowledgeforge)). So are the three maps on the
[demo site](https://connoiter.github.io/claude_for_small_businesses_hackathon/):
587 KnowledgeForge notes, 629 pages of thinkspace.com and 835 pages of
Sourcegraph's handbook. An owner could try it today on their own review export.

#### Ease of setup for a small business

No code and no download. Ask Claude to install the skill from this
repository's URL, then type `/datamap`. Claude asks which file to use and
installs `uv` if needed. The result is a single `map.html` that opens in any
browser and can be emailed to staff.

#### Impact on the business's operations

All small businesses of any level of AI sophistication are building out their
own private LLM Wiki, second brain, OpenWiki, GBrain knowledge base. The
industry is converging on [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md). 

This Agent Skill will help them make their knowledge base OKF compliant if needed 
and then datamap it. The output is a static HTML file, which loads correctly
from a file URL. No backend need at all, no complex installs, no configuring
and adopting a complex RAG pipeline. Nonetheless, many of the benefits
of such are provided by the datamap. 

This way small businesses can instantly and simply start on their LLM Wiki
journey with nothing more than showing Claude the repo:

https://github.com/Connoiter/claude_for_small_businesses_hackathon


#### Creativity

Unless you are deep into cutting edge Topological Data Analysis, you
may well have never seen a datamap map before.

Datamaps are a next level play wherein modern transformer based and
neural embeddings are married with traditional unsupervised machine
learning techniques.

Datamaps are a base visualizaton of large collections of embeeding
vectors that are exploding in numbers. Think mobile phone generating
a need for Flickr to process and visualize large colletions of images.
In this case, the embedding vectors are the exploding new datatype
and like Flickr datamaps allow us to handle large collections of 
embedding vectors.

#### Teamwork

Every member had a distinct role, listed in the table below:
owner research and pitch, the Claude skill and report, the map and demo video,
the pipeline, and a cold-start test of the README. Work landed as separate pull
requests from different members: the skill and pipeline ([#1](https://github.com/Connoiter/claude_for_small_businesses_hackathon/pull/1),
[#2](https://github.com/Connoiter/claude_for_small_businesses_hackathon/pull/2)), the owner web page ([#3](https://github.com/Connoiter/claude_for_small_businesses_hackathon/pull/3), [#5](https://github.com/Connoiter/claude_for_small_businesses_hackathon/pull/5)),
and the OKF converter and CORD-19 style ([#6](https://github.com/Connoiter/claude_for_small_businesses_hackathon/pull/6), [#7](https://github.com/Connoiter/claude_for_small_businesses_hackathon/pull/7),
[#8](https://github.com/Connoiter/claude_for_small_businesses_hackathon/pull/8)).

### Team


| Who | Role |
|---|---|
| John Tigue | Lead; King Tutte pipeline; project conceptor; live demo |
| Cato Lin | `/datamap` skill, ingest, Claude labeling, insights report |
| Poonam Sharma | Map experience, sample data, demo video |
| Jolie Martin | OKFifyer, use case, README, pitch |

## License

[Apache-2.0](LICENSE)

<div align="center">
  <img src="./images/tutte_pectoral_scarab_icon.png" width="25%" alt="Tutte pectoral scarab" />
</div>
