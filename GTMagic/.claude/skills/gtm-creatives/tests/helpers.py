"""Shared fixtures for the gtm-creatives tests. No network, no key."""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(os.path.dirname(HERE), "scripts")
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
DEMO = os.path.join(REPO, "fixtures", "demo", "intake.json")
BUILD_TEST = os.path.join(REPO, ".claude", "skills", "gtm-message-test", "scripts", "build_test.py")
sys.path.insert(0, SCRIPTS)

import openrouter_client as orc  # noqa: E402

# A stand-in principles file shaped like gtm-ad-wording's: a comment, the numbered list, then a second
# numbered list (the comparison procedure) that must not be read as principles.
PRINCIPLES = ("<!-- provenance -->\n# Principles\n\n1. **Concrete scene over abstract issue.**\n"
              "2. **Open a curiosity gap, but anchor it.**\n3. **Two beats: setup, then turn.**\n\n"
              "## 3-step procedure\n\n1. **Screen for losers.** Higher total wins.\n")
PRICE = orc.ModelPrice("openai/gpt-6.1-sol", 2.0, 10.0)


def demo() -> dict:
    with open(DEMO, encoding="utf-8") as f:
        return json.load(f)


def option(**over: object) -> dict:
    base = {"angle": "Strength over the scale", "targetSegmentId": "seg_1",
            "headline": "Lose the fat, not the muscle mass you worked for",
            "subheadline": "Short strength sessions and protein help for people who want to stay strong.",
            "callToAction": "Start your first session", "lexiconIds": ["lex_1"], "principlesUsed": [1],
            "valueProposition": "Strength kept.", "differentiator": "Muscle first.", "whyItMightWork": "Names the fear.",
            "assumptions": ["Offers short sessions"]}
    return {**base, **over}


def reply(options: list, finish: str = "stop") -> orc.Reply:
    return orc.Reply(text=json.dumps({"options": options}), finish_reason=finish, generation_id="g", model="m",
                     usage={"prompt_tokens": 10, "completion_tokens": 10, "cost": 0.001})
