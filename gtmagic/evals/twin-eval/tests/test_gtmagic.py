"""The gtmagic arm and export follow GTMagic's contracts (docs/CONTRACTS.md, gtm-intake schema)."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from twin_eval import gtmagic  # noqa: E402
from twin_eval.__main__ import main  # noqa: E402
from twin_eval.data import load, sample_pids  # noqa: E402
from twin_eval.tasks import PRICING_COLUMNS  # noqa: E402
from test_eval import FIXTURES, _quiet  # noqa: E402

CUSTOMER_KEYS = {"id", "segmentId", "attributes", "needs", "barriers", "decisionCriteria", "voiceLexiconIds"}
CORE_ATTRIBUTES = {"role", "currentSolution", "priceSensitivity", "urgency", "skepticism", "buyingStage"}


class TestShapes(unittest.TestCase):
    def setUp(self):
        self.ds = load(FIXTURES)
        self.pids = sample_pids(self.ds, 1000, 7, PRICING_COLUMNS)
        self.files = gtmagic.build(self.ds, self.pids)

    def test_customers_match_synthetic_customer(self):
        seg_ids = {s["id"] for s in self.files["segments"]}
        lex_ids = {lx["id"] for lx in self.files["lexicon"]}
        self.assertEqual(len(self.files["customers"]), len(self.pids))
        for c in self.files["customers"]:
            self.assertEqual(set(c), CUSTOMER_KEYS)
            self.assertRegex(c["id"], r"^cust_r1_\d+$")
            self.assertIn(c["segmentId"], seg_ids)
            self.assertLessEqual(set(c["attributes"]), CORE_ATTRIBUTES)
            self.assertLessEqual(len(c["voiceLexiconIds"]), 5)
            self.assertLessEqual(set(c["voiceLexiconIds"]), lex_ids)

    def test_quotes_follow_intake_lexicon_rules(self):
        evidence = {e["id"]: e for e in self.files["evidence"]}
        for lx in self.files["lexicon"]:
            excerpt = evidence[lx["evidenceId"]]["excerpt"]
            self.assertIn(lx["phrase"], excerpt)
            self.assertGreaterEqual(len(lx["phrase"].split()), 3)
            self.assertLessEqual(len(excerpt.split()), 25)
            twin_text = " ".join(self.ds.respondents[self.files["twinMap"][self._owner(lx["id"])]]
                                 .wave1_3["QID270_TEXT"].split())
            self.assertIn(lx["phrase"], twin_text)   # verbatim from that twin

    def _owner(self, lex_id):
        return next(c["id"] for c in self.files["customers"] if lex_id in c["voiceLexiconIds"])

    def test_card_has_no_demographics(self):
        cards = gtmagic.Cards(self.ds, self.pids, gtmagic.default_render_card)
        r = self.ds.respondents[self.pids[0]]
        card = cards.card(r.pid)
        self.assertIn("Customer group:", card)
        for question in ("QID12", "QID15", "QID18"):   # sex, race, religion
            self.assertNotIn(f": {r.wave1_3[question]}\n", card + "\n")


class TestIntegration(unittest.TestCase):
    def test_export_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            with _quiet():
                main(["export-audience", "--data", str(FIXTURES), "--n", "20", "--out", tmp])
            audience = json.loads((Path(tmp) / "audience-sample.json").read_text())
            intake = json.loads((Path(tmp) / "twin-intake.json").read_text())
            self.assertEqual(audience["schemaVersion"], 1)
            self.assertEqual(set(audience) - {"schemaVersion", "_note"}, {"config", "samplerVersion", "role", "customers"})
            self.assertEqual(audience["config"]["sampleSize"], 20)
            self.assertAlmostEqual(sum(s["sampleShare"] for s in intake["segments"]), 1.0)

    def test_teammate_card_renderer_plugs_in(self):
        with tempfile.TemporaryDirectory() as tmp:
            module = Path(tmp) / "card.py"
            module.write_text("def render_card(customer, intake):\n    return 'CUSTOM CARD ' + customer['id']\n")
            out = Path(tmp) / "run"
            with _quiet():
                main(["run", "--mock", "--data", str(FIXTURES), "--n", "10", "--arms", "gtmagic",
                      "--out", str(out), "--concurrency", "1", "--card-module", str(module)])
            rep = json.loads((out / "report.json").read_text())
            self.assertEqual(rep["arms"]["gtmagic"]["answered"], 10)
            self.assertEqual(rep["run"]["cardRenderer"], str(module))
            self.assertEqual(rep["_note"][:4], "FAKE")


if __name__ == "__main__":
    unittest.main()
