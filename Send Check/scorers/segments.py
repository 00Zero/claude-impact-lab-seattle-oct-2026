"""One message to many recipients is N messages: score a draft per segment.

A segment is a group on the send list that shares observable facts
("10-year tenants", "lapsed 14 months", "negotiated their rate last year").
Each segment is scored as its own recipient with any ScoringBackend, in
parallel, and the results roll up into one gate:

- verdict: the worst segment verdict. The draft is ready to send only when
  every segment says send.
- score: segment scores averaged, weighted by segment size.

Works with any backend that implements scorers/base.py; no contract change.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from scorers.base import Draft, Recipient, Scorecard, ScoringBackend

SEVERITY = {"send": 0, "fix": 1, "scrap": 2}


@dataclass
class Segment:
    label: str                 # e.g. "10-year tenants"
    facts: str = ""            # observable facts: tenure, last purchase, plan, history
    size: int = 0              # recipients in this segment; 0 if unknown


@dataclass
class SegmentResult:
    segment: Segment
    scorecard: Scorecard


@dataclass
class ListScorecard:
    verdict: str
    score: int
    segments: list[SegmentResult] = field(default_factory=list)
    summary: str = ""          # e.g. "2 of 3 segments need changes (290 of 410 recipients)"


def segment_recipient(segment: Segment) -> Recipient:
    """A segment, expressed as the Recipient the scoring contract expects."""
    size = f"{segment.size} recipients. " if segment.size else ""
    return Recipient(
        name=segment.label,
        role="segment of a send list",
        context=f"Segment: {segment.label}. {size}Observable facts: {segment.facts}".strip(),
    )


def score_segments(backend: ScoringBackend, draft: Draft, segments: list[Segment],
                   max_workers: int = 6, **options) -> ListScorecard:
    """Score the draft against every segment; extra options go to backend.score()."""
    segments = [s for s in segments if s.label.strip()]
    if not segments:
        return ListScorecard(verdict="fix", score=0, summary="add at least one segment")

    def run(segment: Segment) -> SegmentResult:
        return SegmentResult(segment, backend.score(draft, segment_recipient(segment), **options))

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        results = list(pool.map(run, segments))

    verdict = max((r.scorecard.verdict for r in results), key=SEVERITY.__getitem__)
    weights = [r.segment.size or 1 for r in results]
    score = round(sum(w * r.scorecard.score for w, r in zip(weights, results)) / sum(weights))

    failing = [r for r in results if r.scorecard.verdict != "send"]
    if not failing:
        summary = f"all {len(results)} segments ready to send"
    else:
        summary = f"{len(failing)} of {len(results)} segments need changes"
        if all(r.segment.size for r in results):
            summary += (f" ({sum(r.segment.size for r in failing)} of "
                        f"{sum(r.segment.size for r in results)} recipients)")
    return ListScorecard(verdict=verdict, score=score, segments=results, summary=summary)
