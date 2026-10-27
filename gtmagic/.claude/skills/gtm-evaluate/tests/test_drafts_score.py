"""Draft parsing and label mapping; scoring, tie-breaks, Borda, consistency and flags."""
from __future__ import annotations

import json
import unittest

import helpers  # noqa: F401  (puts scripts/ on the path)
import drafts
import score

LABELS = ["A", "B", "C"]


def rating(ratings: dict, pick: str) -> str:
    return json.dumps({"ratings": ratings, "pick": pick, "reason": "  two\nlines "})


class DraftTest(unittest.TestCase):
    def test_valid_rating_and_case(self) -> None:
        d = drafts.parse_rating(rating({"a": 1, "B": 5, "c": 3}, "None"), LABELS)
        self.assertEqual(d, {"ratings": {"A": 1, "B": 5, "C": 3}, "pick": "none", "reason": "two lines"})
        mapped = drafts.map_rating(drafts.parse_rating(rating({"A": 2, "B": 4, "C": 1}, "b"), LABELS),
                                   {"A": "img_3", "B": "img_1", "C": "img_2"})
        self.assertEqual(mapped["ratings"], {"img_3": 2, "img_1": 4, "img_2": 1})
        self.assertEqual(mapped["pick"], "img_1")

    def test_invalid_ratings(self) -> None:
        bad = ["not json", "[]", json.dumps({"pick": "A"}),
               rating({"A": 1, "B": 2}, "A"),                       # C missing
               rating({"A": 1, "B": 2, "C": 3, "D": 4}, "A"),       # D wasn't shown
               rating({"A": 0, "B": 2, "C": 3}, "A"),
               rating({"A": 6, "B": 2, "C": 3}, "A"),
               rating({"A": True, "B": 2, "C": 3}, "A"),
               rating({"A": 2.5, "B": 2, "C": 3}, "A"),
               rating({"A": 1, "a": 2, "B": 2, "C": 3}, "A"),       # same label twice
               rating({"A": 1, "B": 2, "C": 3}, "D")]
        for text in bad:
            with self.assertRaises(drafts.InvalidDraft, msg=text):
                drafts.parse_rating(text, LABELS)

    def test_ranking(self) -> None:
        d = drafts.parse_ranking(json.dumps({"ranking": ["c", "A", "B"], "reason": "x"}), LABELS)
        self.assertEqual(d["ranking"], ["C", "A", "B"])
        self.assertEqual(drafts.map_ranking(d, {"A": "x", "B": "y", "C": "z"})["ranking"], ["z", "x", "y"])
        for bad in (["A", "B"], ["A", "A", "B"], ["A", "B", "C", "D"], "A,B,C"):
            with self.assertRaises(drafts.InvalidDraft):
                drafts.parse_ranking(json.dumps({"ranking": bad, "reason": "x"}), LABELS)


def answered(role: str, ratings: dict, pick: str, label_map: dict, pid: str = "") -> dict:
    return {"callId": f"{role}-{pid or len(ratings)}", "role": role, "personaId": pid, "status": "answered",
            "labelMap": label_map, "result": {"ratings": ratings, "pick": pick, "reason": ""}}


MAP = {"A": "x", "B": "y"}


