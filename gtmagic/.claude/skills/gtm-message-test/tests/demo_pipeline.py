"""The demo run end to end, so the fixtures can be regenerated and checked instead of stored twice.

Regenerate fixtures/demo/message-test/{positioning-set,experiment-request,experiment-results}.json from the repo root:
    python3 .claude/skills/gtm-message-test/tests/demo_pipeline.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
DEMO = ROOT / "fixtures" / "demo"
OUT = DEMO / "message-test"  # this skill's own files; fixtures/demo/<kind>.json is reserved for the app's artifacts
sys.path.insert(0, str(HERE.parent / "scripts"))
import build_test  # noqa: E402
import evaluate  # noqa: E402
import fake_responses  # noqa: E402

CURRENT_CREATIVE = "cr_1"  # the owner's best Meta ad: "Lose weight without losing muscle" (headline only, so every option is too)
FAKE_N, FAKE_SEED, EVAL_SEED = 48, 7, 42
# Stands in for Claude's tagging step: the fake objections are templates, so each maps to one theme.
THEMES = [("th_generic", "Sounds like every other app", "Sounds like every other app."),
          ("th_price", "Unsure it's worth the price", "Not sure it's worth the price."),
          ("th_proof", "Wants to see how it works first", "I'd need to see how it works first."),
          ("th_fit", "Doesn't feel meant for them", "Doesn't sound like it's for someone like me.")]


def load(name: str) -> dict:
    folder = DEMO if name == "intake.json" else OUT
    return json.loads((folder / name).read_text(encoding="utf-8"))


def build_args(**over: object) -> argparse.Namespace:
    base = dict(current_creative=CURRENT_CREATIVE, current_headline=None, current_subheadline=None, category="fitness app",
                channel="landing-page", audience=None, seed=None)
    return argparse.Namespace(**{**base, **over})


def tag_themes(responses: dict) -> dict:
    by_text = {text: tid for tid, _, text in THEMES}
    tags = [{"responseId": r["id"], "objectionIndex": i, "themeId": by_text[o["text"]]}
            for r in responses["responses"] if not r["isRepeat"] for i, o in enumerate(r["objections"])]
    return {"themes": [{"id": tid, "theme": theme} for tid, theme, _ in THEMES], "tags": tags}


def run() -> dict:
    intake, drafts = load("intake.json"), load("message-drafts.json")
    positioning, request, errors, _ = build_test.build(intake, drafts, build_args())
    if errors:
        raise SystemExit(f"demo build failed: {errors}")
    responses = fake_responses.fake(intake, positioning, request, FAKE_N, FAKE_SEED)
    results, _ = evaluate.evaluate(intake, positioning, request, responses, tag_themes(responses), EVAL_SEED)
    return {"positioning-set.json": positioning, "experiment-request.json": request,
            "customer-responses": responses, "experiment-results.json": results}


if __name__ == "__main__":
    out = run()
    for name in ("positioning-set.json", "experiment-request.json", "experiment-results.json"):
        (OUT / name).write_text(json.dumps(out[name], indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("OK regenerated the demo fixtures in fixtures/demo/message-test/")
