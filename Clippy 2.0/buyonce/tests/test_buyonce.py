"""Unit tests. Run: python3 -m unittest discover -s tests -v   (standard library only)"""
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import compare  # noqa: E402
import core  # noqa: E402
import gate  # noqa: E402
import issue_card  # noqa: E402
import lint_skill  # noqa: E402

TODAY = core.parse_date("2026-10-25")
POLICY = core.load_policy(ROOT / "policy" / "policy.example.toml")
QUOTES = core.load_json(ROOT / "examples" / "quotes.flour.json")
CONTEXT = core.load_json(ROOT / "examples" / "context.example.json")
REQUEST = {"item": "bread flour 50lb", "qty": 10, "category": "supplies", "need_by": "2026-10-30"}


def run(policy=None, quotes=None, context=CONTEXT, request=REQUEST):
    return compare.evaluate(quotes or QUOTES, policy or POLICY, request, context, TODAY)


class TestCore(unittest.TestCase):
    def test_landed_cost_uses_price_break(self):
        cost = core.landed_cost(QUOTES[2])  # Harvest: break to 33.40 at qty 10
        self.assertEqual(cost["unit_price"], Decimal("33.40"))
        self.assertEqual(cost["subtotal"], Decimal("334.00"))
        self.assertEqual(cost["total"], Decimal("375.23"))

    def test_no_price_break_below_threshold(self):
        quote = dict(QUOTES[2], qty=5)
        self.assertEqual(core.landed_cost(quote)["unit_price"], Decimal("34.20"))

    def test_card_limit_rounds_up(self):
        self.assertEqual(core.card_limit("375.23", 5), Decimal("394.00"))
        self.assertEqual(core.card_limit("10.00", 5), Decimal("10.50"))


class TestCompare(unittest.TestCase):
    def test_cheapest_is_excluded_for_low_rating(self):
        result = run()
        self.assertEqual(result["cheapest_overall"]["vendor"], "BargainBarn")
        names = {o["vendor"]: o["excluded"] for o in result["excluded"]}
        self.assertIn("BargainBarn", names)
        self.assertTrue(any("rated 3.6" in r for r in names["BargainBarn"]))

    def test_deadline_excludes_slow_vendor(self):
        names = {o["vendor"]: o["excluded"] for o in run()["excluded"]}
        self.assertTrue(any("deadline" in r for r in names["NorthStar Foods"]))

    def test_winner_and_explanation(self):
        result = run()
        self.assertEqual(result["recommendation"]["vendor"], "Harvest Wholesale")
        text = " ".join(result["explanation"])
        self.assertIn("BargainBarn", text)
        self.assertIn("$38.02 less than SwiftSupply", text)

    def test_budget_and_new_vendor_flags(self):
        result = run()
        flags = " ".join(result["recommendation"]["flags"])
        self.assertIn("over your supplies budget by $55.23", flags)
        swift = next(o for o in result["eligible"] if o["vendor"] == "SwiftSupply")
        self.assertTrue(any("new vendor" in f for f in swift["flags"]))

    def test_inventory_cover_mentioned(self):
        self.assertIn("0.8 weeks of cover", " ".join(run()["explanation"]))

    def test_blocked_vendor_excluded(self):
        policy = core.with_defaults({**POLICY, "vendors": {**POLICY["vendors"], "blocked": ["Harvest Wholesale"]}})
        result = run(policy=policy)
        self.assertEqual(result["recommendation"]["vendor"], "SwiftSupply")

    def test_nothing_eligible(self):
        policy = core.with_defaults({**POLICY, "quality": {"min_rating": 5.0}})
        result = run(policy=policy)
        self.assertIsNone(result["recommendation"])
        self.assertIn("No quote meets your rules", result["explanation"][0])

    def test_out_of_stock_excluded(self):
        quotes = [dict(q) for q in QUOTES]
        quotes[2]["in_stock"] = False
        result = run(quotes=quotes)
        self.assertEqual(result["recommendation"]["vendor"], "SwiftSupply")

    def test_hard_cap(self):
        policy = core.with_defaults({**POLICY, "spending": {**POLICY["spending"], "hard_cap": 380.0}})
        result = run(policy=policy)
        self.assertEqual(result["recommendation"]["vendor"], "Harvest Wholesale")
        self.assertTrue(all(o["vendor"] != "SwiftSupply" for o in result["eligible"]))


