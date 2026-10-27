"""Contract tests every backend must pass. Run: pytest"""
from scorers.base import Draft, Recipient, Scorecard, verdict_from_score


def test_verdict_thresholds():
    assert verdict_from_score(90) == "send"
    assert verdict_from_score(75) == "send"
    assert verdict_from_score(74) == "fix"
    assert verdict_from_score(45) == "fix"
    assert verdict_from_score(44) == "scrap"
    assert verdict_from_score(0) == "scrap"


def test_dataclasses_construct():
    d = Draft(text="hi", channel="email", subject="x")
    r = Recipient(name="A", role="VP", company="Acme", context="likes data")
    assert d.text and r.name
