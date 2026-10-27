"""The owner's existing creatives: links to results, image files, guardrail flags, per-creative results.

Used by validate_intake.py, after structure.py has checked shapes. Creatives are the owner's own work:
guardrail risks become warnings and plain-words flags, never errors and never rewrites. Results come only
from linked prior experiments and are judged with economics.judge_ad, so a creative and its experiment can
never disagree. The owner's copy is never allowed to pass as customer voice.
"""
from __future__ import annotations

import os
import re
from typing import TYPE_CHECKING

from economics import ad_figures, judge_ad
from guardrails import banned_reasons
from provenance import LEXICON_SOURCE_TYPES, norm

if TYPE_CHECKING:  # avoid a runtime import cycle; only the type is needed
    from validate_intake import Report

CHANNELS = {"meta", "google", "reddit", "tiktok", "email", "website", "other"}
FORMATS = {"text", "image"}
STATUSES = {"live", "past", "draft"}
CREATIVE_SOURCES = {"owner-text", "owner-file", "website"}
EXPERIMENT_SOURCES = {"file", "manual"}
CONVERSION_TYPES = {"paying", "trial", "unknown"}
OWNER_ORIGINS = {"owner-text", "owner-file"}  # typed in chat, or copied from the owner's export or screenshot
COPY_FIELDS = ("headline", "body", "cta")
SOURCES_DIR = "sources"
MIXED_REASON = "these results mix paying customers with free trials or unconfirmed sign-ups, so they can't be added up"


def copy_text(cr: dict) -> str:
    """The owner's own words on a creative (never the model-written image description)."""
    return " ".join(str(cr.get(f) or "") for f in COPY_FIELDS).strip()


def contains_words(text: str, words: str) -> bool:
    """Whole-word, normalized containment: "the weight" doesn't match inside "the weightlifting"."""
    needle = norm(words)
    return bool(needle) and re.search(rf"(?<!\w){re.escape(needle)}(?!\w)", norm(text)) is not None


def enum(r: Report, where: str, field: str, value: object, allowed: set, required: bool = True) -> None:
    if (value is not None or required) and value not in allowed:
        r.errors.append(f"{where}: {field} must be one of {sorted(allowed)} (got '{value}')")


def check_experiment_side(experiments: list, cr_by_id: dict, r: Report) -> None:
    for px in experiments:
        pid, where = px.get("id"), f"prior experiment {px.get('id')}"
        enum(r, where, "channel", px.get("channel"), CHANNELS)
        enum(r, where, "source", px.get("source"), EXPERIMENT_SOURCES, required=False)
        enum(r, where, "conversionType", px.get("conversionType"), CONVERSION_TYPES, required=False)
        if px.get("source", "file") == "file" and not px.get("sourceFile"):  # provenance: numbers need a file
            r.errors.append(f"{where}: copied from a file but no sourceFile; name the export, "
                            "or set source to 'manual' if the owner typed these numbers")
        for cid in px.get("creativeIds") or []:
            cr = cr_by_id.get(cid)
            r.ref(cr is not None, where, cid, "creative")
            if cr is not None and pid not in (cr.get("experimentIds") or []):
                r.errors.append(f"{where}: lists creative {cid}, but {cid}.experimentIds doesn't list {pid} "
                                "(link both sides or neither)")
        if not px.get("creativeIds"):
            r.notes.append(f"{where}: results with no creative linked (fine; add the ad's wording if the owner has it)")


