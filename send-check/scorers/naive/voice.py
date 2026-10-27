"""Voice match: does the draft sound like the owner's own sent emails?

Optional. Runs only when the owner supplies a few emails they actually sent.
Compares measurable habits (sentence length, contractions, exclamation
marks, greeting, sign-off); word choice is left to the judge.
"""
from __future__ import annotations

import re
import statistics

from scorers.naive.mechanical import count_contractions, sentences

POINTS_PER_DIFFERENCE = 15


def profile(text: str) -> dict:
    """Measurable writing habits of one email."""
    norm = text.replace("’", "'")
    n_words = max(1, len(norm.split()))
    lengths = [len(s.split()) for s in sentences(norm)]
    n_contracted, _ = count_contractions(norm)
    lines = [l.strip() for l in norm.strip().splitlines() if l.strip()]
    return {
        "avg_sentence_words": round(statistics.mean(lengths), 1) if lengths else 0.0,
        "contractions_per_100": round(n_contracted * 100 / n_words, 1),
        "exclamations_per_100": round(norm.count("!") * 100 / n_words, 1),
        "greeting": _greeting(lines),
        "signoff": _signoff(lines),
    }


def compare(draft: str, samples: list[str]) -> dict:
    """Score (0-100) how closely the draft's habits match the samples."""
    owner_profiles = [profile(s) for s in samples if s.strip()]
    if not owner_profiles:
        return {"score": None, "differences": [], "owner": None, "draft": profile(draft)}

    owner = {
        k: round(statistics.mean(p[k] for p in owner_profiles), 1)
        for k in ("avg_sentence_words", "contractions_per_100", "exclamations_per_100")
    }
    owner["greeting"] = _most_common(p["greeting"] for p in owner_profiles)
    owner["signoff"] = _most_common(p["signoff"] for p in owner_profiles)
    d = profile(draft)

    diffs = []
    if owner["avg_sentence_words"] and d["avg_sentence_words"]:
        ratio = d["avg_sentence_words"] / owner["avg_sentence_words"]
        if ratio > 1.4 or ratio < 0.6:
            diffs.append(f"sentences average {d['avg_sentence_words']} words; "
                         f"yours average {owner['avg_sentence_words']}")
    if owner["contractions_per_100"] >= 2 and d["contractions_per_100"] < 0.5:
        diffs.append("no contractions; you use them regularly")
    elif owner["contractions_per_100"] < 0.5 and d["contractions_per_100"] >= 2:
        diffs.append("uses contractions; you rarely do")
    if owner["exclamations_per_100"] == 0 and d["exclamations_per_100"] > 0:
        diffs.append("uses exclamation marks; you never do")
    if owner["greeting"] and d["greeting"] and owner["greeting"] != d["greeting"]:
        diffs.append(f"opens with \"{d['greeting']}\"; you open with \"{owner['greeting']}\"")
    if owner["signoff"] and d["signoff"] and owner["signoff"] != d["signoff"]:
        diffs.append(f"signs off \"{d['signoff']}\"; you sign off \"{owner['signoff']}\"")

    return {
        "score": max(0, 100 - POINTS_PER_DIFFERENCE * len(diffs)),
        "differences": diffs,
        "owner": owner,
        "draft": d,
    }


def _greeting(lines: list[str]) -> str:
    # "Hi Sam," -> "hi"; only a short first line counts as a greeting.
    if lines and len(lines[0].split()) <= 4 and lines[0].endswith((",", "!", ":")):
        return lines[0].split()[0].strip(",!:").lower()
    return ""


def _signoff(lines: list[str]) -> str:
    # "Thanks,\nDana" -> "thanks"; looks at the short closing lines only.
    tail = lines[-2:] if len(lines) >= 2 else lines
    for line in tail:
        if len(line.split()) <= 3 and line.endswith(","):
            return line.rstrip(",").lower()
    return ""


def _most_common(values) -> str:
    values = [v for v in values if v]
    return max(set(values), key=values.count) if values else ""
