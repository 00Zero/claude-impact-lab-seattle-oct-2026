import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tests"))

import buyonce  # noqa: E402
import zinc  # noqa: E402
from test_zinc import FakeZinc  # noqa: E402

SKILL = str(ROOT / "skills" / "zinc-buy" / "SKILL.md")
QUOTES = str(ROOT / "examples" / "quotes.zinc-sandbox.json")
ADDR = str(ROOT / "examples" / "address.sandbox.json")
URL = "https://zinc.com/shop/products/test-success"
RESP = {"id": "z-1", "status": "order_placed", "merchant_order_ids": ["W1"],
        "job_result": {"price_components": {"total": 1475}}}


class TestOwnerCli(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        t = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        for name, val in (("ROOT", t), ("RUN", t / "run.json"), ("AUDIT", t / "audit.jsonl"), ("POLICY", t / "policy.toml")):
            p = mock.patch.object(buyonce, name, val); p.start(); self.addCleanup(p.stop)
        self.fake = FakeZinc(201, RESP)
        real = zinc.Zinc
        p = mock.patch.object(buyonce.zinc, "Zinc", lambda key, allow_live=False: real(key, allow_live, transport=self.fake))
        p.start(); self.addCleanup(p.stop)
        p = mock.patch.object(buyonce.zinc, "load_key", lambda root: "zn_test_k"); p.start(); self.addCleanup(p.stop)
        self.run_cli(["setup", "--name", "Test Shop", "--cap", "2000", "--block", "", "--auto-under", "0"])

    def run_cli(self, argv):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), mock.patch("sys.stdin", io.StringIO("")):
            code = buyonce.main(argv)
        return code, buf.getvalue()

    def buy(self, extra=()):
        return self.run_cli(["buy", "test product", "--skill", SKILL, "--quotes", QUOTES, "--vendor", "Zinc (sandbox)",
                             "--product-url", URL, "--address", ADDR, *extra])

    def test_setup_writes_valid_policy(self):
        self.assertIn("hard_cap = 2000.00", buyonce.POLICY.read_text())

    def test_buy_without_keyboard_waits_and_sends_nothing(self):
        code, out = self.buy()
        self.assertEqual(code, 10)
        self.assertIn("APPROVAL NEEDED", out)
        self.assertEqual(self.fake.calls, [])

    def test_approve_places_one_order_with_cap(self):
        self.buy()
        code, out = self.run_cli(["approve", "approve", "--product-url", URL, "--address", ADDR])
        self.assertEqual(code, 0, out)
        self.assertEqual(len(self.fake.calls), 1)
        self.assertEqual(self.fake.calls[0][3]["max_price"], 1575)
        self.assertTrue((buyonce.ROOT / "data" / "status.html").exists())
        code, out = self.run_cli(["status"])
        self.assertIn("done", out)

    def test_decline_buys_nothing(self):
        self.buy()
        code, out = self.run_cli(["decline", "no thanks"])
        self.assertEqual(code, 20)
        self.assertEqual(self.fake.calls, [])

    def test_unclear_reply_counts_as_no(self):
        self.buy()
        code, out = self.run_cli(["approve", "hmm maybe", "--product-url", URL, "--address", ADDR])
        self.assertEqual(code, 20)
        self.assertEqual(self.fake.calls, [])


if __name__ == "__main__":
    unittest.main()
