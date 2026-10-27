"""
convert_to_okf.py  -  turn a markdown wiki (like KnowledgeForge's) into a
conformant OKF v0.2 bundle, keeping every existing front matter field.

What it changes, and nothing else:
  * adds the required `type` field, derived from `domain` (or the folder name)
  * writes comma-separated `tags: a, b` as a YAML list `tags: [a, b]`
  * gives files with no front matter a minimal block (type + title)
  * strips front matter from index.md files, as OKF section 8 requires
  * repairs YAML broken by unquoted colons, e.g. `title: Foo: bar`
  * renames index.md files that are real pages (40+ words of prose outside
    link-list lines like `- [Page](page.md) - summary`, as site
    generators like Hugo and Next produce) to overview.md, because OKF
    reserves index.md for directory listings and they would otherwise be
    skipped; the bundle root index.md is left alone
The original folder is never modified; the bundle is written to a new folder.

Usage (or `datamap okf`, which also writes the documents table):
    python -m datamap.convert_to_okf ../knowledgeforge/wiki kf_bundle
"""
import re
import shutil
import sys
from pathlib import Path

import yaml

TYPE_NAMES = {  # domain -> OKF type (a descriptive name; OKF has no fixed list)
    "diagnostics": "Diagnostic", "patterns": "Pattern", "methodologies": "Methodology",
    "infrastructure": "Infrastructure Note", "orchestration": "Orchestration Note",
    "integration": "Integration Note", "debugging": "Debugging Note",
    "architecture": "Architecture Decision", "strategy": "Strategy",
    "migrations": "Migration", "compiler": "Compiler Note", "performance": "Performance Note",
}


def type_for(meta, rel):
    domain = str(meta.get("domain") or "").strip() or (rel.parts[0] if len(rel.parts) > 1 else "")
    return TYPE_NAMES.get(domain, domain.replace("-", " ").title() or "Note")


def is_content_page(body, min_words=40):
    """True if body has at least min_words of prose, not just a list of links."""
    words = 0
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # - [text](url), with or without a description after it: a directory listing
        # entry, whose text only summarises the linked page
        if re.match(r"[-*+]\s+\[[^\]]*\]\([^)]*\)", line):
            continue
        line = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", line)  # keep link text only
        words += len(line.split())
    return words >= min_words


def convert(src: Path, dst: Path):
    if not src.is_dir():
        sys.exit(f"Can't find the folder {src}. Check the name and try again.")
    if dst.exists():
        sys.exit(f"{dst} already exists; pick a new output folder")
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns(".*"))
    stats = {"typed": 0, "already_typed": 0, "tags_listed": 0, "new_front_matter": 0,
             "index_cleaned": 0, "quoted": 0, "unparseable": [], "index_kept": 0}

    # Index pages with real prose become overview.md so they get typed and mapped.
    for path in sorted(dst.rglob("index.md")):
        if path.parent == dst:
            continue
        text = path.read_text(encoding="utf-8")
        m = re.match(r"^---\n(.*?)\n---\n?", text, re.DOTALL)
        body = text[m.end():] if m else text
        if not is_content_page(body):
            continue
        new = path.with_name("overview.md")
        if new.exists():
            new = path.with_name("overview-page.md")
        path.write_text(body, encoding="utf-8")
        path.rename(new)
        stats["index_kept"] += 1

    for path in sorted(dst.rglob("*.md")):
        rel = path.relative_to(dst)
        text = path.read_text(encoding="utf-8")
        m = re.match(r"^---\n(.*?)\n---\n?", text, re.DOTALL)

        if path.name == "index.md":  # OKF: no front matter in index files
            if m:
                keep = "---\nokf_version: \"0.2\"\n---\n" if rel == Path("index.md") else ""
                path.write_text(keep + text[m.end():], encoding="utf-8")
                stats["index_cleaned"] += 1
            continue
        if path.name == "log.md":
            continue

        if not m:  # no front matter at all: add a minimal block
            h = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
            title = h.group(1).strip() if h else path.stem.replace("-", " ")
            fm = f"type: {type_for({}, rel)}\ntitle: {yaml.safe_dump(title).strip()}"
            path.write_text(f"---\n{fm}\n---\n{text}", encoding="utf-8")
            stats["new_front_matter"] += 1
            continue

        block = m.group(1)
        try:
            meta = yaml.safe_load(block) or {}
        except yaml.YAMLError:
            # Common breakage: an unquoted value containing ": " (e.g. a title).
            # Quote such single-line values and try once more.
            def quote(mq):
                key, val = mq.group(1), mq.group(2).strip()
                if ": " in val and not val[:1] in "\"'[{":
                    stats["quoted"] += 1
                    return f"{key}: " + yaml.safe_dump(val, width=10**9).strip()
                return mq.group(0)
            block = re.sub(r"^([A-Za-z_][\w-]*):[ \t]+(.+)$", quote, block, flags=re.MULTILINE)
            try:
                meta = yaml.safe_load(block) or {}
            except yaml.YAMLError:
                stats["unparseable"].append(str(rel))
                continue

        # tags: a, b  ->  tags: [a, b]   (same tags, OKF list form)
        def listify(mt):
            items = [t.strip() for t in mt.group(1).split(",") if t.strip()]
            stats["tags_listed"] += 1
            return "tags: [" + ", ".join(items) + "]"
        block = re.sub(r"^tags:[ \t]+([^\[\n][^\n]*)$", listify, block, flags=re.MULTILINE)

        if meta.get("type"):
            stats["already_typed"] += 1
        else:
            block = f"type: {type_for(meta, rel)}\n" + block
            stats["typed"] += 1
        path.write_text(f"---\n{block}\n---\n" + text[m.end():], encoding="utf-8")

    print(f"OKF bundle written to {dst}")
    print(f"  added type to {stats['typed']} files ({stats['already_typed']} already had one)")
    print(f"  converted tags to lists in {stats['tags_listed']} files")
    print(f"  added front matter to {stats['new_front_matter']} files")
    print(f"  removed front matter from {stats['index_cleaned']} index.md files")
    if stats["index_kept"]:
        print(f"  kept {stats['index_kept']} index.md content pages as overview.md "
              "(OKF reserves index.md, so they would otherwise be skipped)")
    if stats["quoted"]:
        print(f"  repaired broken YAML by quoting {stats['quoted']} values that contained a colon")
    if stats["unparseable"]:
        print(f"  could not parse front matter, left unchanged: {', '.join(stats['unparseable'])}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    convert(Path(sys.argv[1]), Path(sys.argv[2]))