def check_image(cr: dict, where: str, base_dir: str, r: Report) -> None:
    path, described = cr.get("imageFile"), cr.get("imageDescription")
    if cr.get("format") == "text" and (path or described):
        r.warnings.append(f"{where}: text creative carries image fields; set format to 'image' or drop them")
    if cr.get("format") != "image":  # a bad format is already an error; don't pile image warnings on it
        return
    if not described:
        r.warnings.append(f"{where}: image creative has no imageDescription; describe what is visible in it")
    if not path:
        r.warnings.append(f"{where}: image creative has no imageFile; keep a copy under {SOURCES_DIR}/")
        return
    # The saved path must be portable (relative, under sources/), and where it really points (symlinks
    # resolved) must stay inside the workspace's sources/ folder.
    parts = os.path.normpath(str(path)).split(os.sep)
    root = os.path.realpath(os.path.join(base_dir, SOURCES_DIR))
    resolved = os.path.realpath(os.path.join(base_dir, str(path)))
    if (not isinstance(path, str) or os.path.isabs(path) or parts[0] != SOURCES_DIR or ".." in parts
            or resolved == root or os.path.commonpath([root, resolved]) != root):
        r.errors.append(f"{where}: imageFile must be a file inside the workspace's {SOURCES_DIR}/ folder (got '{path}')")
    elif not os.path.isfile(resolved):
        r.warnings.append(f"{where}: image file '{path}' not found; copy the owner's upload there")


def flag_guardrails(cr: dict, where: str, r: Report) -> None:
    """Script-computed guardrailFlags: the owner's ad is theirs, so we warn and never rewrite it."""
    flags = banned_reasons(copy_text(cr))
    flags += [f"image: {why}" for why in banned_reasons(str(cr.get("imageDescription") or ""))]
    cr["guardrailFlags"] = flags
    for why in flags:
        r.warnings.append(f"{where} (the owner's own creative): {why}; ad platforms may restrict it. "
                          "Tell the owner; don't rewrite it")


def summed(figures: list, key: str) -> float | None:
    """One figure across linked results; None if any is missing, so a partial sum never flatters a cost."""
    values = [f[key] for f in figures]
    if any(v is None for v in values):
        return None
    total = sum(values)
    return int(total) if float(total).is_integer() else round(total, 2)  # whole counts stay whole in the file


def performance(cr: dict, linked: list, known: dict, target: float | None, source: str) -> dict | None:
    """Per-creative results from its linked experiments (script-computed); None when nothing is linked.

    known: the brief's creatives by id, so a dangling id (already an error) never makes a result look shared.
    """
    if not linked:
        return None
    figures = [ad_figures(px, None) for px in linked]  # already checked and reported by compute_ads
    kinds = {px.get("conversionType") or "unknown" for px in linked}
    kind = next(iter(kinds)) if len(kinds) == 1 else "mixed"
    spend, impressions, clicks = summed(figures, "spend"), summed(figures, "impressions"), summed(figures, "clicks")
    conversions = None if kind == "mixed" else summed(figures, "conversions")  # paying + trial don't add up
    if kind == "mixed":
        verdict, reason = "inconclusive", MIXED_REASON
    else:
        verdict, reason = judge_ad(spend, clicks, conversions, kind, target, source)
    others = [[c for c in px.get("creativeIds") or [] if c != cr.get("id") and c in known] for px in linked]
    shared = sorted({c for group in others for c in group})
    return {"basis": "own" if not shared else "shared" if all(others) else "partly-shared", "sharedWith": shared,
            "channels": sorted({str(px["channel"]) for px in linked if px.get("channel")}),
            "spend": spend, "impressions": impressions, "clicks": clicks, "conversions": conversions,
            "ctr": round(clicks / impressions, 4) if clicks is not None and impressions else None,
            "costPerSignup": round(spend / conversions, 2) if spend is not None and conversions else None,
            "conversionType": kind, "verdict": verdict, "verdictReason": reason}


