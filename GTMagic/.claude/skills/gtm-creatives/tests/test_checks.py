"""gtm-creatives tests: the allow-listed brief, the gate, and every check a draft must pass.

Run from the repo root: python3 -m unittest discover -s .claude/skills/gtm-creatives/tests
"""
from __future__ import annotations

import copy
import json
import unittest

from helpers import demo, option

import brief as briefs  # noqa: E402 (helpers put scripts/ on the path)
import generate  # noqa: E402
from checks import check_option, interleave  # noqa: E402


class BriefTest(unittest.TestCase):
    def test_brief_never_carries_quotes_links_or_figures(self) -> None:
        intake = demo()
        brief = briefs.build_brief(intake)
        sent = json.dumps(brief)
        for ev in intake["evidence"]:
            self.assertNotIn(ev["excerpt"], sent)
        for banned in ("http", "revenueGoal", "unitEconomics", "imageDescription", "ev_", "610", "420", "30.0", "53.96"):
            self.assertNotIn(banned, sent)
        tried = {t["headline"]: t["result"] for t in brief["alreadyTried"]}
        self.assertTrue(tried["Lose weight without losing muscle"].startswith("worked"))
        self.assertEqual(brief["business"]["price"], "USD 14.99 per month")

    def test_gate(self) -> None:
        intake = demo()
        self.assertTrue(any("already has 3 creatives" in e for e in briefs.gate(intake, alongside=False)[0]))
        self.assertEqual(briefs.gate(intake, alongside=True)[0], [])
        refine = copy.deepcopy(intake)
        refine["research"] = {"decision": {"recommendation": "refine"}}
        self.assertTrue(any("refine" in e for e in briefs.gate(refine, True)[0]))
        refine["research"]["decision"]["ownerChoice"] = "generate-creatives"  # the owner's recorded choice wins
        self.assertEqual(briefs.gate(refine, True)[0], [])

    def test_focus_allocation_and_price(self) -> None:
        intake = demo()
        intake["research"] = {"decision": {"recommendation": "generate-creatives", "focusSegmentIds": ["seg_2"]}}
        self.assertEqual([s["id"] for s in briefs.focus_segments(intake)], ["seg_2"])
        self.assertEqual(briefs.allocation(["a", "b", "c"], 8), {"a": 3, "b": 3, "c": 2})
        for amount, shown in ((12999.99, "USD 12999.99"), (1250000, "USD 1250000"), (14.9, "USD 14.9")):
            intake["business"]["pricing"]["amount"] = amount
            self.assertTrue(briefs.price_text(intake).startswith(shown))

    def test_odd_intake_shapes_dont_crash(self) -> None:
        intake = demo()
        intake["readiness"] = "ready"
        intake["business"]["pricing"] = "15 a month"
        intake["lexicon"].append({"phrase": "no id here", "voice": "customer"})
        intake["segments"][0]["concernBundles"][0]["observedCount"] = "many"
        intake["constraints"].append({"appliesTo": "messaging", "bucket": "locked", "rule": ["exclude"]})
        self.assertTrue(briefs.gate(intake, True)[0])          # a plain error, not a traceback
        briefs.build_brief(intake)
        generate.build_context(intake)


