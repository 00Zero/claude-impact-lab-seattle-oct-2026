"""Claude-as-judge for the dimensions a script cannot measure.

Scores personalization and recipient_fit against the recipient context,
adjusts the voice score for word choice when owner samples exist, flags
over-personalization, and writes the suggested fix. The rubric is
skills/send-check/reference/rubric.md, the same file the plugin skill uses.

The model comes from SENDCHECK_JUDGE_MODEL, so the judge can run on a
different model than the one that drafted the text.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from pydantic import BaseModel

RUBRIC_PATH = (Path(__file__).resolve().parents[2]
               / "skills" / "send-check" / "reference" / "rubric.md")
DEFAULT_MODEL = "claude-opus-5-5"

INSTRUCTIONS = """You are the judge inside Send Check, a quality gate for outreach drafts.
A script has already measured generic phrases, length, balance, and style; its
results are in the request. Your job is the part a script cannot do:

- personalization and recipient_fit: score each with the rubric bands below
- voice_adjusted: only when owner samples are given, start from voice.score and
  adjust for word choice, register, and how the owner phrases an ask; otherwise null
- over_personalized: true if the draft references the recipient's private life or
  anything the sender could not plausibly know (rubric: Over-personalization)
- disqualifying: the judge-side disqualifying tells that fire, per the rubric's
  "Disqualifying tells" section (B11, B12, B24, B25), each with its exact span.
  Only for a single recipient ("audience" is "person"); empty for segments and
  when none fire. When unsure, it doesn't fire.
- suggested_fix: a revised draft following the rubric's fix rules, fixing every
  flagged issue in the script results and your own evidence. Empty string if the
  draft needs no changes or is beyond patching.
- missing: one sentence on what the draft most lacks (empty if nothing)
- headline_problem: the single biggest problem, as one plain sentence of at most
  15 words, naming the fact it rests on (empty if there is no real problem)
- headline_strength: the single best thing about the draft for this reader, one
  plain sentence of at most 15 words

Keep it crisp: at most 3 evidence items per dimension, each under 20 words, and
each suggestion one short sentence.

Every evidence item is an exact quote from the draft or a script finding.
Never invent facts about the recipient or the sender. Write evidence and
suggestions in plain language for a small-business owner: never mention
field names, script internals, or rubric caps.

When "sender" is present, it is the sender's saved profile. End suggested_fix
with sender.signature exactly as given (no placeholders like [Your Name]). Use
sender.about for what the business offers and results it can cite; never claim
anything beyond it. If no sender is given, leave a bracketed placeholder for
facts only the sender knows.

When "audience" is "segment", the recipient is a group on a send list and the
same draft goes to every group. Follow the rubric's Segments section: judge
the draft against this group's observable facts only, name the fact each
finding rests on, and write suggested_fix as the version for this group.

The rubric:

"""


class JudgedDimension(BaseModel):
    score: int
    evidence: list[str]
    suggestion: str


class DisqualifyingTell(BaseModel):
    id: str                    # B11, B12, B24, or B25 from docs/humanization-rubric.md
    span: str                  # exact quote, or "" for B24/B25 (an absence)
    reason: str


class Judgment(BaseModel):
    personalization: JudgedDimension
    recipient_fit: JudgedDimension
    voice_adjusted: int | None
    over_personalized: bool
    over_personalization_evidence: list[str]
    disqualifying: list[DisqualifyingTell]
    suggested_fix: str
    missing: str
    headline_problem: str
    headline_strength: str


def judge(request: dict) -> Judgment:
    """Score one draft. `request` holds the draft, recipient, and script results.

    Raises on API errors; the caller decides how to degrade.
    """
    import anthropic

    client = anthropic.Anthropic()
    response = client.beta.messages.parse(
        model=os.environ.get("SENDCHECK_JUDGE_MODEL") or DEFAULT_MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium"},
        system=[{
            "type": "text",
            "text": INSTRUCTIONS + RUBRIC_PATH.read_text(encoding="utf-8"),
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": json.dumps(request, indent=2)}],
        output_format=Judgment,
    )
    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise RuntimeError(f"judge returned no scores (stop_reason={response.stop_reason})")
    return response.parsed_output
