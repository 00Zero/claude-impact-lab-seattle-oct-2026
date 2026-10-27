"""Turn whatever the owner has (a CSV export, a folder of files, or a Seshette `documents`
table) into one table of documents.

Every document gets an `id`, a `title`, its `text`, and the file it came from.
Any other CSV columns (rating, date, source, url, ...) are kept as extra metadata.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

TEXT_SUFFIXES = {".md", ".markdown", ".txt"}
PDF_SUFFIXES = {".pdf"}
RATING_NAMES = ("rating", "stars", "star_rating", "score")
# Reserved by the Open Knowledge Format (OKF): folder listings and changelogs, not concepts.
OKF_RESERVED = {"index.md", "log.md"}


def load(path: Path, text_col: str | None = None, title_col: str | None = None) -> pd.DataFrame:
    if path.is_dir():
        df = _load_folder(path)
    elif path.suffix.lower() in {".csv", ".tsv"}:
        df = _load_csv(path, text_col, title_col)
    elif path.suffix.lower() in {".xlsx", ".xls"}:
        df = _load_table(pd.read_excel(path), path, text_col, title_col)
    elif path.suffix.lower() == ".parquet":
        df = _load_documents_table(path)
    else:
        raise SystemExit(
            f"Don't know how to read {path}. Give a CSV, an Excel file, a folder, "
            "or the documents.parquet written by `datamap okf`."
        )

    df["text"] = df["text"].fillna("").astype(str).map(_clean)
    df = df[df["text"].str.len() > 0].reset_index(drop=True)
    if df.empty:
        raise SystemExit(f"Found no text in {path}.")
    df["title"] = [
        t if isinstance(t, str) and t.strip() else _first_words(x)
        for t, x in zip(df["title"], df["text"])
    ]
    return df


def rating_column(df: pd.DataFrame) -> str | None:
    """The name of a numeric star-rating column, if the data has one."""
    for col in df.columns:
        if col.lower() in RATING_NAMES and pd.api.types.is_numeric_dtype(df[col]):
            return col
    return None


def _load_csv(path: Path, text_col, title_col) -> pd.DataFrame:
    sep = "\t" if path.suffix.lower() == ".tsv" else ","
    return _load_table(pd.read_csv(path, sep=sep), path, text_col, title_col)


def _load_table(raw: pd.DataFrame, path: Path, text_col, title_col) -> pd.DataFrame:
    raw.columns = [str(c).strip() for c in raw.columns]
    text_col = text_col or _guess_text_column(raw)
    if text_col not in raw.columns:
        raise SystemExit(f"No column named {text_col!r}. Columns are: {', '.join(raw.columns)}")

    id_col = next(
        (c for c in raw.columns if c.lower() in ("id", "review_id", "response_id") and raw[c].is_unique),
        None,
    )
    df = pd.DataFrame(
        {
            "id": raw[id_col].astype(str) if id_col else [f"row{i + 1}" for i in range(len(raw))],
            "title": raw[title_col] if title_col else None,
            "text": raw[text_col],
            "source_file": path.name,
        }
    )
    used = {text_col, title_col, id_col}
    for col in raw.columns:
        if col not in used and col not in df.columns:
            df[col] = raw[col]
    return df


OKF_METADATA_COLUMNS = ("type", "domain", "topic", "trust_tier", "status", "stale_after")


def _load_documents_table(path: Path) -> pd.DataFrame:
    """Seshette's `documents` table (id, text, title, url), as okf_to_documents.py writes it.

    If its sidecar okf_metadata.parquet sits next to it, the OKF fields come along too.
    """
    df = pd.read_parquet(path)
    missing = {"id", "text"} - set(df.columns)
    if missing:
        raise SystemExit(f"{path} has no {', '.join(sorted(missing))} column.")
    df["id"] = df["id"].astype(str)
    if "title" not in df.columns:
        df["title"] = None
    df["source_file"] = df["id"]

    sidecar = path.with_name("okf_metadata.parquet")
    if sidecar.exists():
        sidecar_df = pd.read_parquet(sidecar)
        keep = [c for c in OKF_METADATA_COLUMNS if c in sidecar_df.columns]
        meta = sidecar_df[["id", *keep]].copy()
        if "front_matter" in sidecar_df.columns:
            meta["date"] = [_front_matter_date(s) for s in sidecar_df["front_matter"]]
            meta["web_url"] = [_front_matter_web_url(s) for s in sidecar_df["front_matter"]]
        meta = meta.replace("", None)
        df = df.merge(meta, on="id", how="left")
        if "web_url" in df.columns:
            # Notes Claude saved from web pages (front matter `resource`) link back to the page.
            if "url" in df.columns:
                df["url"] = df["web_url"].fillna(df["url"])
            df = df.drop(columns="web_url")
    return df.dropna(axis=1, how="all")


def _front_matter_date(raw: str | None) -> str | None:
    try:
        fm = json.loads(raw) if raw else {}
    except (TypeError, ValueError):
        return None
    value = fm.get("date") or fm.get("created")
    return str(value) if value else None


def _front_matter_web_url(raw: str | None) -> str | None:
    try:
        fm = json.loads(raw) if raw else {}
    except (TypeError, ValueError):
        return None
    value = str(fm.get("resource") or "")
    return value if value.startswith(("http://", "https://")) else None


def _guess_text_column(raw: pd.DataFrame) -> str:
    """The free-text column is the one with the longest strings on average."""
    best, best_len = None, 0.0
    for col in raw.columns:
        if raw[col].dtype == object:
            mean_len = raw[col].dropna().astype(str).str.len().mean()
            if mean_len > best_len:
                best, best_len = col, mean_len
    if best is None:
        raise SystemExit("Couldn't find a text column. Pass --text-col.")
    return best


def _load_folder(folder: Path) -> pd.DataFrame:
    rows = []
    for f in sorted(folder.rglob("*")):
        suffix = f.suffix.lower()
        if not f.is_file() or any(p.startswith(".") for p in f.relative_to(folder).parts):
            continue
        if f.name.lower() in OKF_RESERVED:
            continue
        meta: dict[str, str] = {}
        if suffix in TEXT_SUFFIXES:
            meta, text = _read_markdown(f)
        elif suffix in PDF_SUFFIXES:
            text = _read_pdf(f)
        else:
            continue
        rows.append(
            {
                "id": str(f.relative_to(folder).with_suffix("")).replace("\\", "/"),
                "title": meta.get("title") or f.stem.replace("_", " ").replace("-", " "),
                "text": text,
                "source_file": str(f.relative_to(folder)).replace("\\", "/"),
                "url": f.resolve().as_uri(),
                "type": meta.get("type"),
                "description": meta.get("description"),
                "domain": meta.get("domain"),
                "date": meta.get("date") or meta.get("created"),
            }
        )
    if not rows:
        raise SystemExit(f"No .md, .txt or .pdf files in {folder}.")
    return pd.DataFrame(rows).dropna(axis=1, how="all")


def _read_markdown(f: Path) -> tuple[dict[str, str], str]:
    """Front matter (title, type, description; OKF requires `type`) and the body."""
    text = f.read_text(encoding="utf-8", errors="replace")
    meta: dict[str, str] = {}
    front = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    if front:
        text = text[front.end():]
        for key in ("title", "type", "description", "domain", "date", "created"):
            m = re.search(rf"^{key}:\s*(.+)$", front.group(1), re.M)
            if m:
                meta[key] = m.group(1).strip().strip("\"'")
    if "title" not in meta:
        m = re.search(r"^#\s+(.+)$", text, re.M)
        if m:
            meta["title"] = m.group(1).strip()
    return meta, text


def _read_pdf(f: Path) -> str:
    from pypdf import PdfReader

    return "\n".join(page.extract_text() or "" for page in PdfReader(f).pages)


def _clean(text: str) -> str:
    return " ".join(text.split())


def _first_words(text: str, n: int = 10) -> str:
    words = text.split()
    return " ".join(words[:n]) + ("…" if len(words) > n else "")
