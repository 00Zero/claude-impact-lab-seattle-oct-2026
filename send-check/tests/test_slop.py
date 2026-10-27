"""slop.py: phrase matching, weighting, opener detection."""
from scorers.naive import slop


def test_clean_draft_scores_100():
    r = slop.check("Saw your permit for the second Ballard location. Want our crew quote?")
    assert r["score"] == 100
    assert r["matches"] == []


def test_generic_opener_flagged():
    r = slop.check("Hi Sam,\nI hope this email finds you well. We do roofing.")
    assert r["generic_opener"]
    assert r["matches"][0]["phrase"] == "I hope this email finds you well"


def test_overlapping_phrases_count_once():
    r = slop.check("Just following up on my previous email.")
    assert len(r["matches"]) == 1
    assert r["matches"][0]["words"] >= 3


def test_single_words_weighted_lightly():
    r = slop.check("Certainly, the landscape is shifting.")
    assert r["score"] == 100 - 2 * slop.WEIGHTS[1]
    assert not r["generic_opener"]


def test_curly_apostrophes_match():
    r = slop.check("I know you’re busy, so I’ll keep this short.")
    assert r["matches"]
