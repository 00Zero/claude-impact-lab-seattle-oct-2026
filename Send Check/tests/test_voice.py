"""voice.py: comparing a draft with the owner's sent emails."""
from scorers.naive import voice

OWNER = [
    "Hey Sam,\nSaw your note about the roof. We can't get there till Tuesday, "
    "but I'll bring the samples. Works?\n\nCheers,\nDana",
    "Hey Lee,\nQuick one. We're booked this week but I've got Friday open. "
    "Want it?\n\nCheers,\nDana",
]


def test_matching_draft_scores_high():
    draft = ("Hey Pat,\nSaw the permit for your new unit. We've got a crew free "
             "next week and I'd love to quote it. Interested?\n\nCheers,\nDana")
    r = voice.compare(draft, OWNER)
    assert r["score"] == 100, r["differences"]


def test_mismatched_draft_lists_differences():
    draft = ("Dear Pat,\nI am reaching out regarding your exciting new location! "
             "We would be delighted to provide a comprehensive quotation for your "
             "consideration at your earliest convenience!\n\nBest regards,\nDana")
    r = voice.compare(draft, OWNER)
    joined = " ".join(r["differences"])
    assert "dear" in joined and "best regards" in joined
    assert "contractions" in joined and "exclamation" in joined
    assert r["score"] <= 40


def test_no_samples_means_not_measured():
    assert voice.compare("Hi,\nWant a quote?", [])["score"] is None
