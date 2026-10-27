"""segments.py: per-segment scoring rolls up into one gate."""
import pytest

from scorers.base import Draft, Scorecard, verdict_from_score
from scorers.naive.combine import NaiveBackend
from scorers.segments import Segment, score_segments, segment_recipient


class FixedBackend:
    """Scores each segment from a table keyed by segment label."""
    name = "fixed"

    def __init__(self, scores):
        self.scores = scores

    def score(self, draft, recipient, **options):
        s = self.scores[recipient.name]
        return Scorecard(verdict=verdict_from_score(s), score=s, dimensions=[])


def test_worst_segment_decides_and_scores_weight_by_size():
    result = score_segments(FixedBackend({"a": 90, "b": 50}), Draft(text="x"),
                            [Segment("a", size=300), Segment("b", size=100)])
    assert result.verdict == "fix"
    assert result.score == round((90 * 300 + 50 * 100) / 400)
    assert result.summary == "1 of 2 segments need changes (100 of 400 recipients)"


def test_all_send():
    result = score_segments(FixedBackend({"a": 80, "b": 95}), Draft(text="x"),
                            [Segment("a"), Segment("b")])
    assert result.verdict == "send"
    assert result.summary == "all 2 segments ready to send"


def test_empty_segments_are_ignored():
    result = score_segments(FixedBackend({}), Draft(text="x"), [Segment("  ")])
    assert result.segments == []
    assert result.summary == "add at least one segment"


def test_segment_recipient_carries_the_facts():
    r = segment_recipient(Segment("10-year tenants", "never missed a payment", 60))
    assert r.name == "10-year tenants"
    assert "never missed a payment" in r.context and "60 recipients" in r.context


def test_segment_audience_skips_literal_detail_cap(monkeypatch):
    monkeypatch.setenv("SENDCHECK_JUDGE", "off")
    result = score_segments(NaiveBackend(), Draft(text="Your rate goes up 12% on Dec 1. Questions?"),
                            [Segment("10-year tenants", "rented 10+ years")],
                            message_type="customer", audience="segment")
    card = result.segments[0].scorecard
    assert "nothing from the recipient's context" not in card.notes