def check_creative_evidence(brief: dict, creatives: list, cr_by_id: dict, r: Report) -> None:
    """Evidence quoting a creative is the owner's words, copied word for word; owner copy never poses as a customer."""
    for ev in brief.get("evidence", []):
        cid, where = ev.get("creativeId"), f"evidence {ev.get('id')}"
        if cid:
            cr = cr_by_id.get(cid)
            r.ref(cr is not None, where, cid, "creative")
            if ev.get("origin") not in OWNER_ORIGINS or ev.get("sourceType") != "first-party":
                r.errors.append(f"{where}: a creative's wording is the owner's own: origin 'owner-text' or "
                                "'owner-file', sourceType 'first-party'")
            if cr is not None and norm(str(ev.get("excerpt") or "")) not in norm(copy_text(cr)):
                r.errors.append(f"{where}: excerpt is not word for word in {cid}'s headline, body or CTA")
        elif ev.get("sourceType") in LEXICON_SOURCE_TYPES:
            for cr in creatives:
                if contains_words(copy_text(cr), str(ev.get("excerpt") or "")):
                    r.errors.append(f"{where}: this '{ev.get('sourceType')}' excerpt is word for word in creative "
                                    f"{cr.get('id')}'s copy, so it's the owner's words: set creativeId "
                                    f"'{cr.get('id')}' and sourceType 'first-party'")
    for lex in brief.get("lexicon", []):
        if lex.get("voice") != "customer":
            continue
        for cr in creatives:
            if contains_words(copy_text(cr), str(lex.get("phrase") or "")):
                r.errors.append(f"lexicon {lex.get('id')}: phrase is word for word in creative {cr.get('id')}'s copy; "
                                f"cite owner evidence for it (creativeId '{cr.get('id')}', first-party) so it's "
                                "tagged owner voice, not customer voice")


def check_creatives(brief: dict, base_dir: str, target: float | None, source: str, r: Report) -> None:
    """base_dir is the save file's folder; imageFile paths resolve against it."""
    creatives, experiments = brief.get("creatives") or [], brief.get("priorExperiments") or []
    cr_by_id = {c.get("id"): c for c in creatives}
    px_by_id = {p.get("id"): p for p in experiments}
    check_experiment_side(experiments, cr_by_id, r)
    for cr in creatives:
        cid, where = cr.get("id"), f"creative {cr.get('id')}"
        enum(r, where, "format", cr.get("format"), FORMATS)
        enum(r, where, "status", cr.get("status"), STATUSES)
        enum(r, where, "source", cr.get("source"), CREATIVE_SOURCES)
        enum(r, where, "channel", cr.get("channel"), CHANNELS, required=False)
        if not copy_text(cr) and not cr.get("imageDescription"):
            r.errors.append(f"{where}: no headline, body, CTA or image description; there's nothing to record")
        if cr.get("source") == "owner-file" and not cr.get("sourceFile"):
            r.warnings.append(f"{where}: source is owner-file but no sourceFile is named")
        linked, ids = [], cr.get("experimentIds") or []
        if len(set(ids)) < len(ids):  # counted once each: a repeated link would double the spend and sign-ups
            r.warnings.append(f"{where}: lists the same result more than once; counted once")
        for pid in dict.fromkeys(ids):
            px = px_by_id.get(pid)
            r.ref(px is not None, where, pid, "prior experiment")
            if px is None:
                continue
            linked.append(px)
            if cid not in (px.get("creativeIds") or []):
                r.errors.append(f"{where}: lists {pid}, but {pid}.creativeIds doesn't list {cid} (link both sides or neither)")
            headline = (px.get("message") or {}).get("headline")
            if cr.get("headline") and headline and norm(str(cr["headline"])) != norm(str(headline)):
                r.warnings.append(f"{where}: headline differs from {pid}'s; check they're the same ad")
        if linked and cr.get("status") == "draft":
            r.warnings.append(f"{where}: marked draft but has results; is it live or past?")
        check_image(cr, where, base_dir, r)
        flag_guardrails(cr, where, r)
        cr["performance"] = perf = performance(cr, linked, cr_by_id, target, source)
        r.notes.append(f"{where}: " + (f"{perf['verdict']} ({perf['verdictReason']}; {perf['basis']} results)"
                                       if perf else "no results linked"))
    check_creative_evidence(brief, creatives, cr_by_id, r)
