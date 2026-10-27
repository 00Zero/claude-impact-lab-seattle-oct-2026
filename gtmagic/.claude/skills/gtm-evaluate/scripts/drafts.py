"""Model replies → private drafts → results keyed by asset ID.

The model only ever sees blind labels. Code checks every draft (all labels rated 1–5, a pick that was
shown, a ranking that uses each label once) and maps labels back to asset IDs with the call's own label
map. Anything that doesn't check out is a skipped draw ("invalid-output"), never a guess.
"""
from __future__ import annotations

import json
import re

MAX_REASON_CHARS = 300


class InvalidDraft(ValueError):
    pass


def _load(text: str) -> dict:
    try:
        obj = json.loads(text)
    except ValueError:
        raise InvalidDraft("reply is not JSON") from None
    if not isinstance(obj, dict):
        raise InvalidDraft("reply is not a JSON object")
    return obj


def _label(value: object, labels: list[str], allow_none: bool) -> str:
    """Labels compare case-insensitively (structured outputs may change an enum's capitalization)."""
    text = str(value).strip() if isinstance(value, str) else ""
    if allow_none and text.lower() == "none":
        return "none"
    match = next((lab for lab in labels if lab.lower() == text.lower()), None)
    if match is None:
        raise InvalidDraft(f"'{value}' is not one of the labels shown")
    return match


def _reason(value: object) -> str:
    text = re.sub(r"\s+", " ", value).strip() if isinstance(value, str) else ""
    return text[:MAX_REASON_CHARS]


def parse_rating(text: str, labels: list[str]) -> dict:
    """{ratings: {label: 1..5}, pick: label | "none", reason} with every shown label rated exactly once."""
    obj = _load(text)
    raw = obj.get("ratings")
    if not isinstance(raw, dict):
        raise InvalidDraft("ratings missing")
    ratings: dict[str, int] = {}
    for key, value in raw.items():
        label = _label(key, labels, allow_none=False)
        if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 5:
            raise InvalidDraft(f"rating for {label} is not a whole number from 1 to 5")
        if label in ratings:
            raise InvalidDraft(f"{label} rated twice")
        ratings[label] = value
    if set(ratings) != set(labels):
        raise InvalidDraft(f"not every ad was rated (got {sorted(ratings)})")
    return {"ratings": ratings, "pick": _label(obj.get("pick"), labels, allow_none=True),
            "reason": _reason(obj.get("reason"))}


def parse_ranking(text: str, labels: list[str]) -> dict:
    """{ranking: [labels, best first], reason}; the ranking must use every shown label exactly once."""
    obj = _load(text)
    raw = obj.get("ranking")
    if not isinstance(raw, list):
        raise InvalidDraft("ranking missing")
    ranking = [_label(v, labels, allow_none=False) for v in raw]
    if sorted(ranking) != sorted(labels):
        raise InvalidDraft(f"ranking must list every ad exactly once (got {ranking})")
    return {"ranking": ranking, "reason": _reason(obj.get("reason"))}


def map_rating(draft: dict, label_map: dict[str, str]) -> dict:
    return {"ratings": {label_map[lab]: r for lab, r in draft["ratings"].items()},
            "pick": "none" if draft["pick"] == "none" else label_map[draft["pick"]],
            "reason": draft["reason"]}


def map_ranking(draft: dict, label_map: dict[str, str]) -> dict:
    return {"ranking": [label_map[lab] for lab in draft["ranking"]], "reason": draft["reason"]}
