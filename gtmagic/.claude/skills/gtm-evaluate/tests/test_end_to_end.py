"""Whole runs on the fiction fixture: mock runs, reproducibility, verify, honest wording, the spend gate,
and the live path with a fake client (no network)."""
from __future__ import annotations

import contextlib
import io
import json
import os
import re
import shutil
import tempfile
import unittest
from unittest import mock

import helpers
import evaluate
import outputs
from claude_client import Reply

# Words results and summaries must never use, except inside the fixed disclaimer that says what this isn't.
BANNED = re.compile(r"\bctr\b|click[- ]?through|conversion|predict|validated|\bpeople\b|respondent", re.IGNORECASE)


def run(argv: list[str]) -> tuple[int, str]:
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = evaluate.main(argv)
    return code, out.getvalue() + err.getvalue()


def read(folder: str, name: str) -> str:
    with open(os.path.join(folder, name), encoding="utf-8") as f:
        return f.read()


class FakeClient:
    """Answers every live call with a valid draft; records what it was asked."""

    calls: list = []
    caps = {"image_input": {"supported": True}, "structured_outputs": {"supported": True},
            "effort": {"supported": True, "low": {"supported": True}}}

    def __init__(self, key: str) -> None:
        pass

    def model_capabilities(self, model: str) -> dict:
        return FakeClient.caps

    def message(self, body: dict) -> Reply:
        FakeClient.calls.append(body)
        schema = body["output_config"]["format"]["schema"]["properties"]
        labels = schema["ranking"]["items"]["enum"] if "ranking" in schema else schema["pick"]["enum"][:-1]
        text = (json.dumps({"ranking": labels, "reason": "r"}) if "ranking" in schema
                else json.dumps({"ratings": {lab: 3 for lab in labels}, "pick": labels[0], "reason": "r"}))
        return Reply(text=text, stop_reason="end_turn", usage={"input_tokens": 1000, "output_tokens": 500}, model="fake")


class EndToEndTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp()
        FakeClient.calls = []

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp)

    def out(self, name: str) -> str:
        return os.path.join(self.tmp, name)

    def test_mock_images_reproducible_and_verified(self) -> None:
        for name in ("a", "b"):
            code, text = run(["run", "--mock", "--crowd", "--out", self.out(name)] + helpers.common_args())
            self.assertEqual(code, 0, text)
        self.assertEqual(read(self.out("a"), "results.json"), read(self.out("b"), "results.json"))
        self.assertEqual(read(self.out("a"), "responses.jsonl"), read(self.out("b"), "responses.jsonl"))
        results = json.loads(read(self.out("a"), "results.json"))
        self.assertEqual(results["personas"]["calls"], 48)
        self.assertEqual(results["personas"]["skipReasons"], {"invalid-output": 1, "refusal": 1})
        self.assertEqual(results["crowd"]["answered"], 48)
        self.assertEqual(run(["verify", self.out("a")])[0], 0)
        ledger = [json.loads(line) for line in read(self.tmp, "ledger.jsonl").splitlines()]
        self.assertEqual([e["event"] for e in ledger], ["started", "finished"] * 2)

    def test_verify_catches_tampering(self) -> None:
        run(["run", "--mock", "--out", self.out("a")] + helpers.common_args())
        path = os.path.join(self.out("a"), "responses.jsonl")
        with open(path, encoding="utf-8") as f:
            text = f.read()
        with open(path, "w", encoding="utf-8") as f:
            f.write(text.replace('"pick": "none"', '"pick": "img_1"', 1))
        self.assertEqual(run(["verify", self.out("a")])[0], 1)

    def test_headlines_and_honest_wording(self) -> None:
        code, text = run(["run", "--mock", "--out", self.out("h")]
                         + helpers.common_args(assets=["--headlines", helpers.DEMO_HEADLINES]))
        self.assertEqual(code, 0, text)
        run_json = json.loads(read(self.out("h"), "run.json"))
        self.assertEqual(sorted(run_json["design"]["orderings"]), [["hl_1", "hl_2"], ["hl_2", "hl_1"]])
        for name in ("summary.md", "results.json"):
            body = read(self.out("h"), name).replace(outputs.DISCLAIMER, "")
            self.assertIsNone(BANNED.search(body), f"{name}: {BANNED.search(body)}")
        self.assertIn("(simulated)", read(self.out("h"), "summary.md"))

    def test_out_folder_must_be_new(self) -> None:
        run(["run", "--mock", "--out", self.out("a")] + helpers.common_args())
        code, text = run(["run", "--mock", "--out", self.out("a")] + helpers.common_args())
        self.assertEqual(code, 2)
        self.assertIn("already exists", text)

    def test_estimate_needs_no_key_or_network(self) -> None:
        with mock.patch("evaluate.ClaudeClient", side_effect=AssertionError("no client in estimate")):
            code, text = run(["estimate", "--crowd"] + helpers.common_args())
        self.assertEqual(code, 0)
        self.assertIn("Estimated cost", text)

    def test_live_run_needs_a_cap_and_a_confirmed_model(self) -> None:
        with mock.patch("evaluate.ClaudeClient", FakeClient), mock.patch("evaluate.load_key", return_value="k"):
            self.assertEqual(run(["run", "--out", self.out("a")] + helpers.common_args())[0], 2)
            self.assertEqual(run(["run", "--max-usd", "0.001", "--out", self.out("b")] + helpers.common_args())[0], 2)
            with mock.patch.object(FakeClient, "caps", {**FakeClient.caps, "image_input": {"supported": False}}):
                code, text = run(["run", "--max-usd", "1", "--out", self.out("c")] + helpers.common_args())
            self.assertEqual(code, 2)
            self.assertIn("image input", text)
        self.assertFalse(any(os.path.exists(self.out(n)) for n in "abc"))
        self.assertEqual(FakeClient.calls, [])

    def test_live_path_with_fake_client(self) -> None:
        with mock.patch("evaluate.ClaudeClient", FakeClient), mock.patch("evaluate.load_key", return_value="k"):
            code, text = run(["run", "--max-usd", "1", "--out", self.out("live")] + helpers.common_args())
        self.assertEqual(code, 0, text)
        self.assertEqual(len(FakeClient.calls), 48 + 10 + 3 + 3)
        for body in FakeClient.calls:
            self.assertEqual(body["model"], "claude-haiku-5-5")
            self.assertEqual(body["output_config"]["effort"], "low")
            self.assertFalse({"temperature", "top_p", "top_k", "tools"} & set(body))
        run_json = json.loads(read(self.out("live"), "run.json"))
        self.assertEqual(run_json["modelCheck"]["imageInput"], True)
        self.assertGreater(run_json["cost"]["actualUsd"], 0)

    def test_spend_cap_stops_calls_without_overshooting(self) -> None:
        with mock.patch("evaluate.ClaudeClient", FakeClient), mock.patch("evaluate.load_key", return_value="k"), \
                mock.patch("evaluate.cost.estimate", return_value={"calls": 64, "inputTokens": 0,
                                                                   "expectedUsd": 0.0, "worstCaseUsd": 0.0}):
            code, text = run(["run", "--max-usd", "0.02", "--out", self.out("cap")] + helpers.common_args())
        self.assertEqual(code, 0, text)
        run_json = json.loads(read(self.out("cap"), "run.json"))
        results = json.loads(read(self.out("cap"), "results.json"))
        self.assertLessEqual(run_json["cost"]["actualUsd"], 0.02)
        self.assertTrue(any(f.startswith("budget-cap-reached") for f in results["flags"]))


if __name__ == "__main__":
    unittest.main()
