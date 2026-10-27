"""Mock replies: no network, no key, no cost. They exercise the real parser, mapper and scorer.

Ratings, picks and rankings are uniform seeded noise: never shaped toward any ad. Two persona calls fail
on purpose (one unreadable reply, one refusal) so every mock run also shows the skip path working.
"""
from __future__ import annotations

import json

from claude_client import Reply
from design import Call, rng, shuffled
from prompts import labels_for

MOCK_MODEL = "mock (no model called)"
MOCK_REASON = "Mock reply: no model was called."


def failing_calls(calls: list[Call], seed: int) -> dict[str, str]:
    """Two persona calls chosen by seed: one returns broken JSON, one is refused."""
    persona_ids = shuffled([c.id for c in calls if c.role == "persona"], rng(seed, "mock-failures"))
    return {cid: kind for cid, kind in zip(persona_ids, ("invalid-json", "refusal"))}


def mock_reply(call: Call, seed: int, failures: dict[str, str]) -> Reply:
    usage = {"input_tokens": 0, "output_tokens": 0}
    if failures.get(call.id) == "invalid-json":
        return Reply(text='{"ratings": {', stop_reason="end_turn", usage=usage, model=MOCK_MODEL)
    if failures.get(call.id) == "refusal":
        return Reply(text="", stop_reason="refusal", usage=usage, model=MOCK_MODEL)
    r = rng(seed, f"mock:{call.id}")
    labels = labels_for(len(call.order))
    if call.role.startswith("judge"):
        body = {"ranking": shuffled(labels, r), "reason": MOCK_REASON}
    else:
        options = labels + ["none"]
        body = {"ratings": {lab: 1 + int(r.random() * 5) for lab in labels},
                "pick": options[int(r.random() * len(options))], "reason": MOCK_REASON}
    return Reply(text=json.dumps(body), stop_reason="end_turn", usage=usage, model=MOCK_MODEL)