class ScoreTest(unittest.TestCase):
    def test_mean_then_pick_share_then_coin(self) -> None:
        records = [answered("persona", {"x": 4, "y": 4}, "x", MAP, "p1"),
                   answered("persona", {"x": 2, "y": 2}, "y", MAP, "p2"),
                   answered("persona", {"x": 3, "y": 3}, "x", MAP, "p3")]
        s = score.rating_summary(records, ["x", "y"], 1, "t")
        self.assertEqual([r["assetId"] for r in s["ranking"]], ["x", "y"])  # same mean, x picked more
        self.assertEqual(s["ranking"][1]["tieWithAboveBrokenBy"], "pick share")
        self.assertFalse(s["ranking"][1]["tied"])
        self.assertEqual(s["assets"]["x"]["meanRatingExact"], "3/1")
        records.append(answered("persona", {"x": 3, "y": 3}, "y", MAP, "p4"))  # now a true tie
        s = score.rating_summary(records, ["x", "y"], 1, "t")
        self.assertTrue(all(r["tied"] and r["averageRank"] == 1.5 for r in s["ranking"]))
        self.assertEqual(s["ranking"][1]["tieWithAboveBrokenBy"], "seeded coin flip")
        flips = {tuple(r["assetId"] for r in score.rating_summary(records, ["x", "y"], seed, "t")["ranking"])
                 for seed in range(20)}
        self.assertEqual(len(flips), 2)  # the coin really depends on the seed

    def test_skips_none_and_exact_means(self) -> None:
        records = [answered("persona", {"x": 5, "y": 1}, "none", MAP, "p1"),
                   answered("persona", {"x": 4, "y": 2}, "x", MAP, "p2"),
                   {"callId": "persona-p3", "role": "persona", "status": "skipped", "skipReason": "refusal"}]
        s = score.rating_summary(records, ["x", "y"], 1, "t")
        self.assertEqual((s["calls"], s["answered"], s["noneCount"]), (3, 2, 1))
        self.assertEqual(s["skipReasons"], {"refusal": 1})
        self.assertEqual(s["assets"]["x"]["meanRating"], 4.5)
        self.assertEqual(s["assets"]["x"]["pickShare"], 0.5)
        self.assertEqual(s["positionCounts"], {"x": [2, 0], "y": [0, 2]})

    def test_borda_and_position_driven_judge(self) -> None:
        recs = [{"callId": "j0", "role": "judge-plain", "status": "answered", "labelMap": {"A": "x", "B": "y"},
                 "result": {"ranking": ["x", "y"]}},
                {"callId": "j1", "role": "judge-plain", "status": "answered", "labelMap": {"A": "y", "B": "x"},
                 "result": {"ranking": ["y", "x"]}}]
        s = score.borda_summary(recs, ["x", "y"], 1, "j")
        self.assertEqual(s["assets"], {"x": {"bordaPoints": 1, "firstPlaces": 1}, "y": {"bordaPoints": 1, "firstPlaces": 1}})
        self.assertEqual(s["firstShownRankedFirst"], 2)
        self.assertTrue(s["ranking"][1]["tied"])

    def test_consistency(self) -> None:
        first = [answered("persona", {"x": 5, "y": 1}, "x", MAP, "p1"), answered("persona", {"x": 2, "y": 2}, "y", MAP, "p2")]
        again = [answered("repeat", {"x": 4, "y": 1}, "x", {"A": "y", "B": "x"}, "p1"),
                 answered("repeat", {"x": 2, "y": 4}, "none", {"A": "y", "B": "x"}, "p2")]
        c = score.consistency(first, again, ["x", "y"])
        self.assertEqual((c["pairsCompared"], c["samePick"], c["meanAbsRatingChange"]), (2, 1, 0.75))
        self.assertEqual(c["chanceSamePickShare"], 0.5)  # picks x and y, half each: 0.5² + 0.5²

    def test_no_answers_means_no_ranking(self) -> None:
        skipped = [{"callId": "persona-p1", "role": "persona", "status": "skipped", "skipReason": "timeout",
                    "labelMap": MAP}]
        self.assertEqual(score.rating_summary(skipped, ["x", "y"], 1, "t")["ranking"], [])
        self.assertEqual(score.borda_summary([], ["x", "y"], 1, "j")["ranking"], [])
        run = {"assets": [{"id": "x"}, {"id": "y"}], "seed": 1, "assetType": "headline", "warnings": []}
        flags = score.build_results(run, skipped)["flags"]
        self.assertTrue(any(f.startswith("no-answers: personas") for f in flags))

    def test_flags(self) -> None:
        run = {"assets": [{"id": "x"}, {"id": "y"}], "seed": 1, "assetType": "headline", "warnings": []}
        records = [answered("persona", {"x": 5, "y": 1}, "x", MAP, "p1")]
        records += [{"callId": f"persona-p{i}", "role": "persona", "status": "skipped", "skipReason": "budget",
                     "labelMap": MAP} for i in range(2, 5)]
        flags = score.build_results(run, records)["flags"]
        self.assertTrue(any(f.startswith("many-skipped") for f in flags))
        self.assertTrue(any(f.startswith("budget-cap-reached") for f in flags))


if __name__ == "__main__":
    unittest.main()
