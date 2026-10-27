"""Evidence provenance and lexicon checks (used by validate_intake.py).

Evidence is the foundation every number rests on, so these checks are strict: a record must
use the schema's values, quote real text it can point to, and never carry personal details.
"""
from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # avoid a runtime import cycle; only the type is needed
    from validate_intake import Report

MAX_EXCERPT_WORDS = 25
ORIGINS = {"web", "owner-file", "owner-text"}
SOURCE_TYPES = {"first-party", "official-stats", "survey", "news-report", "review-aggregate",
                "review", "forum-post", "competitor-site"}
LEXICON_SOURCE_TYPES = {"review", "forum-post"}
PERSONAL_DETAILS = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+|(?<!\w)@\w{2,}|\bu/\w+|\+?\d[\d\s().-]{8,}\d")


def norm(text: str) -> str:
    """Lowercase, straighten quotes, collapse whitespace: so real quotes aren't rejected on typography."""
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", text).strip().lower()


def load_log(path: str | None, r: Report) -> tuple[dict[str, list[str]], set[str]]:
    """Map each logged source URL to the excerpts read there (kept separate), and collect logged search queries."""
    sources: dict[str, list[str]] = {}
    queries: set[str] = set()
    if not path:
        return sources, queries
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                r.errors.append(f"research log line {n}: not valid JSON (fix or remove that line)")
                continue
            if not isinstance(entry, dict):
                continue
            if entry.get("kind") == "source" and entry.get("url"):
                # One list item per log line: joining them would let a quote stitched across two excerpts pass.
                sources.setdefault(str(entry["url"]), []).append(norm(str(entry.get("excerpt", ""))))
            elif entry.get("kind") == "search" and entry.get("query"):
                queries.add(norm(str(entry["query"])))
    return sources, queries


def check_evidence(brief: dict, seg_ids: set, con_ids: set, log: dict[str, list[str]], has_log: bool,
                   r: Report) -> dict:
    by_id: dict = {}
    seen: set = set()
    if any(e.get("url") for e in brief.get("evidence", [])) and not has_log:
        # Without the log we can't prove web evidence came from a tool result. Only the cached demo may skip it.
        (r.warnings if brief.get("mode") == "demo" else r.errors).append(
            "web evidence present but no --log research-log.jsonl given; provenance not checked")
    for ev in brief.get("evidence", []):
        where, excerpt, url = f"evidence {ev.get('id')}", str(ev.get("excerpt") or ""), ev.get("url")
        by_id[ev.get("id")] = ev
        if ev.get("origin") not in ORIGINS:
            r.errors.append(f"{where}: origin must be one of {sorted(ORIGINS)}")
        if ev.get("sourceType") not in SOURCE_TYPES:
            r.errors.append(f"{where}: sourceType '{ev.get('sourceType')}' is not a schema value")
        if not excerpt.strip():
            r.errors.append(f"{where}: excerpt is empty")
        if len(excerpt.split()) > MAX_EXCERPT_WORDS:
            r.errors.append(f"{where}: excerpt over {MAX_EXCERPT_WORDS} words")
        if PERSONAL_DETAILS.search(excerpt):
            r.errors.append(f"{where}: excerpt contains a personal detail (email, @handle, u/name or phone); replace it with [removed]")
        if (url, norm(excerpt)) in seen:
            r.warnings.append(f"{where}: duplicate of an earlier record (same url and excerpt); it inflates counts")
        seen.add((url, norm(excerpt)))
        if ev.get("origin") == "web" and not url:
            r.errors.append(f"{where}: web evidence needs a url")
        if url and has_log:  # any record with a url is web evidence, whatever its origin says
            if url not in log:
                r.errors.append(f"{where}: url not in research log (evidence must come from a tool result)")
            elif not any(norm(excerpt) in logged for logged in log[url]):
                r.errors.append(f"{where}: excerpt is not verbatim in any single logged excerpt for its url")
        for s in ev.get("segmentIds", []):
            r.ref(s in seg_ids, where, s, "segment")
        for c in ev.get("concernIds", []):
            r.ref(c in con_ids, where, c, "concern")
    return by_id


def check_lexicon(brief: dict, evidence: dict, seg_ids: set, r: Report) -> dict[str, str]:
    """Check each phrase and set its script-computed `voice`; returns lexicon id -> voice.

    "customer" only for reviews and forum posts. The owner's own words (chat answers, their ad copy) are
    "owner", so later steps never mistake the owner's phrasing for how customers talk. A dangling evidence id
    (already an error) also gets "owner": a model-typed value is never kept.
    """
    voices: dict[str, str] = {}
    for lex in brief.get("lexicon", []):
        where, ev = f"lexicon {lex.get('id')}", evidence.get(lex.get("evidenceId"))
        r.ref(ev is not None, where, lex.get("evidenceId"), "evidence")
        for s in lex.get("segmentIds", []):
            r.ref(s in seg_ids, where, s, "segment")
        if len(str(lex.get("phrase", "")).split()) < 3:
            r.errors.append(f"{where}: phrase must be at least 3 words")
        if ev and norm(str(lex.get("phrase", ""))) not in norm(str(ev.get("excerpt", ""))):
            r.errors.append(f"{where}: phrase is not verbatim in {ev.get('id')}'s excerpt")
        owner_words = ev and (ev.get("origin") == "owner-text"
                              or (ev.get("creativeId") and ev.get("sourceType") == "first-party"))  # ad copy from a file
        if ev and ev.get("sourceType") not in LEXICON_SOURCE_TYPES and not owner_words:
            r.errors.append(f"{where}: lexicon must come from a review, forum post, or the owner's own words")
        lex["voice"] = "customer" if ev and ev.get("sourceType") in LEXICON_SOURCE_TYPES else "owner"
        voices[lex.get("id")] = lex["voice"]
    return voices
