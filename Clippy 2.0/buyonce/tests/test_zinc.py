import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tests"))

import api_order  # noqa: E402
import zinc  # noqa: E402
from executor import ExecError  # noqa: E402
from test_executor import RunCase  # noqa: E402


class FakeZinc:
    """Stands in for the network. Records every request."""
    def __init__(self, status=200, payload=None):
        self.calls, self.status = [], status
        self.payload = payload or {"id": "ord_123", "status": "order_placed"}

    def __call__(self, method, url, headers, body):
        self.calls.append((method, url, headers, body))
        return self.status, self.payload


class TestClient(unittest.TestCase):
    def test_live_key_refused_by_default(self):
        with self.assertRaises(zinc.ZincError):
            zinc.Zinc("zn_live_abc")
        self.assertTrue(zinc.Zinc("zn_live_abc", allow_live=True).live)

    def test_order_body_and_auth(self):
        fake = FakeZinc()
        c = zinc.Zinc("zn_test_k", transport=fake)
        c.create_order("https://zinc.com/shop/products/test-success", 2, {"country": "US"}, 3401, "bo_x")
        method, url, headers, body = fake.calls[0]
        self.assertEqual((method, url), ("POST", "https://api.zinc.com/orders"))
        self.assertEqual(headers["Authorization"], "Bearer zn_test_k")
        self.assertEqual(body["max_price"], 3401)
        self.assertEqual(body["idempotency_key"], "bo_x")
        self.assertEqual(body["products"], [{"url": "https://zinc.com/shop/products/test-success", "quantity": 2}])

    def test_error_status_raises(self):
        c = zinc.Zinc("zn_test_k", transport=FakeZinc(402, {"message": "price above max_price"}))
        with self.assertRaises(zinc.ZincError):
            c.create_order("u", 1, {}, 100, "k")

    def test_mint(self):
        fake = FakeZinc(200, {"api_key": "zn_test_new", "claim_url": "https://c"})
        out = zinc.mint_key(email="a@b.c", transport=fake)
        self.assertEqual(out["api_key"], "zn_test_new")
        self.assertEqual(fake.calls[0][1], "https://api.zinc.com/sandbox/keys")

    def test_cents(self):
        self.assertEqual(api_order.cents("34.01"), 3401)
        self.assertEqual(api_order.cents("0.10"), 10)


class TestApiExecution(RunCase):
    def place_fn(self, fake):
        client = zinc.Zinc("zn_test_k", transport=fake)

        def place(order_id, card_limit):
            o = client.create_order("https://zinc.com/shop/products/test-success", 1, {}, api_order.cents(card_limit), order_id)
            return {"order_id": o["id"], "status": o["status"], "total": None}
        return place

    def test_refused_before_approval(self):
        ex = self.start()
        self.to_approval(ex)
        fake = FakeZinc()
        with self.assertRaises(ExecError):
            ex.execute_via_api(self.place_fn(fake))
        self.assertEqual(fake.calls, [])

    def test_places_after_approval_with_cap_and_idempotency(self):
        ex = self.start()
        self.to_executing(ex)
        fake = FakeZinc()
        out = ex.execute_via_api(self.place_fn(fake))
        self.assertEqual(out["state"], "done")
        body = fake.calls[0][3]
        self.assertEqual(body["idempotency_key"], ex.run["order_id"])
        self.assertEqual(body["max_price"], api_order.cents(ex.run["card_limit"]))
        events = [e["event"] for e in ex.run["log"]]
        self.assertIn("api_order_requested", events)
        self.assertEqual(events[-1], "completed")

    def test_api_failure_halts_and_buys_nothing(self):
        ex = self.start()
        self.to_executing(ex)
        out = ex.execute_via_api(self.place_fn(FakeZinc(402, {"message": "price above max_price"})))
        self.assertEqual(out["state"], "halted")
        self.assertIn("api order failed", ex.run["halt"])

    def test_total_above_limit_halts(self):
        ex = self.start()
        self.to_executing(ex)
        out = ex.execute_via_api(lambda oid, lim: {"order_id": "o1", "status": "placed", "total": "9999.00"})
        self.assertEqual(out["state"], "halted")
        self.assertIn("WAS placed", ex.run["halt"])

    def test_cannot_place_twice(self):
        ex = self.start()
        self.to_executing(ex)
        ex.execute_via_api(self.place_fn(FakeZinc()))
        with self.assertRaises(ExecError):
            ex.execute_via_api(self.place_fn(FakeZinc()))


if __name__ == "__main__":
    unittest.main()


class TestRelayAndStatus(RunCase):
    def test_record_rejects_mismatched_request_and_status_page_renders(self):
        import status_view
        ex = self.start()
        self.to_executing(ex)
        run = ex.run
        ex.execute_via_api(lambda oid, lim: {"order_id": "z1", "status": "order_placed", "total": "14.75",
                                             "merchant_order_id": "W1"})
        f = status_view.facts(json.loads((self.tmp / "run.json").read_text()))
        self.assertTrue(all(s["reached"] for s in f["stages"]))
        page = status_view.render(f)
        self.assertIn("Order placed and confirmed", page)
        self.assertIn("W1", page)

    def test_status_page_for_halted_run(self):
        import status_view
        ex = self.start()
        self.to_executing(ex)
        ex.execute_via_api(lambda oid, lim: {"order_id": "z1", "status": "x", "total": "999.00"})
        f = status_view.facts(json.loads((self.tmp / "run.json").read_text()))
        self.assertTrue(f["stopped"])
        self.assertIn("Stopped:", status_view.render(f))


class TestApiMap(unittest.TestCase):
    def test_three_retailer_skill_collapses_to_zinc(self):
        import api_map
        import preflight
        path = ROOT / "examples" / "recorded-skill-3-retailers" / "SKILL.md"
        plan = preflight.parse_skill(path.read_text(encoding="utf-8"), str(path))
        self.assertEqual(plan["hosts"], ["www.amazon.com", "www.target.com", "www.walmart.com"])
        m = api_map.build(plan)
        self.assertEqual(sorted(m["zinc_covers"]), ["Amazon", "Target", "Walmart"])
        self.assertEqual(m["browser_only"], [])
        self.assertEqual(m["steps_replaced"], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        self.assertEqual(m["compare_steps"], [11])
