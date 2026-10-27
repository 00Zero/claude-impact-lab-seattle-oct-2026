"""Embed -> reduce -> cluster, then write a briefing so Claude can name the clusters.

Outputs in the run folder:
  points.parquet   one row per document: id, title, text, x, y, cluster, metadata
  briefing.md      per cluster: size, average rating, keywords, typical examples
  labels.json      placeholder names (keywords) for every cluster, for Claude to replace
"""

from __future__ import annotations

import json
import os
from pathlib import Path

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

import numpy as np
import pandas as pd

from .ingest import load, rating_column

EMBEDDER = "sentence-transformers/all-MiniLM-L6-v2"
NOISE = -1
EXAMPLES_PER_CLUSTER = 8
UNUSUAL_TO_REVIEW = 15
DUPLICATE_SIMILARITY = 0.95


def prepare(
    input_path: Path,
    out: Path,
    text_col: str | None = None,
    title_col: str | None = None,
    min_cluster_size: int | None = None,
    on_stage=None,
) -> None:
    """on_stage, if given, is called with "embed" and then "cluster" as work begins."""
    on_stage = on_stage or (lambda stage: None)
    out.mkdir(parents=True, exist_ok=True)

    print(f"Reading {input_path} ...")
    df = load(input_path, text_col, title_col)
    print(f"  {len(df)} documents")
    if len(df) < 10:
        raise SystemExit("A map needs at least 10 documents.")

    on_stage("embed")
    print(f"Embedding on this computer with {EMBEDDER.split('/')[-1]} ...")
    vectors = embed(df)
    np.save(out / "embeddings.npy", vectors)

    on_stage("cluster")
    print("Laying out the map (UMAP) ...")
    df["x"], df["y"] = reduce(vectors).T

    print("Finding groups (HDBSCAN) ...")
    size = min_cluster_size or default_min_cluster_size(len(df))
    df["cluster"] = cluster(df[["x", "y"]].to_numpy(), size)
    while df["cluster"].max() + 1 < 2 and size > 3:
        size = max(3, size // 2)
        print(f"  Fewer than 2 groups; trying smaller groups (at least {size} documents)")
        df["cluster"] = cluster(df[["x", "y"]].to_numpy(), size)
    n_clusters = df["cluster"].max() + 1
    if n_clusters < 2:
        raise SystemExit(
            "Couldn't find at least 2 groups. Most of the documents may be about one thing, "
            "or there are too few of them (a map works best from about 100)."
        )
    n_noise = int((df["cluster"] == NOISE).sum())
    print(f"  {n_clusters} groups, {n_noise} documents that fit no group")

    df["duplicate_of"] = find_duplicates(df, vectors)
    df["oddness"] = oddness(vectors)
    df.to_parquet(out / "points.parquet", index=False)

    keywords = cluster_keywords(df)
    write_briefing(df, vectors, keywords, out / "briefing.md")
    labels = {
        "title": f"What's in {input_path.stem}",
        "flags": {},
        "clusters": {
            str(c): {"label": ", ".join(keywords[c][:3]), "summary": "", "action": ""}
            for c in range(n_clusters)
        },
    }
    (out / "labels.json").write_text(json.dumps(labels, indent=2), encoding="utf-8")
    print(f"Wrote {out / 'briefing.md'} and placeholder {out / 'labels.json'}")


def embed(df: pd.DataFrame) -> np.ndarray:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(EMBEDDER)
    texts = df["text"].tolist()
    return model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=True)


def reduce(vectors: np.ndarray) -> np.ndarray:
    import umap

    n_neighbors = min(15, len(vectors) - 1)
    return umap.UMAP(
        n_neighbors=n_neighbors, min_dist=0.05, metric="cosine", random_state=42
    ).fit_transform(vectors)


def default_min_cluster_size(n: int) -> int:
    return max(5, round(n / 60))


def cluster(coords: np.ndarray, min_cluster_size: int) -> np.ndarray:
    import fast_hdbscan

    coords = np.ascontiguousarray(coords, dtype=np.float32)
    # min_samples=3: finer, smaller groups and much less "fits no group" than the default.
    labels = fast_hdbscan.HDBSCAN(min_cluster_size=min_cluster_size, min_samples=3).fit_predict(coords)
    return renumber_by_size(labels)


