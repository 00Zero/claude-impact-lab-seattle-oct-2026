"""
okf_to_documents.py  -  the OKF source-specific mapper for Seshette (/datamap).

Seshette is generic: a source-specific caller writes the `documents` table
(id, text, title, url) and Seshette's scribes take it from there
(Embedder -> Reducer -> Clusterer -> Labeler -> Renderer).

This script reads an OKF bundle and writes that table as documents.parquet.
OKF-only fields (type, description, tags) go to a separate sidecar file,
okf_metadata.parquet, because Seshette's schema is fixed and has no column
for them.

Usage (or `datamap okf`, which runs convert_to_okf.py first):
    python -m datamap.okf_to_documents path/to/bundle --out-dir out/
"""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd
import yaml

RESERVED = {"index.md", "log.md"}   # reserved file names in the OKF spec
SHORT_WORDS = 20                    # Seshette's "very short document" threshold


def parse(path: Path):
    """Return (front_matter, body) for one OKF markdown file."""
    raw = path.read_text(encoding="utf-8")
    meta, body = {}, raw
    if raw.startswith("---"):
        parts = raw.split("---", 2)
        if len(parts) == 3:
            try:
                meta = yaml.safe_load(parts[1]) or {}
            except yaml.YAMLError:
                meta = {}
            body = parts[2]
    return meta, body.strip()


def trust_tier(verified):
    """OKF v0.2 section 5.3: unverified, machine-confirmed, or human-reviewed."""
    if not verified:
        return "unverified"
    if isinstance(verified, dict):
        verified = [verified]
    bys = [str(v.get("by", "")) for v in verified if isinstance(v, dict)]
    return "human-reviewed" if any(b.startswith("human:") for b in bys) else "machine-confirmed"


def title_for(meta, body, path):
    if meta.get("title"):
        return str(meta["title"])
    m = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
    return m.group(1).strip() if m else path.stem.replace("-", " ").replace("_", " ")


def write_documents(bundle: Path, out_dir: Path):
    """Write documents.parquet and okf_metadata.parquet for one OKF bundle."""
    root = bundle.resolve()

    docs, extras, skipped, no_type = [], [], [], []
    for path in sorted(root.rglob("*.md")):
        rel = path.relative_to(root).as_posix()
        if any(part.startswith(".") for part in path.relative_to(root).parts):
            skipped.append((rel, "hidden")); continue
        if path.name.lower() in RESERVED:
            skipped.append((rel, "reserved OKF file")); continue
        try:
            meta, body = parse(path)
        except UnicodeDecodeError:
            skipped.append((rel, "not UTF-8 text")); continue
        if not body:
            skipped.append((rel, "empty")); continue
        if not meta.get("type"):
            no_type.append(rel)
        docs.append({"id": rel[:-3], "text": body,
                     "title": title_for(meta, body, path),
                     "url": path.as_uri()})
        tags = meta.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        extras.append({"id": rel[:-3],
                       "folder": path.parent.relative_to(root).as_posix(),
                       "type": str(meta.get("type") or ""),
                       "domain": str(meta.get("domain") or ""),
                       "topic": str(meta.get("topic") or ""),
                       "tags": ",".join(map(str, tags)),
                       "related": ",".join(map(str, meta.get("related_entries") or [])),
                       "status": str(meta.get("status") or "stable"),
                       "stale_after": str(meta.get("stale_after") or ""),
                       "trust_tier": trust_tier(meta.get("verified")),
                       "front_matter": json.dumps(meta, default=str)})

    if not docs:
        raise SystemExit(f"No usable OKF documents in {root}")

    df = pd.DataFrame(docs)
    out_dir.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_dir / "documents.parquet", index=False)
    pd.DataFrame(extras).to_parquet(out_dir / "okf_metadata.parquet", index=False)

    # Seshette asks callers to warn about short docs and exact duplicates.
    short = df[df["text"].str.split().str.len() < SHORT_WORDS]
    dupes = defaultdict(list)
    for _id, text in zip(df["id"], df["text"]):
        dupes[text].append(_id)
    dupes = [ids for ids in dupes.values() if len(ids) > 1]

    print(f"Wrote {len(df)} documents to {out_dir/'documents.parquet'}")
    for rel, why in skipped:
        print(f"  skipped {rel}: {why}")
    if no_type:
        print(f"  OKF v0.2 conformance: {len(no_type)} of {len(df)} concepts are missing "
              f"the required `type` field (e.g. {', '.join(no_type[:3])})")
    if len(short):
        print(f"  warning: {len(short)} documents under {SHORT_WORDS} words "
              f"(may form junk clusters): {', '.join(short['id'][:5])}")
    for ids in dupes:
        print(f"  warning: identical text in {', '.join(ids)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bundle", type=Path)
    ap.add_argument("--out-dir", type=Path, default=Path("."))
    args = ap.parse_args()
    write_documents(args.bundle, args.out_dir)


if __name__ == "__main__":
    main()
