"""Latin square, call plan, repeats and seeds."""
from __future__ import annotations

import unittest
from collections import Counter

import helpers
import design
import personas


class LatinSquareTest(unittest.TestCase):
    def test_every_ad_sits_in_every_position_once(self) -> None:
        for k in range(2, 8):
            base = [f"a{i}" for i in range(k)]
            square = design.latin_square(base)
            self.assertEqual(len(square), k)
            for position in range(k):
                self.assertEqual(sorted(row[position] for row in square), sorted(base))

    def test_two_ads_give_ab_and_ba(self) -> None:
        self.assertEqual(design.latin_square(["x", "y"]), [["x", "y"], ["y", "x"]])

    def test_labels_follow_position(self) -> None:
        call = design.Call("c", "persona", ["img_3", "img_1"], 1)
        self.assertEqual(call.label_map(), {"A": "img_3", "B": "img_1"})


class SeedTest(unittest.TestCase):
    def test_shuffle_is_a_reproducible_permutation(self) -> None:
        items = list(range(20))
        a = design.shuffled(items, design.rng(5, "x"))
        self.assertEqual(sorted(a), items)
        self.assertEqual(a, design.shuffled(items, design.rng(5, "x")))
        self.assertNotEqual(a, design.shuffled(items, design.rng(6, "x")))

    def test_purposes_are_independent(self) -> None:
        self.assertNotEqual(design.sub_seed(1, "a"), design.sub_seed(1, "b"))

    def test_pinned_values(self) -> None:
        # Pinned so any change to the seeding scheme (which would silently change a pre-registered run's
        # orders and draws) fails here first. Built only on Random.random(), so these hold on any Python 3.
        self.assertEqual(design.sub_seed(7, "base-order"), 9472480110775976523)
        self.assertEqual(design.base_order(["a", "b", "c", "d", "e"], 7), ["c", "a", "e", "b", "d"])
        first = personas.draw_personas(helpers.demo_brief(), 48, 7)[0][0]
        self.assertEqual(first.attributes["role"], "Caregiver or stay-at-home parent")
        self.assertEqual(first.attributes["skepticism"], "low")


class PlanTest(unittest.TestCase):
    def setUp(self) -> None:
        self.people, _ = personas.draw_personas(helpers.demo_brief(), 48, 7)
        self.base = ["img_1", "img_2", "img_3"]
        self.calls = design.plan_calls(self.people, self.base, 10, 48, 7)

    def test_roles_and_counts(self) -> None:
        roles = Counter(c.role for c in self.calls)
        self.assertEqual(roles, {"persona": 48, "repeat": 10, "judge-brief": 3, "judge-plain": 3, "crowd": 48})
        self.assertEqual(len({c.id for c in self.calls}), len(self.calls))

    def test_persona_orderings_are_balanced(self) -> None:
        rows = Counter(c.ordering_index for c in self.calls if c.role == "persona")
        self.assertLessEqual(max(rows.values()) - min(rows.values()), 1)
        for segment in ("seg_1", "seg_2"):
            ids = {p.id for p in self.people if p.segment_id == segment}
            seg_rows = Counter(c.ordering_index for c in self.calls if c.persona_id in ids and c.role == "persona")
            self.assertLessEqual(max(seg_rows.values()) - min(seg_rows.values()), 1)

    def test_repeats_reverse_their_own_order_and_spread_across_groups(self) -> None:
        first = {c.persona_id: c for c in self.calls if c.role == "persona"}
        repeats = [c for c in self.calls if c.role == "repeat"]
        for c in repeats:
            self.assertEqual(c.order, list(reversed(first[c.persona_id].order)))
            self.assertTrue(c.reversed_order)
        segment_of = {p.id: p.segment_id for p in self.people}
        self.assertEqual(Counter(segment_of[c.persona_id] for c in repeats), {"seg_1": 5, "seg_2": 5})

    def test_judges_see_every_ordering_once(self) -> None:
        for role in design.JUDGE_ROLES:
            orders = [c.order for c in self.calls if c.role == role]
            self.assertEqual(orders, design.latin_square(self.base))

    def test_execution_order_is_a_seeded_permutation(self) -> None:
        order = design.execution_order(self.calls, 7)
        self.assertEqual(sorted(c.id for c in order), sorted(c.id for c in self.calls))
        self.assertEqual([c.id for c in order], [c.id for c in design.execution_order(self.calls, 7)])
        self.assertNotEqual([c.id for c in order], [c.id for c in self.calls])


if __name__ == "__main__":
    unittest.main()
