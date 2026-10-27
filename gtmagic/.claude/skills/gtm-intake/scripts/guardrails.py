"""Messaging and targeting guardrails for health-related briefs (used by validate_intake.py).

Kept separate so the rules are easy to find and extend: what messaging may never say,
which proxies may never name a condition, and which locks a health brief must carry.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

from provenance import norm

if TYPE_CHECKING:  # avoid a runtime import cycle; only the type is needed
    from validate_intake import Report

# Brand and generic names, plus "GLP-1" however it is hyphenated or spaced.
# DRUG_NAMES: exact names only (used to mask a public render). DRUG_TERMS adds generic medication
# words, which ad copy and targeting must also avoid.
DRUG_NAMES = r"ozempic|wegovy|mounjaro|zepbound|semaglutide|tirzepatide|saxenda|liraglutide|glp[\s\-\u2010-\u2015]?1"
DRUG_TERMS = (DRUG_NAMES + r"|\bmedications?\b|\bmeds\b|\bprescri|\binjections?\b|\bjabs?\b"
              r"|weight[- ]loss (shots?|drugs?)")
CONDITION_TERMS = DRUG_TERMS + r"|diabet|obes|bariatric"
# Keys are verb phrases so they read as "this <reason>" in errors, warnings and the owner's brief.
MESSAGING_BANNED = {
    "names a medication, drug class or treatment": DRUG_TERMS,
    "assumes the reader's health condition": r"\bare you on\b|\byour (meds|medication|shots?|injections?)\b",
    "uses a superlative or a guarantee": r"\bbest\b|#1|\bnumber one\b|\bguarantee",
    "makes a medical claim": r"\bcures?\b|\btreats?\b|\btreatment\b|\bprevents?\b|\bdiagnos|\bclinically\b|\bdoctor[- ]approved\b",
}


# Words that carry no meaning of their own, ignored when checking that a line really uses a customer phrase.
STOPWORDS = frozenset("a an and are as at be but by do for from had has have i i'm i've in is it it's its "
                      "just me my of on or our so than that the their them then they this to too us was we "
                      "were what when with you you're your".split())


def banned_reasons(text: str) -> list[str]:
    """Every messaging rule this text breaks, in plain words. Errors for our lines; warnings for the owner's own."""
    return [why for why, pattern in MESSAGING_BANNED.items() if re.search(pattern, text, re.IGNORECASE)]


def content_words(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+(?:'[a-z]+)?", norm(text))
    return {w for w in words if w not in STOPWORDS} or set(words)


def uses_phrase(line: str, phrase: str) -> bool:
    """At least half of the phrase's content words appear in the line: borrowed in substance, not just cited."""
    wanted = content_words(phrase)
    return bool(wanted) and 2 * len(wanted & content_words(line)) >= len(wanted)


def check_messaging(brief: dict, seg_ids: set, lex_voice: dict, r: Report) -> bool:
    """lex_voice maps each lexicon id to "customer" or "owner" (from check_lexicon)."""
    ok = True
    phrases = {lex.get("id"): str(lex.get("phrase") or "") for lex in brief.get("lexicon", [])}
    for i, msg in enumerate(brief.get("roughMessaging", [])):
        where = f"roughMessaging[{i}]"
        r.ref(msg.get("segmentId") in seg_ids, where, msg.get("segmentId"), "segment")
        for lid in msg.get("lexiconIds", []):
            r.ref(lid in lex_voice, where, lid, "lexicon")
        text = f"{msg.get('headline', '')} {msg.get('subheadline', '')}"
        if not any(lex_voice.get(lid) == "customer" and uses_phrase(text, phrases.get(lid, ""))
                   for lid in msg.get("lexiconIds", [])):
            r.errors.append(f"{where}: must use a real customer phrase it cites (a lexicon entry with customer voice, "
                            "at least half of its key words in the headline or subheadline)")
            ok = False
        for why in banned_reasons(text):
            r.errors.append(f"{where}: {why}: \"{text.strip()}\"")
            ok = False
    health_topic = False
    for g in brief.get("interests", []):
        health_topic |= bool(re.search(CONDITION_TERMS, g.get("researchDefinition", ""), re.IGNORECASE))
        for proxy in g.get("targetableProxies", []):
            if re.search(CONDITION_TERMS, proxy, re.IGNORECASE):
                r.errors.append(f"interest {g.get('id')}: targetable proxy names a health condition: \"{proxy}\"")
    if health_topic:  # a health-related brief must carry both guardrail locks
        locked = {c.get("dimension") for c in brief.get("constraints", []) if c.get("bucket") == "locked"}
        for dim in ("healthCondition", "regulatory"):
            if dim not in locked:
                r.errors.append(f"constraints: health-related brief needs a locked '{dim}' constraint")
    return ok
