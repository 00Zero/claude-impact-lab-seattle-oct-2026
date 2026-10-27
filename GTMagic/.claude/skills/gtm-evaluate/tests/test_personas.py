"""Seeded, balanced persona draws."""
from __future__ import annotations

import unittest
from collections import Counter

import helpers
import personas


class DrawTest(unittest.TestCase):
    def test_balanced_across_groups(self) -> None:
        people, _ = personas.draw_personas(helpers.demo_brief(), 48, 7)
        self.assertEqual(Counter(p.segment_id for p in people), {"seg_1": 24, "seg_2": 24})
        odd, _ = personas.draw_personas(helpers.demo_brief(), 7, 7)
        self.assertEqual(sorted(Counter(p.segment_id for p in odd).values()), [3, 4])

    def test_same_seed_same_draws(self) -> None:
        a, _ = personas.draw_personas(helpers.demo_brief(), 48, 7)
        b, _ = personas.draw_personas(helpers.demo_brief(), 48, 7)
        c, _ = personas.draw_personas(helpers.demo_brief(), 48, 8)
        self.assertEqual([p.to_json() for p in a], [p.to_json() for p in b])
        self.assertNotEqual([p.to_json() for p in a], [p.to_json() for p in c])

    def test_cards_use_the_brief(self) -> None:
        brief = helpers.demo_brief()
        people, _ = personas.draw_personas(brief, 48, 7)
        seg = {s["id"]: s for s in brief["segments"]}
        for p in people:
            s = seg[p.segment_id]
            self.assertEqual(set(p.attributes), set(personas.CORE_ATTRIBUTES))
            self.assertTrue(set(p.needs) <= set(s["needs"]) and len(p.needs) == min(2, len(s["needs"])))
            self.assertTrue(set(p.barriers) <= set(s["barriers"]))
            self.assertTrue(set(p.criteria) <= set(s["decisionCriteria"]))
            for name, value in p.attributes.items():
                options = next(a for a in s["attributes"] if a["name"] == name)["values"]
                self.assertIn(value, [v["value"] for v in options])

    def test_thin_voice_warning_and_bad_groups(self) -> None:
        _, warnings = personas.draw_personas(helpers.demo_brief(), 10, 7)
        self.assertTrue(any("seg_2" in w and "customer phrases" in w for w in warnings))
        self.assertFalse(any("seg_1" in w for w in warnings))
        empty = helpers.demo_brief()
        empty["segments"] = []
        with self.assertRaises(ValueError):
            personas.draw_personas(empty, 10, 7)
        brief = helpers.demo_brief()
        brief["segments"][1]["id"] = "seg_1"
        with self.assertRaises(ValueError):
            personas.draw_personas(brief, 10, 7)

    def test_zero_weights_still_draw(self) -> None:
        brief = helpers.demo_brief()
        for attr in brief["segments"][0]["attributes"]:
            for v in attr["values"]:
                v["weight"] = 0
        people, _ = personas.draw_personas(brief, 4, 7)
        self.assertEqual(len(people[0].attributes), 6)


if __name__ == "__main__":
    unittest.main()
