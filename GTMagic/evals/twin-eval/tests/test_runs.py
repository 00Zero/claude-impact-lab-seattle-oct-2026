"""Resume, crash recovery and skipped-call bookkeeping (no API key or network needed)."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from twin_eval.__main__ import main  # noqa: E402
from twin_eval.data import load  # noqa: E402
from twin_eval.personas import system_prompt  # noqa: E402
from twin_eval.simulate import CallFailed, ClaudeClient, _one  # noqa: E402
from twin_eval.tasks import PRICING_COLUMNS  # noqa: E402
from test_eval import FIXTURES, _quiet  # noqa: E402


def _run(out: Path, *extra: str) -> str:
    with _quiet() as q:
        main(["run", "--mock", "--data", str(FIXTURES), "--out", str(out), "--concurrency", "1", *extra])
    return q.text()


def _report(out: Path) -> dict:
    with _quiet():
        main(["report", "--data", str(FIXTURES), "--out", str(out)])
    return json.loads((out / "report.json").read_text())


class TestResume(unittest.TestCase):
    def test_report_scores_the_saved_runs_people(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "run"
            _run(out, "--n", "20", "--arms", "vanilla")
            rep = _report(out)   # no --n/--seed: must not fall back to 200 / 7
            self.assertEqual(rep["people"], 20)
            self.assertEqual((rep["arms"]["vanilla"]["answered"], rep["arms"]["vanilla"]["skipped"]), (20, 0))

    def test_new_arms_resume_but_changed_card_or_prompt_do_not(self):
        with tempfile.TemporaryDirectory() as tmp:
            out, card = Path(tmp) / "run", Path(tmp) / "card.py"
            card.write_text("def render_card(customer, intake):\n    return 'CARD ' + customer['id']\n")
            _run(out, "--n", "10", "--arms", "vanilla")
            _run(out, "--n", "10", "--arms", "vanilla,gtmagic", "--card-module", str(card))   # adding an arm is fine
            self.assertTrue(json.loads((out / "run.json").read_text())["cardFingerprint"].startswith("sha256:"))
            card.write_text(card.read_text() + "# edited\n")
            with self.assertRaises(SystemExit) as e:
                _run(out, "--n", "10", "--arms", "gtmagic", "--card-module", str(card))
            self.assertIn("cardRenderer", str(e.exception.code))
            meta = json.loads((out / "run.json").read_text())
            (out / "run.json").write_text(json.dumps({**meta, "promptVersion": "twin-eval-0"}))
            with self.assertRaises(SystemExit) as e:
                _run(out, "--n", "10", "--arms", "vanilla")
            self.assertIn("promptVersion", str(e.exception.code))

    def test_half_written_line_is_skipped_then_rerun(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "run"
            _run(out, "--n", "10", "--arms", "vanilla")
            path = out / "responses-vanilla.jsonl"
            lines = path.read_text().splitlines()
            path.write_text("\n".join(lines[:-1]) + "\n" + lines[-1][:40])   # crashed mid-write
            with _quiet() as q:
                main(["report", "--data", str(FIXTURES), "--out", str(out)])
            self.assertIn("unreadable line", q.text())
            self.assertEqual(json.loads((out / "report.json").read_text())["arms"]["vanilla"]["answered"], 9)
            _run(out, "--n", "10", "--arms", "vanilla")   # resume re-runs the lost person on a fresh line
            self.assertEqual(json.loads((out / "report.json").read_text())["arms"]["vanilla"]["answered"], 10)
            saved = path.read_text().splitlines()
            self.assertEqual(len(saved), len(lines) + 1)
            self.assertEqual(json.loads(saved[-1])["status"], "answered")


class _Client:
    model = "fake"

    def __init__(self, result):
        self.result = result

    def json_call(self, system, user, schema, cache_system):
        if isinstance(self.result, Exception):
            raise self.result
        return self.result, {"input": 10, "output": 2, "cache_read": 0, "cache_write": 0}


class TestCalls(unittest.TestCase):
    def setUp(self):
        self.ds = load(FIXTURES)
        self.r = self.ds.respondents[sorted(self.ds.respondents)[0]]
        self.system = system_prompt(self.ds)

    def _call(self, result) -> dict:
        return _one(self.ds, _Client(result), "vanilla", self.r, self.system)

    def test_failed_call_keeps_its_billed_tokens(self):
        usage = {"input": 900, "output": 16000, "cache_read": 5, "cache_write": 0}
        rec = self._call(CallFailed("max-tokens", usage))
        self.assertEqual((rec["status"], rec["skipReason"], rec["usage"]), ("skipped", "max-tokens", usage))

    def test_claude_client_reads_usage_before_failing(self):
        for stop, text, reason in (("refusal", "", "refusal"), ("max_tokens", "{", "max-tokens"),
                                   ("end_turn", "{not json", "invalid-json")):
            response = SimpleNamespace(
                stop_reason=stop, content=[SimpleNamespace(type="text", text=text)],
                usage=SimpleNamespace(input_tokens=100, output_tokens=7,
                                      cache_read_input_tokens=None, cache_creation_input_tokens=50))
            client = ClaudeClient.__new__(ClaudeClient)   # skip __init__: no SDK or key needed
            client.anthropic, client.model, client.effort = SimpleNamespace(), "claude-haiku-5-5", "low"
            client.client = SimpleNamespace(messages=SimpleNamespace(create=lambda _r=response, **kw: _r))
            with self.assertRaises(CallFailed) as e:
                client.json_call("system", "user", {}, cache_system=True)
            self.assertEqual(e.exception.reason, reason)
            self.assertEqual(e.exception.usage, {"input": 100, "output": 7, "cache_read": 0, "cache_write": 50})

    def test_mostly_unanswered_response_is_skipped_as_incomplete(self):
        for data in ({"answers": []}, {"answers": [{"id": c, "value": 99} for c in PRICING_COLUMNS]}):
            rec = self._call(data)
            self.assertEqual((rec["status"], rec["skipReason"]), ("skipped", "incomplete"))
            self.assertEqual(rec["answers"], {})   # kept for debugging
            self.assertEqual(rec["usage"]["input"], 10)

    def test_mostly_complete_response_is_still_answered(self):
        rec = self._call({"answers": [{"id": c, "value": 1} for c in PRICING_COLUMNS[:20]]})   # exactly half
        self.assertEqual(rec["status"], "answered")
        self.assertEqual(len(rec["answers"]), 20)


if __name__ == "__main__":
    unittest.main()
