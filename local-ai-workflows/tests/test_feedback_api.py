"""Server-handler control-path tests use fake inference and fictional fixture data only."""
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))
import coach
import server
import ollama
from store import Store


class FeedbackAPI(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_store = server.store
        server.store = Store(self.tmp.name)
        prefs = coach.DEFAULT_STYLES[0]["preferences"]
        self.style = server.store.create_style("API test", "default", "narrative")
        self.version = server.store.add_version(self.style["id"], prefs, coach.compile_prompt(prefs), "fictional")
        self.run = server.store.add_run(purpose="simulation", fixtureRole="simulation", fixtureId="narrative-b",
            fixtureVersion="1", versionId=self.version["id"], promptSnapshot=self.version["prompt"], runtime={},
            status="completed", output="fictional note", checks=[])
        server.store.mark_fixture_development("narrative-a", "test setup")
        self.handler = object.__new__(server.Handler)
        self.handler.send_json = lambda obj, code=200: (obj, code)
        self.handler.err = lambda msg, code=400: ({"error": msg}, code)

    def tearDown(self):
        server.store = self.old_store
        self.tmp.cleanup()

    def post_feedback(self, body, cancel=False):
        class Job:
            id = "job_test"
            cancel = threading.Event()
            def set_phase(self, phase): self.phase = phase
        def fake_start_job(kind, fn, *args):
            job = Job()
            if cancel: job.cancel.set()
            try:
                job.result = fn(job, *args)
                job.status = "completed"
            except ollama.Cancelled:
                job.result = None
                job.status = "cancelled"
            self.job = job
            return job
        with patch.object(server, "start_job", side_effect=fake_start_job):
            response, _ = self.handler.feedback(self.run["id"], body)
        return response

    def test_vague_feedback_clarifies_without_version_or_proposal(self):
        with patch.object(server.ollama, "interpret_feedback", side_effect=AssertionError("vague gate should short-circuit")):
            result = self.post_feedback({"scope": "future", "text": "make it better"})
        self.assertEqual(self.job.result["interpretation"]["kind"], "clarification")
        self.assertEqual(len(server.store.versions_of(self.style["id"])), 1)
        self.assertEqual(server.store.data["proposals"], [])
        self.assertEqual(server.store.data["fixtureUse"]["narrative-b"]["role"], "development")

    def test_patch_is_pending_until_confirmed_and_stale_base_is_rejected(self):
        raw = '{"kind":"patch","patch":[{"path":"sentences.min","value":1},{"path":"sentences.max","value":1}],"explanation":"Exactly one sentence."}'
        with patch.object(server.ollama, "interpret_feedback", return_value=(raw, {})):
            result = self.post_feedback({"scope": "future", "text": "one sentence"})
        proposal = self.job.result["patchProposal"]
        self.assertEqual(len(server.store.versions_of(self.style["id"])), 1)
        self.assertEqual(proposal["baseVersionId"], self.version["id"])
        self.assertNotIn("narrative-c", server.store.data["fixtureUse"], "pending proposal must not consume C")
        stale, status = self.handler.confirm_patch(proposal["id"], {"baseVersionId": "stale"})
        self.assertEqual(status, 400)
        self.assertIn("stale", stale["error"])
        self.assertEqual(len(server.store.versions_of(self.style["id"])), 1)
        with patch.object(server, "start_job", return_value=type("J", (), {"id": "job_preview"})()) as start:
            confirmed, status = self.handler.confirm_patch(proposal["id"], {"baseVersionId": self.version["id"]})
        self.assertEqual(status, 200)
        self.assertEqual(start.call_args.args[0], "proposal_check")
        self.assertEqual(start.call_args.args[3], "narrative-c")
        # Version creation happens only on confirmation. Offline preview failure cannot activate it.
        self.assertEqual(len(server.store.versions_of(self.style["id"])), 2)
        new_version = server.store.version(confirmed["proposalId"])
        self.assertEqual(new_version["state"], "proposed")
        self.assertIsNone(server.store.style(self.style["id"])["activeVersionId"])

    def test_cancelled_interpretation_keeps_style_and_run_history_intact(self):
        with patch.object(server.ollama, "interpret_feedback", side_effect=ollama.Cancelled()):
            result = self.post_feedback({"scope": "future", "text": "shorter please"}, cancel=True)
        self.assertEqual(result["scope"], "future")
        self.assertEqual(self.job.status, "cancelled")
        self.assertEqual(len(server.store.versions_of(self.style["id"])), 1)
        self.assertEqual(server.store.data["proposals"], [])
        self.assertIsNone(server.store.run(self.run["id"])["feedback"])
        self.assertEqual(server.store.style(self.style["id"])["activeVersionId"], None)

    def test_note_retry_uses_same_version_and_source_with_ephemeral_prompt(self):
        original = self.run
        class Job:
            id = "job_test"
            cancel = threading.Event()
            def set_phase(self, phase): pass
        with patch.object(ollama, "runtime_info", return_value={"available": True, "model": "fake", "digest": "fake"}), \
             patch.object(ollama, "chat", return_value=("fictional generated note", {"eval_count": 4})) as chat:
            result = server.retry_note_job(Job(), original["id"], "One sentence only")
            retry = server.store.run(result["runId"])
        self.assertEqual(retry["versionId"], original["versionId"])
        self.assertEqual(retry["fixtureId"], original["fixtureId"])
        self.assertEqual(retry["parentRunId"], original["id"])
        self.assertEqual(retry["fixtureRole"], "retry_reused")
        self.assertEqual(retry["evidenceStatus"], "reused")
        self.assertIn("One sentence only", retry["promptSnapshot"])
        self.assertEqual(len(server.store.versions_of(self.style["id"])), 1)
        self.assertEqual(server.store.run(original["id"])["output"], "fictional note")
        chat.assert_called_once()

    def test_ollama_route_rejects_public_and_allows_opted_in_private_ip(self):
        with patch.object(ollama, "OLLAMA_URL", "http://127.0.0.1:11434"):
            ollama._local_only(ollama.OLLAMA_URL)
        with patch.object(ollama, "OLLAMA_URL", "http://8.8.8.8:11434"):
            with self.assertRaises(ollama.GenerationError): ollama._local_only(ollama.OLLAMA_URL)
        with patch.dict("os.environ", {"COACH_ALLOW_PRIVATE_OLLAMA": "1"}), patch.object(ollama, "OLLAMA_URL", "http://192.168.1.12:11434"):
            ollama._local_only(ollama.OLLAMA_URL)
        with patch.object(ollama, "OLLAMA_URL", "http://user:pass@192.168.1.12:11434"):
            with self.assertRaises(ollama.GenerationError): ollama._local_only(ollama.OLLAMA_URL)
        with patch.dict("os.environ", {"COACH_ALLOW_PRIVATE_OLLAMA": "1"}):
            for url in ("http://[::ffff:8.8.8.8]:11434", "http://0.0.0.0:11434"):
                with self.subTest(url=url), patch.object(ollama, "OLLAMA_URL", url):
                    with self.assertRaises(ollama.GenerationError): ollama._local_only(url)
        for url in ("http://localhost:abc", "http://localhost:99999"):
            with self.subTest(url=url), patch.object(ollama, "OLLAMA_URL", url):
                with self.assertRaises(ollama.GenerationError): ollama._local_only(url)

    def test_fenced_json_response_with_missing_kind_still_produces_typed_proposal(self):
        raw = '```json\n{"patch":[{"path":"sentences.min","value":1},{"path":"sentences.max","value":1}],"explanation":"One sentence"}\n```'
        with patch.object(server.ollama, "interpret_feedback", return_value=(raw, {})):
            self.post_feedback({"scope": "future", "text": "exactly one sentence per section"})
        self.assertEqual(self.job.result["patchProposal"]["patch"][0]["path"], "sentences.min")
        self.assertEqual(len(server.store.data["proposals"]), 1)

    def test_malformed_model_response_saves_no_patch_or_version(self):
        with patch.object(server.ollama, "interpret_feedback", return_value=("<html>rewrite prompt</html>", {})):
            result = self.post_feedback({"scope": "future", "text": "shorter please"})
        self.assertEqual(self.job.result["interpretation"]["kind"], "no_change")
        self.assertEqual(server.store.data["proposals"], [])
        self.assertEqual(len(server.store.versions_of(self.style["id"])), 1)

    def test_interpreter_inference_failure_returns_no_change_without_style_mutation(self):
        with patch.object(server.ollama, "interpret_feedback", side_effect=ollama.GenerationError("offline")):
            self.post_feedback({"scope": "future", "text": "one sentence per section"})
        self.assertEqual(self.job.result["interpretation"]["kind"], "no_change")
        self.assertEqual(len(server.store.versions_of(self.style["id"])), 1)
        self.assertEqual(server.store.style(self.style["id"])["activeVersionId"], None)


if __name__ == "__main__":
    unittest.main()
