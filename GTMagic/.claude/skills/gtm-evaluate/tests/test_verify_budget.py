"""verify against tampering, the spend cap's deterministic cut, and argument and path guards."""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import threading
import unittest
from unittest import mock

import helpers
import outputs
from claude_client import CallFailed
from test_end_to_end import FakeClient, read, run


class FailingClient(FakeClient):
    """The first message fails the given way; every later one would succeed."""

    error: Exception = CallFailed("api-error", "HTTP 400: bad schema", fatal=True)

    def message(self, body: dict):
        if not FakeClient.calls:
            FakeClient.calls.append(body)
            raise FailingClient.error
        return super().message(body)


def rewrite_jsonl(path: str, change) -> None:
    with open(path, encoding="utf-8") as f:
        rows = [json.loads(line) for line in f if line.strip()]
    outputs.write_jsonl(path, [change(r) for r in rows])


class VerifyTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp()
        self.folder = os.path.join(self.tmp, "a")
        code, text = run(["run", "--mock", "--out", self.folder] + helpers.common_args())
        self.assertEqual(code, 0, text)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp)

    def test_clean_run_and_published_digest(self) -> None:
        digest = read(self.folder, outputs.HASH_FILE).splitlines()[-1].rsplit(" ", 1)[-1]
        self.assertEqual(run(["verify", self.folder, "--digest", digest])[0], 0)
        self.assertEqual(run(["verify", self.folder, "--digest", "0" * 64])[0], 1)

    def test_changed_result_fails_even_after_resealing(self) -> None:
        # Someone edits a mapped result (not the raw reply) and recomputes every hash: still caught.
        def flip(r: dict) -> dict:
            if r["status"] == "answered" and r["role"] == "persona" and not flip.done:
                ratings = r["result"]["ratings"]
                first = sorted(ratings)[0]
                ratings[first] = 6 - ratings[first]
                flip.done = True
            return r
        flip.done = False
        rewrite_jsonl(os.path.join(self.folder, "responses.jsonl"), flip)
        outputs.seal(self.folder)
        code, text = run(["verify", self.folder])
        self.assertEqual(code, 1)
        self.assertIn("doesn't match its raw reply", text)

    def test_changed_metadata_fails_even_after_resealing(self) -> None:
        def move(r: dict) -> dict:
            if r["role"] == "repeat" and not move.done:
                r["personaId"] = "p_001" if r["personaId"] != "p_001" else "p_002"
                move.done = True
            return r
        move.done = False
        rewrite_jsonl(os.path.join(self.folder, "responses.jsonl"), move)
        outputs.seal(self.folder)
        code, text = run(["verify", self.folder])
        self.assertEqual(code, 1)
        self.assertIn("differs from the plan", text)

    def test_dropped_record_and_odd_manifest_fail(self) -> None:
        rewrite_jsonl(os.path.join(self.folder, "responses.jsonl"), lambda r: r)
        path = os.path.join(self.folder, "responses.jsonl")
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
        with open(path, "w", encoding="utf-8") as f:
            f.writelines(lines[1:])
        outputs.seal(self.folder)
        self.assertIn("have no record", run(["verify", self.folder])[1])
        with open(os.path.join(self.folder, outputs.HASH_FILE), "a", encoding="utf-8") as f:
            f.write("0" * 64 + "  ../sealed/secret.json\n")
        code, text = run(["verify", self.folder])
        self.assertEqual(code, 1)
        self.assertIn("must list exactly", text)

    def test_not_a_run_folder(self) -> None:
        code, text = run(["verify", self.tmp])
        self.assertEqual(code, 2)  # bad input, not a mismatch
        self.assertIn("isn't a finished run folder", text)


class GuardTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp()
        FakeClient.calls = []

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp)

    def test_spend_cap_cuts_only_the_tail_of_the_seeded_order(self) -> None:
        runs = []
        for name in ("x", "y"):
            folder = os.path.join(self.tmp, name)
            with mock.patch("evaluate.ClaudeClient", FakeClient), mock.patch("evaluate.load_key", return_value="k"), \
                    mock.patch("evaluate.cost.estimate", return_value={"calls": 64, "inputTokens": 0,
                                                                       "expectedUsd": 0.0, "worstCaseUsd": 0.0}):
                self.assertEqual(run(["run", "--max-usd", "0.012", "--out", folder] + helpers.common_args())[0], 0)
            order = json.loads(read(folder, "run.json"))["design"]["executionOrder"]
            with open(os.path.join(folder, "responses.jsonl"), encoding="utf-8") as f:
                sent = {r["callId"] for r in map(json.loads, f) if r.get("skipReason") != "budget"}
            self.assertTrue(0 < len(sent) < len(order))
            self.assertEqual(sent, set(order[:len(sent)]))  # a prefix, never a scheduling accident
            self.assertLessEqual(json.loads(read(folder, "run.json"))["cost"]["actualUsd"], 0.012)
            runs.append(sent)
        self.assertEqual(runs[0], runs[1])

    def test_bad_arguments(self) -> None:
        folder = os.path.join(self.tmp, "b")
        for extra in (["--max-usd", "nan"], ["--max-usd", "-1"], ["--creative-ids", "cr_1"]):
            with mock.patch("evaluate.ClaudeClient", FakeClient), mock.patch("evaluate.load_key", return_value="k"):
                with self.assertRaises(SystemExit):
                    run(["run", "--out", folder] + extra + helpers.common_args())
        self.assertFalse(os.path.exists(folder))
        self.assertEqual(FakeClient.calls, [])

    def live(self, client: type, extra: list[str], name: str = "r") -> tuple[int, str, str]:
        folder = os.path.join(self.tmp, name)
        with mock.patch("evaluate.ClaudeClient", client), mock.patch("evaluate.load_key", return_value="k"):
            code, text = run(["run", "--out", folder] + extra + helpers.common_args())
        return code, text, folder

    def test_a_fatal_error_stops_the_run_but_it_still_seals(self) -> None:
        for error, reason in ((CallFailed("api-error", "HTTP 400: bad", fatal=True), "api-error"),
                              (KeyError("bug"), "client-error")):
            FakeClient.calls = []
            FailingClient.error = error
            code, text, folder = self.live(FailingClient, ["--max-usd", "1"], reason)
            self.assertEqual(code, 2, text)
            self.assertIn("stopped early", text)
            self.assertLessEqual(len(FakeClient.calls), 8)  # at most the calls already in flight
            results = json.loads(read(folder, "results.json"))
            self.assertTrue(results["flags"][0].startswith("aborted"))
            with open(os.path.join(folder, "responses.jsonl"), encoding="utf-8") as f:
                reasons = {json.loads(line).get("skipReason") for line in f}
            self.assertIn(reason, reasons)
            self.assertIn("aborted", reasons)
            self.assertEqual(run(["verify", folder])[0], 0)
            ledger = [json.loads(line) for line in read(self.tmp, "ledger.jsonl").splitlines()]
            self.assertEqual(ledger[-1]["event"], "aborted")
            summary = read(folder, "summary.md")
            self.assertIn("Stopped early: incomplete, not a result", summary)
            self.assertNotIn("| Rank |", summary)

    def test_a_fatal_error_on_the_last_call_still_verifies(self) -> None:
        lock = threading.Lock()

        class LastCallFails(FakeClient):
            def message(self, body: dict):
                with lock:  # count atomically: worker threads call this concurrently
                    last = len(FakeClient.calls) == 63  # the 64th and last message sent
                    FakeClient.calls.append(body)
                if last:
                    raise CallFailed("api-error", "HTTP 400: bad", fatal=True)
                FakeClient.calls.pop()  # super() records it again
                return super().message(body)

        code, _, folder = self.live(LastCallFails, ["--max-usd", "1"], "last")
        self.assertEqual(code, 2)
        self.assertEqual(run(["verify", folder])[0], 0)

    def test_blind_needs_a_frozen_brief_and_a_full_cap(self) -> None:
        with self.assertRaises(SystemExit):  # --blind without --intake-sha256
            run(["estimate", "--blind"] + helpers.common_args())
        brief = helpers.demo_brief()
        brief["priorExperiments"], brief["evidence"] = [], []
        for c in brief["creatives"]:
            c["performance"] = None
        intake = helpers.write_json(os.path.join(self.tmp, "frozen.json"), brief)
        with open(intake, "rb") as f:
            digest = __import__("hashlib").sha256(f.read()).hexdigest()
        args = ["--blind", "--intake-sha256", digest]
        with mock.patch("evaluate.ClaudeClient", FakeClient), mock.patch("evaluate.load_key", return_value="k"):
            code, text = run(["run", "--max-usd", "0.10", "--out", os.path.join(self.tmp, "low")] + args
                             + helpers.common_args(intake=intake))
            self.assertEqual(code, 2)
            self.assertIn("worst case", text)
            code, text = run(["run", "--max-usd", "1", "--out", os.path.join(self.tmp, "ok")] + args
                             + helpers.common_args(intake=intake))
        self.assertEqual(code, 0, text)
        self.assertTrue(json.loads(read(os.path.join(self.tmp, "ok"), "run.json"))["blind"])

    def test_any_ledger_symlink_is_refused_before_anything_is_made(self) -> None:
        os.makedirs(os.path.join(self.tmp, "runs"))
        os.symlink(os.path.join(self.tmp, "elsewhere.jsonl"), os.path.join(self.tmp, "runs", "ledger.jsonl"))
        code, text = run(["run", "--mock", "--out", os.path.join(self.tmp, "runs", "r1")] + helpers.common_args())
        self.assertEqual(code, 2)
        self.assertIn("symlink", text)
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "runs", "r1")))

    def test_ledger_symlink_into_sealed_is_refused(self) -> None:
        os.makedirs(os.path.join(self.tmp, "sealed"))
        os.makedirs(os.path.join(self.tmp, "runs"))
        os.symlink(os.path.join(self.tmp, "sealed", "results.jsonl"), os.path.join(self.tmp, "runs", "ledger.jsonl"))
        code, text = run(["run", "--mock", "--out", os.path.join(self.tmp, "runs", "r1")] + helpers.common_args())
        self.assertEqual(code, 2)
        self.assertIn("sealed", text)
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "sealed", "results.jsonl")))


if __name__ == "__main__":
    unittest.main()