class TestGate(unittest.TestCase):
    def test_default_policy_always_asks(self):
        decision = gate.decide(run(), POLICY)
        self.assertEqual(decision["decision"], "needs_approval")
        self.assertEqual(decision["card_limit"], "394.00")
        self.assertTrue(decision["order_id"].startswith("bo_"))

    def test_auto_approve_small_clean_order(self):
        quotes = [dict(QUOTES[2], qty=1, past_orders=14)]
        request = dict(REQUEST, qty=1, category=None)
        result = compare.evaluate(quotes, POLICY, request, {}, TODAY)
        policy = core.with_defaults({**POLICY, "spending": {**POLICY["spending"], "allow_auto_approve": True}})
        self.assertEqual(gate.decide(result, policy)["decision"], "auto")

    def test_auto_approve_still_asks_over_limit(self):
        policy = core.with_defaults({**POLICY, "spending": {**POLICY["spending"], "allow_auto_approve": True}})
        decision = gate.decide(run(), policy)
        self.assertEqual(decision["decision"], "needs_approval")
        self.assertTrue(any("auto-approve limit" in r for r in decision["reasons"]))

    def test_blocked_when_no_recommendation(self):
        policy = core.with_defaults({**POLICY, "quality": {"min_rating": 5.0}})
        self.assertEqual(gate.decide(run(policy=policy), policy)["decision"], "blocked")

    def test_card_text_and_audit(self):
        result = run()
        decision = gate.decide(result, POLICY)
        card = gate.approval_card(result, decision)
        self.assertIn("APPROVAL NEEDED", card)
        self.assertIn("Harvest Wholesale", card)
        self.assertIn("approve", card)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "audit.jsonl"
            gate.audit(path, "approved", decision, result["recommendation"])
            self.assertIn('"event": "approved"', path.read_text())

    def test_cli_exit_codes(self):
        import contextlib
        import io
        import json
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
            out = Path(tmp) / "result.json"
            audit = Path(tmp) / "audit.jsonl"
            code = compare.main(["--quotes", str(ROOT / "examples" / "quotes.flour.json"),
                                 "--policy", str(ROOT / "policy" / "policy.example.toml"),
                                 "--context", str(ROOT / "examples" / "context.example.json"),
                                 "--item", "bread flour 50lb", "--category", "supplies",
                                 "--need-by", "2026-10-30", "--today", "2026-10-25", "--out", str(out)])
            self.assertEqual(code, 0)
            self.assertTrue(json.loads(out.read_text())["recommendation"])
            gate_code = gate.main(["--result", str(out), "--policy",
                                   str(ROOT / "policy" / "policy.example.toml"), "--audit", str(audit)])
            self.assertEqual(gate_code, 10)


class TestCard(unittest.TestCase):
    def test_params(self):
        params = issue_card.build_params("394.00", "bo_123", "ich_1")
        self.assertEqual(params["spending_controls[spending_limits][0][amount]"], "39400")
        self.assertEqual(params["spending_controls[spending_limits][0][interval]"], "all_time")
        self.assertEqual(params["type"], "virtual")

    def test_rejects_non_positive(self):
        with self.assertRaises(ValueError):
            issue_card.build_params("0", "bo_1", "ich_1")

    def test_refuses_live_key(self):
        with self.assertRaises(SystemExit):
            issue_card.assert_test_key("sk_live_" + "x" * 24)
        with self.assertRaises(SystemExit):
            issue_card.assert_test_key(None)
        self.assertEqual(issue_card.assert_test_key("sk_test_abc"), "sk_test_abc")

    def test_dry_run_makes_no_network_call(self):
        original = issue_card.urllib.request.urlopen
        issue_card.urllib.request.urlopen = lambda *a, **k: self.fail("network call in dry run")
        try:
            self.assertEqual(issue_card.main(["--amount", "10", "--cardholder", "ich_1"]), 0)
            self.assertEqual(issue_card.main(["--cancel", "ic_1"]), 0)
        finally:
            issue_card.urllib.request.urlopen = original


class TestLint(unittest.TestCase):
    def test_repo_skills_pass(self):
        folders = lint_skill.collect(ROOT / "skills")
        self.assertGreaterEqual(len(folders), 3)
        for folder in folders:
            self.assertEqual(lint_skill.lint_skill(folder), [], folder.name)

    def _skill(self, tmp, name, text):
        folder = Path(tmp) / name
        folder.mkdir()
        (folder / "SKILL.md").write_text(text)
        return folder

    def test_catches_problems(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad_name = self._skill(tmp, "one", "---\nname: Two\ndescription: x\n---\nbody")
            self.assertTrue(any("kebab-case" in p for p in lint_skill.lint_skill(bad_name)))
            no_fm = self._skill(tmp, "two", "no frontmatter")
            self.assertTrue(any("frontmatter" in p for p in lint_skill.lint_skill(no_fm)))
            missing = self._skill(tmp, "three", "---\nname: three\ndescription: x\n---\n"
                                  "<!-- buyonce:purchasing-skill -->\n## Goal\nhi")
            self.assertTrue(any("missing section" in p for p in lint_skill.lint_skill(missing)))

    def test_catches_secrets(self):
        with tempfile.TemporaryDirectory() as tmp:
            text = ("---\nname: leaky\ndescription: x\n---\nuse card 4242 4242 4242 4242\n"
                    "key sk_test_" + "a" * 20 + "\npassword: hunter2\n")
            problems = lint_skill.lint_skill(self._skill(tmp, "leaky", text))
            self.assertTrue(any("card number" in p for p in problems))
            self.assertTrue(any("Stripe key" in p for p in problems))
            self.assertTrue(any("password" in p for p in problems))


if __name__ == "__main__":
    unittest.main()
