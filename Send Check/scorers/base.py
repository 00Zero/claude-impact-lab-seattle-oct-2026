"""Send Check scoring contract. FROZEN after kickoff hour 1.

Every backend implements ScoringBackend. The pipeline, web UI, and skill
depend only on this module. Change it only by team agreement at standup.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Protocol

Verdict = Literal["send", "fix", "scrap"]


@dataclass
class Recipient:
    """What we know about the person receiving the draft."""
    name: str = ""
    role: str = ""
    company: str = ""
    context: str = ""          # free text: scraped bio, CRM notes, site copy
    source_url: str = ""       # where context came from (LinkedIn, site)


@dataclass
class Draft:
    """The outreach being scored."""
    text: str
    channel: Literal["email", "linkedin", "other"] = "email"
    subject: str = ""          # email only


@dataclass
class DimensionScore:
    name: str                  # e.g. "slop", "personalization", "recipient_fit"
    score: int                 # 0-100
    evidence: list[str] = field(default_factory=list)   # concrete, quotable findings
    suggestion: str = ""       # how to improve this dimension


@dataclass
class Scorecard:
    verdict: Verdict
    score: int                 # 0-100 overall
    dimensions: list[DimensionScore]
    suggested_fix: str = ""    # full revised draft the owner may approve
    backend: str = "naive"
    notes: str = ""            # anything the backend wants to surface


class ScoringBackend(Protocol):
    """Implement this to plug in a scorer."""

    name: str

    def score(self, draft: Draft, recipient: Recipient) -> Scorecard:
        """Score a draft against a recipient. Must not raise on bad input;
        return a Scorecard with verdict='fix' and notes explaining issues."""
        ...


def verdict_from_score(score: int) -> Verdict:
    """Shared thresholds so every backend maps scores the same way."""
    if score >= 75:
        return "send"
    if score >= 45:
        return "fix"
    return "scrap"
