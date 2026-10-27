"""Auto-segmentation: split a customer CSV into segments for one draft.

Privacy by construction: the CSV stays on the server. Claude sees only
column summaries (ranges, common values, counts), never rows, and columns
that look like personal data (names, emails, phones, addresses, IDs, free
text) are dropped before summarizing. Claude proposes segments as filter
rules on the summarized columns; Python applies the rules to the real rows,
so segment sizes are exact and each segment's facts come from its data.

Segments never use protected characteristics (age, gender, race, religion,
health, and the like); the prompt forbids it and such columns are skipped.
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import statistics
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal

try:
    from pydantic import BaseModel
except ImportError:   # the plugin's standard-library scripts use only prepare() and apply()
    BaseModel = object

MAX_ROWS = 20000
PII_HEADER = re.compile(
    r"name|e-?mail|phone|mobile|cell|address|street|city|zip|postal|ssn|social|"
    r"birth|dob|\bage\b|gender|sex|race|ethnic|religio|health|medical|password|card", re.I)
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE = re.compile(r"^\+?[\d\s().-]{7,}$")
DATE_FORMATS = ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y")


@dataclass
class AutoSegment:
    label: str
    size: int
    facts: str
    why: str = ""


@dataclass
class AutoSegmentResult:
    segments: list[AutoSegment] = field(default_factory=list)
    rows: int = 0
    columns_used: list[str] = field(default_factory=list)
    columns_skipped: list[str] = field(default_factory=list)
    notes: str = ""


class Rule(BaseModel):
    column: str
    op: Literal["<", "<=", ">", ">=", "==", "!=", "in"]
    value: str               # for "in": comma-separated values


class ProposedSegment(BaseModel):
    label: str
    rules: list[Rule]
    why: str


class Proposal(BaseModel):
    segments: list[ProposedSegment]


INSTRUCTIONS = """You split a small business's customer list into segments for one email draft.
You get the draft and summaries of the list's columns (never the rows).

Propose 2 to 5 segments whose people would read this draft differently, given
their facts: tenure, plan, what they pay, recency, frequency, payment history,
agreements. Each segment is a list of rules on the summarized columns, all of
which must hold (AND). Rows go to the first segment they match, in your order,
so put the most specific segment first. Rows matching none go to "Everyone else".

Rules:
- Use only the listed columns, and only values consistent with their summaries.
- Date columns are summarized as days ago; write their rules in days.
- Never segment on protected characteristics (age, gender, race, religion,
  health, disability, and similar), even if a column seems to allow it.
- Labels are short and factual ("10+ year tenants", "Negotiated rate"),
  never personas. "why" says in one sentence how this group reads the draft
  differently, based on its facts.