def renumber_by_size(labels: np.ndarray) -> np.ndarray:
    """Cluster 0 is the biggest; noise stays -1."""
    ids, counts = np.unique(labels[labels != NOISE], return_counts=True)
    order = ids[np.argsort(-counts, kind="stable")]
    mapping = {old: new for new, old in enumerate(order)}
    return np.array([mapping.get(l, NOISE) for l in labels])


def find_duplicates(df: pd.DataFrame, vectors: np.ndarray) -> list[str | None]:
    """For each document, the id of an earlier near-identical document, if any."""
    sims = vectors @ vectors.T if len(vectors) <= 5000 else None
    if sims is None:
        return [None] * len(df)
    np.fill_diagonal(sims, 0)
    ids = df["id"].tolist()
    out: list[str | None] = []
    for i in range(len(df)):
        earlier = np.where(sims[i, :i] >= DUPLICATE_SIMILARITY)[0]
        out.append(ids[earlier[0]] if len(earlier) else None)
    return out


def oddness(vectors: np.ndarray, k: int = 5) -> np.ndarray:
    """How unlike its k nearest neighbours each document is (spam and misfiled text score high).

    Independent of the groups: UMAP + HDBSCAN often pull an outlier into the nearest group.
    """
    sims = vectors @ vectors.T
    np.fill_diagonal(sims, -1)
    k = min(k, len(vectors) - 1)
    return 1 - np.sort(sims, axis=1)[:, -k:].mean(axis=1)


def cluster_keywords(df: pd.DataFrame, top: int = 8) -> dict[int, list[str]]:
    """Words that set each cluster apart from the others (class-based TF-IDF)."""
    from sklearn.feature_extraction.text import TfidfVectorizer

    clusters = sorted(c for c in df["cluster"].unique() if c != NOISE)
    if not clusters:
        return {}
    docs = [" ".join(df.loc[df["cluster"] == c, "text"]) for c in clusters]
    vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    matrix = vec.fit_transform(docs).toarray()
    terms = np.array(vec.get_feature_names_out())
    return {c: terms[np.argsort(-row)[:top]].tolist() for c, row in zip(clusters, matrix)}


def typical_examples(df: pd.DataFrame, vectors: np.ndarray, c: int, k: int) -> pd.DataFrame:
    """The k documents closest to the middle of cluster c, most typical first."""
    members = np.where(df["cluster"].to_numpy() == c)[0]
    centroid = vectors[members].mean(axis=0)
    order = members[np.argsort(-(vectors[members] @ centroid))]
    return df.iloc[order[:k]]


def write_briefing(df, vectors, keywords, path: Path) -> None:
    rating = rating_column(df)
    n = len(df)
    lines = [
        "# Briefing: name these groups",
        "",
        f"{n} documents were grouped by meaning into {len(keywords)} groups.",
        "For each group below, write in `labels.json`:",
        "",
        "- `label`: 2 to 5 plain words an owner would use (\"Slow morning lines\", not \"Queue latency\").",
        "- `summary`: one sentence on what these documents say.",
        "- `action`: one concrete thing the business could do about it, or \"\" if nothing.",
        "",
        "Then check the \"Most unusual documents\" section at the end.",
        "",
    ]
    for c in sorted(keywords):
        members = df[df["cluster"] == c]
        lines.append(f"## Group {c}: {len(members)} documents ({len(members) / n:.0%})")
        if rating:
            lines.append(f"Average {rating}: {members[rating].mean():.1f}")
        lines.append(f"Keywords: {', '.join(keywords[c])}")
        lines.append("")
        for _, row in typical_examples(df, vectors, c, EXAMPLES_PER_CLUSTER).iterrows():
            stars = f"[{row[rating]:g}] " if rating and pd.notna(row[rating]) else ""
            lines.append(f"- {stars}{_shorten(row['text'], 400)}")
        lines.append("")

    lines += [
        "## Most unusual documents",
        "",
        "These are the least like anything else. In `labels.json`, add a `flags` object naming",
        "any that are NOT genuinely about this business (spam, scams, meant for a different",
        "business), with a 2 to 4 word reason, e.g. `\"flags\": {\"r094\": \"crypto spam\"}`.",
        "Leave genuine one-off comments unflagged.",
        "",
    ]
    for _, row in df.nlargest(UNUSUAL_TO_REVIEW, "oddness").iterrows():
        lines.append(f"- `{row['id']}`: {_shorten(row['text'], 240)}")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def _shorten(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + " …"
