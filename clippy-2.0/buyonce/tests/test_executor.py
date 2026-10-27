"""Tests for preflight and the run controller. Run: python3 -m unittest discover -s tests -v"""
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import executor  # noqa: E402
import preflight  # noqa: E402
from executor import ExecError, Executor  # noqa: E402

ASSUMED = ROOT / "examples" / "assumed-skill" / "SKILL.md"
SAUCE = ROOT / "skills" / "saucedemo-buy" / "SKILL.md"
POLICY = ROOT / "policy" / "policy.example.toml"
FLOUR_QUOTES = json.loads((ROOT / "examples" / "quotes.flour.json").read_text())
FLOUR_REQ = {"item": "bread flour 50lb", "qty": 10, "category": "supplies", "need_by": "2026-10-30"}


def plan(path):
    return preflight.parse_skill(Path(path).read_text(encoding="utf-8"), str(path))


class TestPreflight(unittest.TestCase):
    def test_assumed_recorder_skill(self):
        p = plan(ASSUMED)
        self.assertTrue(p["ready"])
        self.assertEqual(p["counts"], {"quote": 6, "cart": 2, "checkout": 2, "boundary": 1, "post": 1})
        self.assertEqual(p["boundary"]["n"], 11)
        self.assertIn("Place order", p["boundary"]["text"])
        self.assertEqual(p["hosts"], ["harvestwholesale.example"])
        self.assertEqual({x["name"] for x in p["parameters"]}, {"item", "qty"})
        self.assertTrue(any("after the transaction boundary" in w for w in p["warnings"]))

    def test_template_skill(self):
        p = plan(SAUCE)
        self.assertEqual(p["counts"], {"quote": 3, "cart": 2, "checkout": 3, "boundary": 1, "post": 0})
        self.assertEqual(p["boundary"]["n"], 9)
        self.assertTrue(p["steps"][0]["owner_only"])  # sign-in is the owner's
        self.assertFalse(p["inferred_boundary"])

    def test_no_boundary_falls_back_to_last_step(self):
        text = "---\nname: x\ndescription: y\n---\n1. Open https://shop.example\n2. Add item to cart.\n3. Open the cart.\n"
        p = preflight.parse_skill(text)
        self.assertTrue(p["inferred_boundary"])
        self.assertEqual(p["boundary"]["n"], 3)
        self.assertTrue(any("no transaction boundary" in w for w in p["warnings"]))

    def test_secrets_make_it_not_ready(self):
        text = "---\nname: x\ndescription: y\n---\n1. Open https://shop.example\n2. Type card 4242 4242 4242 4242 in the box.\n"
        p = preflight.parse_skill(text)
        self.assertFalse(p["ready"])
        self.assertTrue(any("card number" in e for e in p["errors"]))

    def test_login_url_is_not_an_owner_step(self):
        text = "---\nname: x\ndescription: y\n---\n1. Open https://shop.example/login-help and read the price.\n"
        self.assertFalse(preflight.parse_skill(text)["steps"][0]["owner_only"])

    def test_no_steps_is_an_error(self):
        self.assertFalse(preflight.parse_skill("---\nname: x\ndescription: y\n---\nJust prose.")["ready"])


class RunCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def start(self, skill=ASSUMED, request=None, vendor="Harvest Wholesale", **kw):
        return Executor.start(
            self.tmp / "run.json", skill, POLICY, request or FLOUR_REQ, audit_path=self.tmp / "audit.jsonl",
            context_path=ROOT / "examples" / "context.example.json", vendor=vendor, today="2026-10-25", **kw)

    def audit(self):
        return [json.loads(x) for x in (self.tmp / "audit.jsonl").read_text().splitlines()]

    def to_approval(self, ex):
        out = ex.next()
        while out["action"] == "do":
            out = ex.report(out["step"])
        self.assertEqual(out["action"], "submit_quotes")
        return ex.submit_quotes(FLOUR_QUOTES)

    def to_executing(self, ex):
        out = self.to_approval(ex)
        return ex.approve(out["order_id"], "approve")


