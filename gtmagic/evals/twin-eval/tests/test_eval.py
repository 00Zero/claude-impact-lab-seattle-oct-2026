"""python3 -m unittest discover -s tests   (from twin-eval/; no API key or network needed)"""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from twin_eval import metrics, realism, report  # noqa: E402
from twin_eval.__main__ import main  # noqa: E402
from twin_eval.data import load, sample_pids  # noqa: E402
from twin_eval.personas import ARMS, persona_card, user_prompt  # noqa: E402
from twin_eval.tasks import (EXPERIMENTS, PRICING_COLUMNS, encode_label,  # noqa: E402
                             encode_model_value, experiment_questions)

FIXTURES = ROOT / "tests" / "fixtures"
RUN_INFO = {"mock": True, "model": "mock", "effort": "low", "seed": 1, "promptVersion": "test",
            "datasetRevision": "0123456789abcdef", "finishedAt": "now"}


class TestEncoding(unittest.TestCase):
    def setUp(self):
        self.ds = load(FIXTURES)

    def test_choice_labels_map_to_option_index(self):
        q = self.ds.questions["QID157"]
        self.assertEqual(encode_label(q, "I strongly favor program A"), 0.0)
        self.assertEqual(encode_label(q, "I strongly favor program B"), 5.0)
        self.assertIsNone(encode_label(q, "something else"))

    def test_number_answers(self):
        q = self.ds.questions["QID164_TEXT"]
        self.assertEqual(encode_label(q, "1,000"), 1000.0)
        self.assertEqual(encode_model_value(q, 54), 54.0)

    def test_model_option_numbers_are_one_based_and_checked(self):
        q = self.ds.questions["QID183"]
        self.assertEqual(encode_model_value(q, 1), 0.0)
        self.assertIsNone(encode_model_value(q, 3))
        self.assertIsNone(encode_model_value(q, 1.5))

    def test_every_fixture_answer_encodes(self):
        cols = PRICING_COLUMNS + [c for e in EXPERIMENTS for cond in e.conditions for c in cond.columns]
        for r in self.ds.respondents.values():
            for col in cols:
                for label in (r.wave1_3.get(col), r.wave4.get(col)):
                    if label:
                        self.assertIsNotNone(encode_label(self.ds.questions[col], label), (col, label))


class TestPrompts(unittest.TestCase):
    def setUp(self):
        self.ds = load(FIXTURES)
        self.r = self.ds.respondents[sorted(self.ds.respondents)[0]]

    def test_each_person_sees_only_their_twins_versions(self):
        cols = {q.column for q in experiment_questions(self.ds, self.r)}
        for e in EXPERIMENTS:
            seen = [c for c in e.conditions if c.score_column in cols]
            self.assertLessEqual(len(seen), 1, e.key)

    def test_vanilla_card_reveals_nothing_about_the_twin(self):
        card = persona_card("vanilla", self.ds, self.r, {})
        for _, answer in self.r.demographics:
            self.assertNotIn(answer, card)

    def test_prompt_shows_ids_not_condition_names(self):
        text = user_prompt(persona_card("demographics", self.ds, self.r, {}), experiment_questions(self.ds, self.r))
        self.assertNotIn("Anchoring", text)
        self.assertNotIn("Sunk cost", text)


def _oracle(ds, pids, wave):
    """Records that answer exactly what the twin said in the given wave."""
    recs = {}
    for p in pids:
        r = ds.respondents[p]
        source = r.wave4 if wave == "wave4" else r.wave1_3
        answers = {}
        for col in PRICING_COLUMNS + [c.score_column for e in EXPERIMENTS for c in e.conditions]:
            v = encode_label(ds.questions[col], source.get(col, ""))
            if v is not None and r.wave4.get(col):
                answers[col] = v
        recs[p] = {"answers": answers}
    return recs


