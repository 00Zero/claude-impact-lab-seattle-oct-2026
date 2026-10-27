"""The runner on its own: per-call reservations, abort precedence, and a failed write."""
from __future__ import annotations

import json
import threading
import time
import unittest

import helpers  # noqa: F401
from claude_client import CallFailed, Reply
from design import Call
from runner import Ledger, run_calls

USAGE = {"input_tokens": 10, "output_tokens": 10}


def calls(n: int) -> list[Call]:
    return [Call(f"crowd-c_{i:03d}", "crowd", ["x", "y"], i % 2) for i in range(1, n + 1)]


def good(call: Call) -> Reply:
    return Reply(text=json.dumps({"ratings": {"A": 3, "B": 4}, "pick": "A", "reason": ""}), stop_reason="end_turn",
                 usage=USAGE)


class RunnerTest(unittest.TestCase):
    def test_a_cap_equal_to_the_sum_of_ceilings_never_cuts(self) -> None:
        plan = calls(6)
        worst = {c.id: 0.001 * (i + 1) for i, c in enumerate(plan)}  # uneven ceilings
        ledger = Ledger(sum(worst.values()), worst)
        for c in plan:  # even if every call spends its full ceiling, every call is admitted
            self.assertTrue(ledger.reserve(c.id))
        for c in plan:
            ledger.settle(c.id, worst[c.id])
        self.assertAlmostEqual(ledger.spent, sum(worst.values()))

    def test_every_settlement_fits_its_reservation(self) -> None:
        import cost
        self.assertEqual(cost.ATTEMPTS, 2)
        plan = calls(4)
        ledger = Ledger(10.0, {c.id: 0.01 for c in plan})

        def lost_then_ok(call: Call) -> Reply:
            reply = good(call)
            reply.earlier_attempt_unknown = True  # first attempt timed out; the retry answered
            return reply

        run_calls(plan, lost_then_ok, {}, ledger, lambda r: None, workers=2)
        self.assertLessEqual(ledger.spent, sum(ledger.worst.values()))
        self.assertEqual(ledger.held, 0)

    def test_abort_while_waiting_beats_the_cap(self) -> None:
        plan = calls(6)
        ledger = Ledger(1.5, {c.id: 1.0 for c in plan})  # room for one call at a time

        def send(call: Call) -> Reply:
            time.sleep(0.05)  # the dispatcher is waiting on this call when it fails
            raise CallFailed("api-error", "HTTP 400: bad", fatal=True)

        records, why = run_calls(plan, send, {}, ledger, lambda r: None, workers=2)
        reasons = [r["skipReason"] for r in records]
        self.assertIsNotNone(why)
        self.assertEqual(reasons.count("api-error"), 1)
        self.assertEqual(reasons.count("aborted"), 5)
        self.assertNotIn("budget", reasons)
        self.assertEqual(ledger.held, 0)

    def test_a_failed_write_stops_the_run_but_keeps_every_record(self) -> None:
        plan = calls(8)
        written = []
        lock = threading.Lock()

        def on_record(r: dict) -> None:
            with lock:
                if len(written) == 2:
                    raise OSError("disk full")
                written.append(r)

        records, why = run_calls(plan, good, {}, Ledger(None, {c.id: 0.0 for c in plan}), on_record, workers=1)
        self.assertEqual(len(records), 8)
        self.assertIn("disk full", why)
        self.assertEqual([r["status"] for r in records].count("answered"), 3)


if __name__ == "__main__":
    unittest.main()
