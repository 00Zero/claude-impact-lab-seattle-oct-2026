"""gtm-creatives tests: the call loop, the OpenRouter client, and a mock run end to end whose drafts
gtm-message-test's build_test.py must accept.

Run from the repo root: python3 -m unittest discover -s .claude/skills/gtm-creatives/tests
"""
from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
import urllib.error

from helpers import BUILD_TEST, DEMO, PRICE, PRINCIPLES, SCRIPTS, option, reply

import generate  # noqa: E402 (helpers put scripts/ on the path)
import openrouter_client as orc  # noqa: E402
import writer  # noqa: E402


class WriterTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.out = tmp.name
        principles = os.path.join(tmp.name, "p.md")
        with open(principles, "w", encoding="utf-8") as f:
            f.write(PRINCIPLES)
        args = type("A", (), {"intake": DEMO, "alongside": True, "principles": principles, "count": 8})()
        self.p = generate.prepare(args)
        self.ctx = generate.build_context(self.p["intake"])

    def run_with(self, replies: list) -> writer.Outcome:
        sent: list[dict] = []

        def chat(body: dict) -> orc.Reply | None:
            sent.append(body)
            item = replies.pop(0) if replies else None
            if isinstance(item, Exception):
                raise item
            return item
        result = writer.run_calls(self.p, self.ctx, chat, "m", 1, PRICE, self.out, lambda: "t")
        result.sent = sent  # type: ignore[attr-defined]
        return result

    def seg1(self, n: int) -> list:
        return [option(headline=f"Lose the fat, not the muscle mass, option {w}") for w in "abcdefgh"[:n]]

    def test_principles_section_only(self) -> None:
        self.assertNotIn("Higher total wins", self.p["system"])
        self.assertEqual(self.p["schema"]["properties"]["options"]["items"]["properties"]["principlesUsed"]["items"]["enum"],
                         [1, 2, 3])

    def test_empty_group_triggers_call_2_and_extras_are_ignored(self) -> None:
        result = self.run_with([reply(self.seg1(8)), reply([])])
        self.assertEqual(len(result.calls), 2)                  # seg_2 got nothing, though 4 were kept
        self.assertEqual(sum(c.kept for _, c in result.checked), 4)   # seg_1 capped at its share of 4
        self.assertTrue(any("more option(s) than asked" in w for w in result.warnings))
        self.assertIn("4 for seg_2", result.sent[1]["messages"][1]["content"])

    def test_call_2_withholds_copied_quotes_whatever_dropped_them(self) -> None:
        quote = "Lost muscle mass though and feel quite frail, the best"   # copied, and a superlative
        result = self.run_with([reply([option(headline=quote)]), reply([])])
        self.assertIn("withheld", result.sent[1]["messages"][1]["content"])
        self.assertNotIn("feel quite frail", result.sent[1]["messages"][1]["content"])

    def test_failed_call_2_keeps_call_1(self) -> None:
        result = self.run_with([reply(self.seg1(3)), orc.CallFailed("HTTP 500: boom")])
        self.assertFalse(result.first_call_failed)
        self.assertEqual(sum(c.kept for _, c in result.checked), 3)
        failed = self.run_with([orc.CallFailed("HTTP 401: nope", maybe_billed=False)])
        self.assertTrue(failed.first_call_failed)

    def test_unparsed_and_truncated_replies(self) -> None:
        bad = orc.Reply(text="not json", finish_reason="length", generation_id="g", model="m", usage={})
        result = self.run_with([bad, reply([])])
        self.assertEqual(result.calls[0]["outcome"], "unparsed")
        self.assertTrue(any("ran out of room" in w for w in result.warnings))

    def test_worst_case_covers_both_calls_and_retries(self) -> None:
        exact = 4 * (300 * 2 + 8000 * 10) / 1e6        # 2 calls x 2 attempts, framing tokens, full completions
        worst = writer.worst_case_usd(PRICE, "", 0, {})
        self.assertTrue(exact <= worst < exact + 0.0002, worst)   # rounded up, never down
        body = writer.request_body("m", "s", "u", {}, 1, PRICE)
        orc.assert_request_shape(body)
        for bad in ({"temperature": 1}, {"reasoning": {}}, {"provider": {"data_collection": "allow"}}):
            with self.subTest(bad), self.assertRaises(ValueError):
                orc.assert_request_shape({**body, **bad})