class TestScoring(unittest.TestCase):
    def setUp(self):
        self.ds = load(FIXTURES)
        self.pids = sample_pids(self.ds, 1000, 7, PRICING_COLUMNS)

    def test_perfect_responder_scores_perfectly(self):
        recs = _oracle(self.ds, self.pids, "wave4")
        p = metrics.pricing(self.ds, self.pids, recs, 1)
        self.assertEqual(p["individual"]["rate"], 1.0)
        self.assertAlmostEqual(p["productBuyShare"]["meanAbsError"], 0.0)
        f = metrics.framing(self.ds, self.pids, recs)
        self.assertEqual(f["directionMatches"], f["directionCallable"])
        self.assertGreater(f["directionCallable"], 0)
        self.assertEqual(realism.framing_individual(self.ds, self.pids, recs, 1)["rate"], 1.0)
        self.assertAlmostEqual(realism.spread(self.ds, self.pids, recs)["medianRatio"], 1.0)

    def test_retest_ceiling_equals_scoring_last_waves_answers(self):
        recs = _oracle(self.ds, self.pids, "wave1_3")
        ceiling = metrics.references(self.ds, self.pids, PRICING_COLUMNS, 1)["retest_ceiling"]
        self.assertEqual(metrics.pricing(self.ds, self.pids, recs, 1)["individual"]["rate"], ceiling["rate"])
        self.assertLess(ceiling["rate"], 1.0)

    def test_one_answer_for_everyone_has_zero_spread(self):
        recs = {p: {"answers": {c: 0.0 for c in PRICING_COLUMNS}} for p in self.pids}
        self.assertEqual(realism.spread(self.ds, self.pids, recs)["medianRatio"], 0.0)

    def test_product_nobody_answered_is_left_out_not_scored_zero(self):
        recs = _oracle(self.ds, self.pids, "wave4")
        for rec in recs.values():
            rec["answers"].pop(PRICING_COLUMNS[0])
        b = metrics.pricing(self.ds, self.pids, recs, 1)["productBuyShare"]
        self.assertEqual(b["products"], len(PRICING_COLUMNS) - 1)
        self.assertAlmostEqual(b["correlation"], 1.0)
        self.assertAlmostEqual(b["meanAbsError"], 0.0)

    def test_arm_with_no_answers_reports_na_not_zero_percent(self):
        b = metrics.pricing(self.ds, self.pids, {}, 1)["productBuyShare"]
        self.assertEqual(b, {"products": 0, "meanAbsError": None, "correlation": None,
                             "simulatedOverall": None, "humanOverall": None})
        md = report.render(report.build(self.ds, self.pids, {"vanilla": {}}, RUN_INFO, 1))
        self.assertIn("| Plain Claude, no persona | n/a | n/a | n/a | n/a | n/a / n/a |", md)

    def test_framing_table_joins_contrasts_by_identity_not_position(self):
        full = _oracle(self.ds, self.pids, "wave4")
        partial = copy.deepcopy(full)
        for rec in partial.values():
            rec["answers"].pop("QID172", None)   # this arm has no "or lose 5 cents" answers
        rep = report.build(self.ds, self.pids, {"vanilla": full, "voice": partial}, RUN_INFO, 1)
        rows = {}
        for line in report._framing_table(rep):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if cells[0] == "Gamble with nothing vs. a small loss":
                rows[cells[1]] = cells
        five = rows["or lose 5 cents vs win $9 or nothing"]
        quarter = rows["or lose 25 cents vs win $9 or nothing"]
        self.assertNotEqual(five[3], "n/a")
        self.assertEqual(five[4], "n/a")
        self.assertEqual(quarter[4], quarter[3])   # same answers there, so the same simulated effect


class TestMockRun(unittest.TestCase):
    def test_end_to_end_and_resume(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "run"
            args = ["run", "--mock", "--data", str(FIXTURES), "--n", "30", "--out", str(out), "--concurrency", "1"]
            with _quiet():
                main(args)
            rep = json.loads((out / "report.json").read_text())
            self.assertTrue(rep["run"]["mock"])
            self.assertEqual(set(rep["arms"]), set(ARMS))
            self.assertEqual(rep["arms"]["vanilla"]["answered"], 30)
            self.assertIn("FAKE RUN", (out / "report.md").read_text())
            self.assertEqual(rep["arms"]["invented"]["inventedPersonas"]["people"], 30)
            lines = (out / "responses-voice.jsonl").read_text().splitlines()
            with _quiet():
                main(args)   # second run resumes: no new calls
            self.assertEqual(lines, (out / "responses-voice.jsonl").read_text().splitlines())


class _quiet:
    def __enter__(self):
        import io
        self._old, sys.stdout = sys.stdout, io.StringIO()
        self._buf = sys.stdout
        return self

    def __exit__(self, *exc):
        sys.stdout = self._old

    def text(self) -> str:
        return self._buf.getvalue()


if __name__ == "__main__":
    unittest.main()
