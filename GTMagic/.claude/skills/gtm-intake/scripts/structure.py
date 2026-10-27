"""Shape checks that run before every other check (used by validate_intake.py).

The other checks read the brief with .get() and use ids as set and dict keys. A list entry that isn't an
object, an id list that isn't a list of strings, or a list where one value belongs would crash them. This
turns each of those into a plain error; the validator then stops before computing or writing anything.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # avoid a runtime import cycle; only the type is needed
    from validate_intake import Report

OBJECT_LISTS = ("priorExperiments", "creatives", "constraints", "interests", "overlaps", "hypotheses",
                "concerns", "segments", "roughMessaging", "lexicon", "evidence", "findings", "skeptic")
# Inside entries of each list: fields that must be objects, and fields that must be lists of objects.
INNER_OBJECTS = {"priorExperiments": ("metrics", "message"), "constraints": ("rule", "pushback"),
                 "segments": ("serviceability",)}
INNER_OBJECT_LISTS = {"interests": ("demographics",), "segments": ("attributes",), "overlaps": ("strongest",)}
STRING_LISTS = ("queries", "mustHaves", "disqualifiers", "needs", "barriers", "decisionCriteria", "channels",
                "targetableProxies", "guardrailFlags")
# Values used as set members, dict keys or enum lookups: a list or object here can't be compared.
SINGLE_VALUES = ("id", "segmentId", "evidenceId", "creativeId", "url", "channel", "format", "status", "source",
                 "sourceFile", "imageFile", "conversionType", "sourceType", "origin", "kind", "bucket",
                 "dimension", "verdict", "result", "appliesTo", "voice", "phrase", "excerpt", "headline")


def kind_of(value: object) -> str:
    names = {dict: "an object", list: "a list", str: "text", bool: "true/false", int: "a number", float: "a number"}
    return names.get(type(value), type(value).__name__)


def as_object(value: object, where: str, r: Report) -> dict:
    """The object at `where`, or {} after an error. Absent (None) is fine: required-field checks live elsewhere."""
    if value is None:
        return {}
    if not isinstance(value, dict):
        r.errors.append(f"{where}: must be an object, not {kind_of(value)}")
        return {}
    return value


def as_objects(value: object, where: str, r: Report) -> list[tuple[str, dict]]:
    """(where, entry) for each object in the list at `where`; every non-object entry is an error."""
    if value is None:
        return []
    if not isinstance(value, list):
        r.errors.append(f"{where}: must be a list, not {kind_of(value)}")
        return []
    good = []
    for i, item in enumerate(value):
        if isinstance(item, dict):
            good.append((f"{where}[{i}]", item))
        else:
            r.errors.append(f"{where}[{i}]: must be an object, not {kind_of(item)}")
    return good


def check_fields(entry: dict, where: str, r: Report) -> None:
    """Id lists hold strings; single values aren't lists or objects."""
    for key, value in entry.items():
        if (key.endswith("Ids") or key in STRING_LISTS) and value is not None and (
                not isinstance(value, list) or not all(isinstance(v, str) for v in value)):
            r.errors.append(f"{where}.{key}: must be a list of text values")
        elif key in SINGLE_VALUES and isinstance(value, (list, dict)):
            r.errors.append(f"{where}.{key}: must be a single value, not {kind_of(value)}")


def check_structure(brief: dict, r: Report) -> None:
    business = as_object(brief.get("business"), "business", r)
    as_object(business.get("pricing"), "business.pricing", r)
    as_object(brief.get("baseline"), "baseline", r)
    readiness = as_object(brief.get("readiness"), "readiness", r)
    for where, check in as_objects(readiness.get("checks"), "readiness.checks", r):
        check_fields(check, where, r)
    check_fields(as_object(brief.get("icp"), "icp", r), "icp", r)
    for key in OBJECT_LISTS:
        for where, entry in as_objects(brief.get(key), key, r):
            check_fields(entry, where, r)
            for field in INNER_OBJECTS.get(key, ()):
                check_fields(as_object(entry.get(field), f"{where}.{field}", r), f"{where}.{field}", r)
            for field in INNER_OBJECT_LISTS.get(key, ()):
                for inner_where, inner in as_objects(entry.get(field), f"{where}.{field}", r):
                    check_fields(inner, inner_where, r)
                    for deeper in ("values", "distribution"):  # attribute values, demographic distributions
                        for w, item in as_objects(inner.get(deeper), f"{inner_where}.{deeper}", r):
                            check_fields(item, w, r)
            if key == "segments":
                service = as_object(entry.get("serviceability"), f"{where}.serviceability", r)
                for field in ("size", "sizeMath"):
                    check_fields(as_object(service.get(field), f"{where}.serviceability.{field}", r),
                                 f"{where}.serviceability.{field}", r)
                for w, inc in as_objects(service.get("incumbents"), f"{where}.serviceability.incumbents", r):
                    check_fields(inc, w, r)
