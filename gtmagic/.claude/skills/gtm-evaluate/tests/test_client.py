"""The API client with a fake network: key handling, request guard, retries, Models API check."""
from __future__ import annotations

import http.client
import io
import json
import os
import subprocess
import unittest
import urllib.error
from unittest import mock

import helpers  # noqa: F401
import claude_client as cc

FAKE_KEY = "sk-ant-test-0000000000"


class FakeResponse(io.BytesIO):
    def __init__(self, status: int, payload: dict) -> None:
        super().__init__(json.dumps(payload).encode("utf-8"))
        self.status = status
        self.headers = {}

    def __enter__(self):
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


def http_error(status: int, headers: dict | None = None) -> urllib.error.HTTPError:
    body = io.BytesIO(json.dumps({"error": {"message": f"boom {FAKE_KEY}"}}).encode("utf-8"))
    return urllib.error.HTTPError("https://x", status, "err", headers or {}, body)


class Opener:
    """Plays back a script of responses or exceptions and records each request."""

    def __init__(self, *script: object) -> None:
        self.script = list(script)
        self.requests: list = []

    def __call__(self, req, timeout: float):
        self.requests.append(req)
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


OK_MESSAGE = {"content": [{"type": "thinking", "thinking": ""}, {"type": "text", "text": "{\"a\": 1}"}],
              "stop_reason": "end_turn", "usage": {"input_tokens": 10, "output_tokens": 5}, "model": "m"}
BODY = {"model": "m", "max_tokens": 10, "messages": [], "output_config": {"effort": "low"}}


class KeyTest(unittest.TestCase):
    def test_env_var_wins(self) -> None:
        with mock.patch.dict(os.environ, {cc.KEY_ENV: FAKE_KEY}):
            self.assertEqual(cc.load_key(), FAKE_KEY)

    def test_keychain_key_never_on_the_command_line(self) -> None:
        done = subprocess.CompletedProcess([], 0, stdout=FAKE_KEY + "\n", stderr="")
        with mock.patch.dict(os.environ, {cc.KEY_ENV: ""}), mock.patch("subprocess.run", return_value=done) as run:
            self.assertEqual(cc.load_key(), FAKE_KEY)
        argv = run.call_args[0][0]
        self.assertIn(cc.KEYCHAIN_SERVICE, argv)
        self.assertNotIn(FAKE_KEY, " ".join(argv))

    def test_no_key_is_a_setup_error_without_the_generic_env_var(self) -> None:
        missing = subprocess.CompletedProcess([], 44, stdout="", stderr="not found")
        with mock.patch.dict(os.environ, {cc.KEY_ENV: "", "ANTHROPIC_API_KEY": FAKE_KEY}), \
                mock.patch("subprocess.run", return_value=missing):
            with self.assertRaises(cc.SetupError) as err:
                cc.load_key()
        self.assertNotIn(FAKE_KEY, str(err.exception))


