"""Run Send Check on corpus/fixtures and grade it against each fixture's expected flags.

Each fixture lists its segments and the flags Send Check should raise, plus
negative cases ("fine as-is") it should pass. For every fixture this script
scores the draft per segment with the naive backend, then asks a Claude grader
whether each expected flag was caught. Results go to corpus/validation/.

Usage:
    uv run python scripts/eval_fixtures.py              # all fixtures
    uv run python scripts/eval_fixtures.py 1 6 9 16     # a subset by number

Costs API calls: one judge call per segment plus one grader call per fixture.
"""
from __future__ import annotations

import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path

from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scorers.base import Draft  # noqa: E402
from scorers.env import load_env  # noqa: E402
from scorers.naive.combine import NaiveBackend  # noqa: E402
from scorers.naive.judge import DEFAULT_MODEL  # noqa: E402
from scorers.segments import Segment, score_segments  # noqa: E402

FIXTURES = ROOT / "corpus" / "fixtures"
OUT = ROOT / "corpus" / "validation"

GRADER_INSTRUCTIONS = """You grade Send Check, a tool that checks one email draft against
each segment of a send list. You get the fixture's expected flags (written by
the team before running the tool) and Send Check's output per segment.

For each expected flag, decide whether Send Check caught it: the same problem,
for the same segment (or all segments), appears in its evidence, notes,
suggestions, or the version it wrote for that segment. Wording can differ;
the substance must match. Be strict: a vague nearby comment is not a catch.

Some expected flags are negative cases ("fine as-is", "mostly clean", "should
pass"). For those, caught means Send Check did NOT raise a real problem for
that segment and scored it send or near send (70+)."""


class FlagGrade(BaseModel):
    flag: str
    negative_case: bool
    caught: bool
    reason: str


class FixtureGrade(BaseModel):
    grades: list[FlagGrade]


def parse_fixture(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    field = lambda name: (re.search(rf"\*\*{name}:\*\*\s*(.+)", text) or [None, ""])[1].strip()
    draft = text.split("## Draft", 1)[1].split("## Expected flags", 1)[0].strip()
    flags = [l[2:].strip() for l in text.split("## Expected flags", 1)[1].splitlines()
             if l.startswith("- ")]
    return {
        "number": int(path.name.split("-", 1)[0]),
        "title": text.splitlines()[0].lstrip("# ").strip(),
        "business": field("Business"),
        "subject": field("Subject"),
        "draft": draft,
        "segments": split_segments(field("List")),
        "expected_flags": flags,
    }


def split_segments(list_line: str) -> list[str]:
    """'All paying customers — mix of A, B (x, y), C' -> ['A', 'B (x, y)', 'C'].

    'Entire base, 1,200 people — only 180 received X' -> affected / not affected.
    """
    m = re.search(r"[—;]\s*only (\d.+)", list_line)   # not "discount-only buyers"
    if m:
        whole = re.split(r"\s*[—;]\s*", list_line)[0]
        return [f"Affected: {m.group(1).rstrip('.')}",
                f"Not affected: the rest of the list ({whole})"]
    for sep in ("—", " - ", ":"):
        if sep in list_line:
            list_line = list_line.split(sep, 1)[1]
            break
    list_line = re.sub(r"^\s*(a )?mix of\s+", "", list_line, flags=re.I)
    parts, depth, cur = [], 0, ""
    for ch in list_line:
        depth += ch == "("
        depth -= ch == ")"
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip().rstrip(".") for p in parts if p.strip()]


def run_fixture(fx: dict) -> dict:
    message_type = "cold" if "cold" in fx["title"].lower() else "customer"
    result = score_segments(
        NaiveBackend(),
        Draft(text=fx["draft"], subject=fx["subject"]),
        [Segment(label=s, facts=f"{s}. Business: {fx['business']}") for s in fx["segments"]],
        message_type=message_type,
        audience="segment",
    )
    for s in result.segments:
        if "personalization and fit are script estimates" in s.scorecard.notes:
            raise RuntimeError(f"judge did not run for fixture {fx['number']}: {s.scorecard.notes}")
    return asdict(result)


def grade(fx: dict, result: dict) -> FixtureGrade:
    import anthropic

    response = anthropic.Anthropic().beta.messages.parse(
        model=DEFAULT_MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium"},
        system=GRADER_INSTRUCTIONS,
        messages=[{"role": "user", "content": json.dumps({
            "fixture": fx["title"], "draft": fx["draft"],
            "expected_flags": fx["expected_flags"], "send_check_output": result,
        }, indent=2)}],
        output_format=FixtureGrade,
    )
    if response.parsed_output is None:
        raise RuntimeError(f"grader returned nothing (stop_reason={response.stop_reason})")
    return response.parsed_output


def main(numbers: list[int]) -> None:
    load_env()
    paths = sorted(p for p in FIXTURES.glob("[0-9][0-9]-*.md")
                   if not numbers or int(p.name[:2]) in numbers)
    fixtures = [parse_fixture(p) for p in paths]

    def evaluate(fx):
        result = run_fixture(fx)
        return fx, result, grade(fx, result)

    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(evaluate, fixtures))

    OUT.mkdir(exist_ok=True)
    pos = [g for _, _, fg in rows for g in fg.grades if not g.negative_case]
    neg = [g for _, _, fg in rows for g in fg.grades if g.negative_case]
    lines = [
        "# Send Check fixture eval",
        "",
        f"Fixtures: {len(rows)}. Judge and grader model: `{DEFAULT_MODEL}` "
        "(judge overridable with SENDCHECK_JUDGE_MODEL).",
        "",
        f"**Expected problems caught: {sum(g.caught for g in pos)} of {len(pos)}.**",
        f"**Clean cases passed without false alarms: {sum(g.caught for g in neg)} of {len(neg)}.**",
        "",
        "| # | Fixture | Verdict | Segments | Caught |",
        "|---|---|---|---|---|",
    ]
    for fx, result, fg in rows:
        segs = ", ".join(f"{s['segment']['label']}: {s['scorecard']['verdict']} {s['scorecard']['score']}"
                         for s in result["segments"])
        lines.append(f"| {fx['number']} | {fx['title']} | {result['verdict']} {result['score']} | "
                     f"{segs} | {sum(g.caught for g in fg.grades)}/{len(fg.grades)} |")
    lines += ["", "## Flag by flag", ""]
    for fx, _, fg in rows:
        lines.append(f"### {fx['title']}")
        for g in fg.grades:
            mark = "caught" if g.caught else "MISSED"
            kind = " (clean case)" if g.negative_case else ""
            lines.append(f"- **{mark}**{kind}: {g.flag}  \n  {g.reason}")
        lines.append("")

    (OUT / "eval-results.md").write_text("\n".join(lines), encoding="utf-8")
    (OUT / "eval-results.json").write_text(json.dumps(
        [{"fixture": fx, "result": result, "grades": fg.model_dump()} for fx, result, fg in rows],
        indent=2), encoding="utf-8")
    print("\n".join(lines[:8]))
    print(f"\nWrote {OUT / 'eval-results.md'}")


if __name__ == "__main__":
    main([int(a) for a in sys.argv[1:]])