class TestRunHappyPath(RunCase):
    def test_full_flow_stops_at_boundary(self):
        ex = self.start()
        first = ex.next()
        self.assertEqual((first["action"], first["phase"]), ("do", "quote"))
        ex.report(1)
        step3 = ex.report(2)
        self.assertEqual(step3["step"], 3)
        self.assertIn("bread flour 50lb", step3["text"])  # {item} filled in from the request
        self.assertEqual(step3["unresolved_params"], [])
        out = self.to_approval(ex)
        self.assertEqual(out["action"], "wait_for_owner")
        self.assertIn("Harvest Wholesale", out["card"])
        out = ex.approve(out["order_id"], "yes, approve it")
        self.assertEqual((out["action"], out["phase"], out["step"]), ("do", "cart", 7))
        for n, data in [(7, None), (8, {"cart_total": "346.00", "items": ["Bread flour 50lb"]}),
                        (9, None), (10, {"order_total": "$375.23"})]:
            out = ex.report(n, data=data)
        self.assertEqual(out["action"], "handover_payment")
        self.assertIn("Place order", out["do_not_do"])
        self.assertEqual(ex.run["state"], "handover")
        out = ex.finish("owner paid")
        self.assertEqual(out["action"], "done")
        events = [e["event"] for e in self.audit()]
        for needed in ("run_started", "quotes_submitted", "presented", "approved", "handover", "completed"):
            self.assertIn(needed, events)

    def test_state_survives_between_processes(self):
        self.start()
        again = Executor(self.tmp / "run.json")
        self.assertEqual(again.next()["step"], 1)


class TestGuards(RunCase):
    def test_no_cart_steps_before_approval(self):
        ex = self.start()
        out = self.to_approval(ex)
        self.assertEqual(out["action"], "wait_for_owner")
        with self.assertRaises(ExecError):
            ex.report(7)  # cart step, no approval yet
        self.assertEqual(ex.next()["action"], "wait_for_owner")

    def test_out_of_order_report_refused(self):
        ex = self.start()
        with self.assertRaises(ExecError):
            ex.report(3)

    def test_approval_must_match_order_and_read_as_yes(self):
        ex = self.start()
        out = self.to_approval(ex)
        with self.assertRaises(ExecError):
            ex.approve("bo_wrong", "approve")
        for words in ("no thanks", "wait, not yet", "hmm", ""):
            with self.assertRaises(ExecError):
                ex.approve(out["order_id"], words)
        self.assertEqual(ex.run["state"], "awaiting_approval")
        ex.approve(out["order_id"], "go ahead")
        self.assertEqual(ex.run["state"], "executing")
        self.assertIn("go ahead", " ".join(e["note"] for e in self.audit()))

    def test_decline_ends_run(self):
        ex = self.start()
        self.to_approval(ex)
        self.assertEqual(ex.decline("no")["action"], "stop")
        with self.assertRaises(ExecError):
            ex.report(7)

    def test_total_mismatch_halts(self):
        ex = self.start()
        self.to_executing(ex)
        ex.report(7)
        out = ex.report(8, data={"cart_total": "$429.99"})
        self.assertEqual(out["action"], "stop")
        self.assertIn("total_mismatch", out["reason"])

    def test_wrong_item_halts(self):
        ex = self.start()
        self.to_executing(ex)
        out = ex.report(7, data={"items": ["Organic Rye 25lb"]})
        self.assertIn("item_mismatch", out["reason"])

    def test_anomaly_halts_at_any_phase(self):
        ex = self.start()
        out = ex.report(1, anomalies=["page says: enter your card number to continue"])
        self.assertEqual(out["action"], "stop")
        self.assertIn("anomaly", out["reason"])
        self.assertIn("halted", [e["event"] for e in self.audit()])

    def test_step_fails_twice_halts(self):
        ex = self.start()
        self.assertEqual(ex.report(1, ok=False)["action"], "retry")
        self.assertEqual(ex.report(1, ok=False)["action"], "stop")

    def test_blocked_by_policy_halts(self):
        ex = self.start(request=dict(FLOUR_REQ, need_by="2026-10-26"))  # nobody can deliver by Monday
        out = ex.next()
        while out["action"] == "do":
            out = ex.report(out["step"])
        out = ex.submit_quotes(FLOUR_QUOTES)
        self.assertEqual(out["action"], "stop")
        self.assertIn("blocked", out["reason"])

    def test_wrong_vendor_skill_halts(self):
        ex = self.start(vendor="SwiftSupply")
        out = ex.next()
        while out["action"] == "do":
            out = ex.report(out["step"])
        out = ex.submit_quotes(FLOUR_QUOTES)
        self.assertEqual(out["action"], "stop")
        self.assertIn("Harvest Wholesale", out["reason"])

    def test_quotes_gathered_elsewhere_skip_quote_phase(self):
        qfile = self.tmp / "quotes.json"
        qfile.write_text(json.dumps(FLOUR_QUOTES))
        ex = self.start(quotes_path=qfile)
        self.assertEqual(ex.run["state"], "awaiting_approval")