class RequestTest(unittest.TestCase):
    def test_forbidden_keys_and_missing_effort(self) -> None:
        for extra in ({"temperature": 1}, {"top_p": 0.9}, {"top_k": 5}, {"tools": []}):
            with self.assertRaises(ValueError):
                cc.assert_request_shape({**BODY, **extra})
        with self.assertRaises(ValueError):
            cc.assert_request_shape({**BODY, "output_config": {}})

    def test_success_reads_the_text_block_and_sends_headers(self) -> None:
        opener = Opener(FakeResponse(200, OK_MESSAGE))
        reply = cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).message(BODY)
        self.assertEqual((reply.text, reply.stop_reason, reply.usage["output_tokens"]), ('{"a": 1}', "end_turn", 5))
        req = opener.requests[0]
        self.assertEqual(req.get_header("X-api-key"), FAKE_KEY)
        self.assertEqual(req.full_url, "https://api.anthropic.com/v1/messages")
        self.assertNotIn("temperature", json.loads(req.data))

    def test_retries_once_on_overload_then_succeeds(self) -> None:
        waits: list = []
        opener = Opener(http_error(529, {"retry-after": "3"}), FakeResponse(200, OK_MESSAGE))
        cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=waits.append).message(BODY)
        self.assertEqual(waits, [3.0])

    def test_gives_up_after_one_retry_and_redacts(self) -> None:
        opener = Opener(http_error(529), http_error(529))
        with self.assertRaises(cc.CallFailed) as err:
            cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).message(BODY)
        self.assertEqual(err.exception.reason, "api-error")
        self.assertNotIn(FAKE_KEY, str(err.exception))

    def test_bad_request_is_not_retried(self) -> None:
        opener = Opener(http_error(400))
        with self.assertRaises(cc.CallFailed):
            cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).message(BODY)
        self.assertEqual(len(opener.requests), 1)

    def test_unreadable_success_is_retried_then_skipped(self) -> None:
        for bad in (b"not json", b"[1, 2]", b"\xff\xfe"):
            garbled = FakeResponse(200, {})
            garbled.seek(0)
            garbled.truncate()
            garbled.write(bad)
            garbled.seek(0)
            opener = Opener(garbled, FakeResponse(200, OK_MESSAGE))
            reply = cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).message(BODY)
            self.assertEqual(reply.text, '{"a": 1}')
        no_text = {**OK_MESSAGE, "content": [{"type": "thinking", "thinking": ""}]}
        bool_usage = {**OK_MESSAGE, "usage": {"input_tokens": True, "output_tokens": 5}}
        for wrong_shape in ({"content": "oops"}, {**OK_MESSAGE, "usage": {}}, {**OK_MESSAGE, "stop_reason": None},
                            no_text, bool_usage):
            opener = Opener(FakeResponse(200, wrong_shape), FakeResponse(200, wrong_shape))
            with self.assertRaises(cc.CallFailed) as err:
                cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).message(BODY)
            self.assertTrue(err.exception.maybe_billed)

    def test_network_failure_is_a_timeout_skip(self) -> None:
        for first, second in ((urllib.error.URLError("down"), TimeoutError("slow")),
                              (http.client.IncompleteRead(b"x"), http.client.BadStatusLine("?"))):
            opener = Opener(first, second)
            with self.assertRaises(cc.CallFailed) as err:
                cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).message(BODY)
            self.assertEqual(err.exception.reason, "timeout")
            self.assertTrue(err.exception.maybe_billed and not err.exception.fatal)

    def test_client_errors_are_fatal_rate_limits_are_not(self) -> None:
        for status, fatal in ((302, True), (400, True), (401, True), (413, True), (429, False), (500, False)):
            opener = Opener(http_error(status), http_error(status))
            with self.assertRaises(cc.CallFailed) as err:
                cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).message(BODY)
            self.assertEqual(err.exception.fatal, fatal, status)

    def test_a_refusal_with_no_text_is_a_reply_not_an_error(self) -> None:
        refusal = {"content": [], "stop_reason": "refusal", "usage": {"input_tokens": 9, "output_tokens": 0}}
        reply = cc.ClaudeClient(FAKE_KEY, opener=Opener(FakeResponse(200, refusal))).message(BODY)
        self.assertEqual((reply.stop_reason, reply.text), ("refusal", ""))

    def test_a_lost_first_attempt_still_counts(self) -> None:
        opener = Opener(TimeoutError("slow"), FakeResponse(200, OK_MESSAGE))
        reply = cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).message(BODY)
        self.assertTrue(reply.earlier_attempt_unknown)  # the timed-out attempt may have been billed
        opener = Opener(TimeoutError("slow"), http_error(529))
        with self.assertRaises(cc.CallFailed) as err:
            cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).message(BODY)
        self.assertTrue(err.exception.maybe_billed)

    def test_redirects_are_never_followed(self) -> None:
        self.assertIsNone(cc._NoRedirect().redirect_request(None, None, 302, "Found", {}, "https://elsewhere"))


def caps(images: object, structured: object = True, low: object = True) -> dict:
    return {"image_input": {"supported": images}, "structured_outputs": {"supported": structured},
            "effort": {"supported": True, "low": {"supported": low}}}


class ModelCheckTest(unittest.TestCase):
    def test_capabilities_are_read_from_the_models_api(self) -> None:
        opener = Opener(FakeResponse(200, {"id": "claude-haiku-5-5", "capabilities": caps(True)}))
        got = cc.ClaudeClient(FAKE_KEY, opener=opener).model_capabilities("claude-haiku-5-5")
        self.assertEqual(got, caps(True))
        self.assertTrue(opener.requests[0].full_url.endswith("/v1/models/claude-haiku-5-5"))

    def test_fail_closed(self) -> None:
        cc.require_capabilities(caps(True), "m", needs_images=True, effort="low")
        cc.require_capabilities(caps(False), "m", needs_images=False, effort="low")  # headlines need no images
        for bad in (caps(False), caps(None), {}, None, caps(True, structured=False), caps(True, low=False)):
            with self.assertRaises(cc.SetupError):
                cc.require_capabilities(bad, "m", needs_images=True, effort="low")

    def test_models_api_failure_is_a_setup_error(self) -> None:
        opener = Opener(http_error(404))
        with self.assertRaises(cc.SetupError):
            cc.ClaudeClient(FAKE_KEY, opener=opener, sleep=lambda s: None).model_capabilities("nope")


if __name__ == "__main__":
    unittest.main()