- Prefer fewer, meaningful segments over many thin ones. Skip a split that
  would not change how the draft lands."""


def xlsx_to_csv(data: bytes) -> str:
    """First sheet of an Excel workbook as CSV text."""
    from openpyxl import load_workbook

    sheet = load_workbook(io.BytesIO(data), read_only=True, data_only=True).worksheets[0]
    out = io.StringIO()
    writer = csv.writer(out)
    for row in sheet.iter_rows(values_only=True):
        if any(v is not None and str(v).strip() for v in row):
            writer.writerow([_cell(v) for v in row])
    return out.getvalue()


def _cell(v) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def read_csv(text: str) -> list[dict]:
    rows = list(csv.DictReader(io.StringIO(text.lstrip("﻿"))))
    if len(rows) > MAX_ROWS:
        raise ValueError(f"CSV has {len(rows)} rows; the limit is {MAX_ROWS}")
    return rows


def prepare(rows: list[dict], today: date | None = None) -> tuple[list[dict], dict, list[str]]:
    """Drop personal-data columns, convert dates to days ago, summarize the rest.

    Returns (clean rows with typed values, column summaries, skipped columns).
    """
    today = today or date.today()
    columns = list(rows[0].keys()) if rows else []
    clean = [{} for _ in rows]
    summaries, skipped = {}, []
    for col in columns:
        values = [(r.get(col) or "").strip() for r in rows]
        present = [v for v in values if v]
        if not col or not present or PII_HEADER.search(col) or _looks_personal(present):
            skipped.append(col)
            continue
        if _share(present, _num) >= 0.9:
            typed = [_num(v) for v in values]
            kind = "number"
        elif _share(present, _date) >= 0.9:
            typed = [(today - d).days if (d := _date(v)) else None for v in values]
            kind = "date (days ago)"
        else:
            distinct = set(present)
            all_unique = len(distinct) == len(present) > 2
            if all_unique or len(distinct) > max(20, len(present) // 2):   # free text or an ID
                skipped.append(col)
                continue
            typed = [v or None for v in values]
            kind = "category"
        for row, v in zip(clean, typed):
            row[col] = v
        summaries[col] = _summarize(kind, [v for v in typed if v is not None])
    return clean, summaries, skipped


def propose(draft: str, subject: str, summaries: dict, n_rows: int) -> Proposal:
    import anthropic

    from scorers.naive.judge import DEFAULT_MODEL

    response = anthropic.Anthropic().beta.messages.parse(
        model=os.environ.get("SENDCHECK_JUDGE_MODEL") or DEFAULT_MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium"},
        system=INSTRUCTIONS,
        messages=[{"role": "user", "content": json.dumps({
            "draft": {"subject": subject, "text": draft},
            "rows": n_rows, "columns": summaries}, indent=2)}],
        output_format=Proposal,
    )
    if response.parsed_output is None:
        raise RuntimeError(f"no segments proposed (stop_reason={response.stop_reason})")
    return response.parsed_output


def apply(proposal: Proposal, rows: list[dict], summaries: dict) -> tuple[list[AutoSegment], list[str]]:
    """Assign each row to the first matching segment and describe each from its data."""
    notes = []
    segs = []
    for p in proposal.segments:
        rules = [r for r in p.rules if r.column in summaries]
        if len(rules) < len(p.rules):
            notes.append(f"ignored rules on unknown columns in \"{p.label}\"")
        if rules:
            segs.append((p, rules))
    members = [[] for _ in segs]
    rest = []
    for row in rows:
        for i, (_, rules) in enumerate(segs):
            if all(_matches(row.get(r.column), r) for r in rules):
                members[i].append(row)
                break
        else:
            rest.append(row)

    used = sorted({r.column for _, rules in segs for r in rules})
    out = [AutoSegment(p.label, len(m), _facts(m, used, summaries), p.why)
           for (p, _), m in zip(segs, members) if m]
    if rest:
        out.append(AutoSegment("Everyone else", len(rest), _facts(rest, used, summaries),
                               "rows that matched none of the segments above"))
    return out, notes


def autosegment(csv_text: str, draft: str, subject: str = "") -> AutoSegmentResult:
    rows = read_csv(csv_text)
    if not rows:
        return AutoSegmentResult(notes="the CSV has no rows")
    clean, summaries, skipped = prepare(rows)
    if not summaries:
        return AutoSegmentResult(rows=len(rows), columns_skipped=skipped,
                                 notes="no usable columns: add facts like tenure, plan, or last visit")
    proposal = propose(draft, subject, summaries, len(rows))
    segments, notes = apply(proposal, clean, summaries)
    return AutoSegmentResult(segments=segments, rows=len(rows), columns_used=list(summaries),
                             columns_skipped=skipped, notes="; ".join(notes))


# ---- helpers ----

def _num(v: str):
    try:
        return float(v.replace(",", "").replace("$", ""))
    except ValueError:
        return None


def _date(v: str):
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    return None


def _share(values: list[str], parse) -> float:
    return sum(parse(v) is not None for v in values) / len(values)


def _looks_personal(values: list[str]) -> bool:
    sample = values[:200]
    return (_share(sample, lambda v: v if EMAIL.match(v) else None) > 0.5
            or _share(sample, lambda v: v if PHONE.match(v) and _num(v) is None
                      and _date(v) is None else None) > 0.5)


def _summarize(kind: str, values: list) -> dict:
    if kind == "category":
        counts = {}
        for v in values:
            counts[v] = counts.get(v, 0) + 1
        top = sorted(counts.items(), key=lambda kv: -kv[1])[:10]
        return {"type": kind, "distinct": len(counts), "top_values": dict(top)}
    qs = statistics.quantiles(values, n=4) if len(values) >= 4 else [min(values)] * 3
    return {"type": kind, "min": _fmt(min(values)), "p25": _fmt(qs[0]), "median": _fmt(qs[1]),
            "p75": _fmt(qs[2]), "max": _fmt(max(values))}


def _matches(value, rule: Rule) -> bool:
    if value is None:
        return False
    if rule.op == "in":
        return str(value) in {s.strip() for s in rule.value.split(",")}
    if isinstance(value, (int, float)):
        target = _num(rule.value)
        if target is None:
            return False
    else:
        value, target = str(value), rule.value.strip()
        if rule.op not in ("==", "!="):
            return False
    return {"<": value < target, "<=": value <= target, ">": value > target,
            ">=": value >= target, "==": value == target, "!=": value != target}[rule.op]


def _facts(members: list[dict], columns: list[str], summaries: dict) -> str:
    parts = []
    for col in columns:
        vals = [m.get(col) for m in members if m.get(col) is not None]
        if not vals:
            continue
        if summaries[col]["type"] == "category":
            top = max(set(vals), key=vals.count)
            parts.append(f"{col}: {top} ({round(100 * vals.count(top) / len(vals))}%)")
        elif summaries[col]["type"].startswith("date"):
            parts.append(f"{col}: median {_ago(statistics.median(vals))} "
                         f"(range {_ago(min(vals))} to {_ago(max(vals))})")
        else:
            parts.append(f"{col}: median {_fmt(statistics.median(vals))} "
                         f"(range {_fmt(min(vals))}–{_fmt(max(vals))})")
    return "; ".join(parts)


def _ago(days: float) -> str:
    if days >= 365:
        return f"{days / 365.25:.1f} years ago"
    if days >= 60:
        return f"{round(days / 30.4)} months ago"
    return f"{round(days)} days ago"


def _fmt(x) -> str:
    return str(int(x)) if float(x).is_integer() else f"{x:.1f}"
