"""Generic-phrase detection against corpus/generic_openers.txt.

Multi-word phrases are strong evidence of template copy; single words
("align", "certainly") also show up in ordinary writing, so they are
weighted lightly. Overlapping matches count once, longest phrase wins.
"""
from __future__ import annotations

import re
from pathlib import Path

PHRASES_PATH = Path(__file__).resolve().parents[2] / "corpus" / "generic_openers.txt"

# Points deducted per match, by phrase length in words.
WEIGHTS = {1: 4, 2: 8}
LONG_PHRASE_WEIGHT = 15     # 3+ words


def load_phrases(path: Path = PHRASES_PATH) -> list[str]:
    """One phrase per line; blank lines and lines starting with '#' skipped."""
    phrases = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            phrases.add(_normalize(line))
    # Longest first, so "just following up on my previous email" claims its
    # span before "just following up" can.
    return sorted(phrases, key=lambda p: (-len(p.split()), p))


def check(text: str, phrases: list[str] | None = None) -> dict:
    """Return slop score (0-100, higher is cleaner) and the matched phrases."""
    if phrases is None:
        phrases = load_phrases()
    norm = _normalize(text)
    first_sentence_end = _first_sentence_end(norm)

    taken: list[tuple[int, int]] = []
    matches = []
    penalty = 0
    for phrase in phrases:
        pattern = r"(?<!\w)" + re.escape(phrase) + r"(?!\w)"
        for m in re.finditer(pattern, norm):
            span = (m.start(), m.end())
            if any(s < span[1] and span[0] < e for s, e in taken):
                continue
            taken.append(span)
            n_words = len(phrase.split())
            weight = WEIGHTS.get(n_words, LONG_PHRASE_WEIGHT)
            penalty += weight
            matches.append({
                "phrase": text[span[0]:span[1]],
                "words": n_words,
                "in_opener": span[0] < first_sentence_end,
                "weight": weight,
            })

    matches.sort(key=lambda m: -m["weight"])
    generic_opener = any(m["in_opener"] and m["words"] >= 3 for m in matches)
    return {
        "score": max(0, 100 - penalty),
        "matches": matches,
        "generic_opener": generic_opener,
    }


def _normalize(s: str) -> str:
    # Lowercase and straighten quotes. Same length as the input, so match
    # offsets map back onto the original text.
    return s.lower().replace("’", "'").replace("‘", "'")


def _first_sentence_end(norm: str) -> int:
    # Skip a short greeting line ("Hi Sam,") so the opener is the first real sentence.
    body = norm
    offset = 0
    first_line, sep, rest = norm.partition("\n")
    if sep and len(first_line.split()) <= 4 and first_line.rstrip().endswith((",", "!")):
        offset = len(first_line) + 1
        body = rest
    m = re.search(r"[.!?](\s|$)", body)
    return offset + (m.end() if m else len(body))