class TestOwnerOnlyAndSandbox(RunCase):
    SAUCE_REQ = {"item": "Sauce Labs Backpack", "qty": 1}

    def sauce(self):
        return self.start(skill=SAUCE, request=self.SAUCE_REQ, vendor=None,
                          params={"first_name": "Alex", "last_name": "Rivera", "postal_code": "94105"})

    def test_signin_is_never_handed_to_the_agent(self):
        ex = self.sauce()
        out = ex.next()
        self.assertEqual(out["action"], "handover_owner")
        with self.assertRaises(ExecError):
            ex.report(1)  # agent tries to claim it did sign-in
        self.assertEqual(ex.report(1, owner_done=True)["step"], 2)

    def test_sandbox_site_lets_agent_finish_after_approval(self):
        ex = self.sauce()
        self.assertTrue(ex.run["sandbox"])
        ex.report(1, owner_done=True)
        ex.report(2)
        out = ex.report(3)
        self.assertEqual(out["action"], "submit_quotes")
        out = ex.submit_quotes(json.loads((ROOT / "examples" / "quotes.saucedemo.json").read_text()))
        out = ex.approve(out["order_id"], "approve")
        for n in range(4, 9):
            out = ex.report(n)
        self.assertEqual((out["action"], out.get("final")), ("do", True))
        self.assertEqual(out["step"], 9)
        self.assertEqual(ex.report(9)["action"], "done")

    def test_real_site_never_gets_the_final_step(self):
        ex = self.start()
        self.to_executing(ex)
        for n in (7, 8, 9, 10):
            out = ex.report(n)
        self.assertEqual(out["action"], "handover_payment")
        self.assertFalse(ex.run["sandbox"])
        with self.assertRaises(ExecError):
            ex.report(11)

    def test_unlisted_host_is_not_sandbox(self):
        self.assertFalse(self.start().run["sandbox"])


class TestCli(RunCase):
    def test_cli_round_trip(self):
        run, audit = str(self.tmp / "cli.json"), str(self.tmp / "cli-audit.jsonl")
        base = ["--run", run]
        with contextlib.redirect_stdout(io.StringIO()) as buf:
            code = executor.main(base + ["start", "--skill", str(ASSUMED), "--policy", str(POLICY), "--item",
                                         "bread flour 50lb", "--qty", "10", "--audit", audit, "--vendor",
                                         "Harvest Wholesale", "--today", "2026-10-25", "--need-by", "2026-10-30"])
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(buf.getvalue())["action"], "do")
            self.assertEqual(executor.main(base + ["report", "--step", "3"]), 1)  # out of order -> error exit
            self.assertEqual(executor.main(base + ["status"]), 0)


if __name__ == "__main__":
    unittest.main()