class FakeResponse(io.BytesIO):
    def __init__(self, status: int, body: dict) -> None:
        super().__init__(json.dumps(body).encode())
        self.status, self.headers = status, {}

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


def opener(responses: list) -> object:
    """Returns each queued (status, body) in turn; error statuses raise HTTPError like urllib does."""
    def open_(req: object, timeout: float = 0) -> FakeResponse:
        status, body = responses.pop(0)
        if status >= 400:
            raise urllib.error.HTTPError("u", status, "err", {}, io.BytesIO(json.dumps(body).encode()))
        return FakeResponse(status, body)
    return open_


class ClientTest(unittest.TestCase):
    OK = {"id": "gen-1", "model": "m", "usage": {"cost": 0.01},
          "choices": [{"message": {"content": "{\"options\": []}"}, "finish_reason": "stop"}]}

    def body(self) -> dict:
        return writer.request_body("m", "s", "u", {}, 1, PRICE)

    def test_retry_then_success(self) -> None:
        client = orc.OpenRouterClient("k", opener=opener([(429, {"error": {"message": "slow"}}), (200, self.OK)]),
                                      sleep=lambda s: None)
        self.assertEqual(client.chat(self.body()).generation_id, "gen-1")

    def test_errors_are_plain_and_redacted(self) -> None:
        client = orc.OpenRouterClient("k", opener=opener([(401, {"error": {"message": "bad key sk-or-v1-abc123"}})]))
        with self.assertRaises(orc.CallFailed) as caught:
            client.chat(self.body())
        self.assertNotIn("sk-or-v1-abc123", str(caught.exception))
        self.assertIn("key was rejected", str(caught.exception))

    def test_malformed_key_never_reaches_a_header(self) -> None:
        self.assertEqual(orc.checked_key("sk-or-v1-abc", "env"), "sk-or-v1-abc")
        for bad in ("sk-or-v1-abc\nX: y", "not-a-key", "sk-or-v1-abc def"):
            with self.subTest(bad), self.assertRaises(orc.SetupError) as caught:
                orc.checked_key(bad, "env")
            self.assertNotIn("abc", str(caught.exception))

    def test_model_price(self) -> None:
        listing = {"data": [{"id": "m", "supported_parameters": ["structured_outputs"],
                             "pricing": {"prompt": "0.000002", "completion": "0.00001"}}]}
        price = orc.OpenRouterClient("", opener=opener([(200, listing)])).model_price("m")
        self.assertEqual((round(price.prompt_per_million, 6), round(price.completion_per_million, 6)), (2.0, 10.0))
        listing["data"][0]["supported_parameters"] = []
        with self.assertRaises(orc.SetupError):
            orc.OpenRouterClient("", opener=opener([(200, listing)])).model_price("m")


class MockRunTest(unittest.TestCase):
    def test_mock_run_hands_off_to_message_test(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            principles = os.path.join(tmp, "principles.md")
            with open(principles, "w", encoding="utf-8") as f:
                f.write(PRINCIPLES)
            out = os.path.join(tmp, "ws", "creatives")
            cmd = [sys.executable, os.path.join(SCRIPTS, "generate.py"), "run", DEMO, "--out", out,
                   "--mock", "--alongside", "--principles", principles]
            run = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            with open(os.path.join(out, "generated.json"), encoding="utf-8") as f:
                record = json.load(f)
            self.assertEqual((len(record["calls"]), sum(o["status"] == "kept" for o in record["options"])), (2, 7))
            self.assertTrue(all(o["isDraft"] for o in record["options"]))
            with open(os.path.join(out, "creatives.md"), encoding="utf-8") as f:
                md = f.read()
            self.assertIn("FAKE", md)
            self.assertNotIn("seg_", md)
            self.assertNotIn("screen for losers", md)
            for current in (["--current-creative", "cr_1"], []):   # with and without the owner's message
                built = subprocess.run([sys.executable, BUILD_TEST, DEMO, os.path.join(out, "message-drafts.json"),
                                        "--out-dir", tmp, "--category", "fitness app", *current],
                                       capture_output=True, text=True)
                self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            self.assertEqual(subprocess.run(cmd, capture_output=True, text=True).returncode, 2)  # no silent overwrite


if __name__ == "__main__":
    unittest.main()