class ChecksTest(unittest.TestCase):
    def setUp(self) -> None:
        self.ctx = generate.build_context(demo())

    def reason(self, **over: object) -> str:
        c = check_option(option(**over), self.ctx)
        return "" if c.kept else c.reasons[0]

    def test_clean_option_is_kept(self) -> None:
        self.assertEqual(self.reason(), "")

    def test_drops(self) -> None:
        cases = {
            "quotation": {"headline": "“Not losing too much muscle” starts today", "lexiconIds": ["lex_4"]},
            "speaks as a customer": {"headline": "I kept my muscle, not just fat, at last"},
            "verbatim first person": {"headline": "I want to feel stronger", "lexiconIds": ["lex_5"]},
            "made-up person": {"headline": "She lost the fat, not the muscle she built"},
            "body result": {"subheadline": "Sessions that boost your metabolism so you keep muscle, not just lose fat."},
            "for good": {"subheadline": "Keep the muscle, not just lose the fat, and keep the weight off for good."},
            "statistic": {"subheadline": "Thousands of members keep muscle, not just lose fat, with short sessions."},
            "number": {"headline": "Lose fat, not muscle, in 10 short sessions"},
            "fullwidth digits": {"headline": "Lose fat, not muscle, in １０ short sessions"},
            "fullwidth superlative": {"headline": "The ｂｅｓｔ way to lose fat, not muscle"},
            "zero-width superlative": {"headline": "The be​st way to lose fat, not muscle"},
            "medication": {"subheadline": "For people on GL​P-1 who want to keep muscle while losing weight."},
            "competitor": {"subheadline": "Unlike TrackAll, it plans strength sessions so you keep muscle."},
            "owner exclusion": {"subheadline": "Keep muscle, not just fat, with no drug brand names involved."},
            "line break": {"headline": "Lose the fat, not the muscle\nDo it"},
            "unused phrase's number": {"subheadline": "Keep muscle, not just fat, with 100 short sessions.",
                                       "lexiconIds": ["lex_1", "lex_2"]},
            "doesn't really use": {"headline": "Strength sessions for busy weeks"},
            "no real customer phrase": {"lexiconIds": []},
            "copies a quote": {"subheadline": "Short sessions so I do weights at home, simply."},
            "same headline": {"headline": "Lose weight without losing muscle"},
            "over 10 words": {"headline": "Lose the fat, not the muscle you worked so hard for, ever"},
            "button too long": {"callToAction": "Start your very first strength session today"},
            "customer group": {"targetSegmentId": "seg_9"},
        }
        for name, over in cases.items():
            with self.subTest(name):
                self.assertNotEqual(self.reason(**over), "", f"should drop: {over}")

    def test_allowed(self) -> None:
        # A customer phrase turned into second person still counts, and its own 6-word runs aren't "copying".
        self.assertEqual(self.reason(headline="When you want to feel stronger, start small",
                                     lexiconIds=["lex_5"]), "")
        self.assertEqual(self.reason(headline="Enough protein to work out and not lose muscle", lexiconIds=["lex_2"]), "")
        self.assertEqual(self.reason(subheadline="Strength sessions for people losing weight, at $14.99 a month."), "")
        self.assertEqual(self.reason(headline="Lose the fat, not the muscle mass you’ve worked for"), "")  # ’ apostrophe

    def test_offers_and_number_words_are_cautions(self) -> None:
        c = check_option(option(subheadline="Three short strength sessions a week, free to try, for people losing weight."),
                         self.ctx)
        self.assertTrue(c.kept)
        self.assertEqual(len([n for n in c.notes if "owner must confirm" in n]), 2)

    def test_malformed_fields_are_dropped_not_crashes(self) -> None:
        for over in ({"lexiconIds": 5}, {"targetSegmentId": ["seg_1"]}, {"lexiconIds": [{}]}, {"headline": 7}):
            with self.subTest(over):
                self.assertFalse(check_option(option(**over), self.ctx).kept)
        c = check_option(option(principlesUsed=3, assumptions="Offers sessions"), self.ctx)
        self.assertEqual((c.option["principlesUsed"], c.option["assumptions"]), ([], ["Offers sessions"]))
        self.assertFalse(check_option("not a dict", self.ctx).kept)

    def test_duplicates_and_interleave(self) -> None:
        self.assertTrue(check_option(option(), self.ctx).kept)
        self.assertFalse(check_option(option(angle="Other"), self.ctx).kept)
        kept = [check_option(option(headline=f"Lose the fat, not the muscle mass {w}"), self.ctx) for w in ("now", "today")]
        kept.append(check_option(option(headline="Lack the confidence to use free weights? Start here",
                                        targetSegmentId="seg_2", lexiconIds=["lex_7"]), self.ctx))
        self.assertEqual([c.option["targetSegmentId"] for c in interleave(kept, ["seg_1", "seg_2"])],
                         ["seg_1", "seg_2", "seg_1"])


if __name__ == "__main__":
    unittest.main()
