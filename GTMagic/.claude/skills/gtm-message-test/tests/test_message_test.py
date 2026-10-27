"""Tests for gtm-message-test. Run from the repo root:  python3 -m unittest discover -s .claude/skills/gtm-message-test/tests"""
from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import demo_pipeline as demo  # noqa: E402  (also puts scripts/ on the path)
import build_test  # noqa: E402
import copy_checks  # noqa: E402
import evaluate  # noqa: E402
import render_results  # noqa: E402
import stats  # noqa: E402

INTAKE, DRAFTS = demo.load("intake.json"), demo.load("message-drafts.json")
RUN = demo.run()
SCRIPTS = HERE.parent / "scripts"


def resp(cust: str, seg: str, choice: str, intent: int = 4) -> dict:
    ratings = {c: {d: (intent if c == choice else 2) for d in stats.DIMENSIONS} for c in ("hyp_1", "hyp_2", "hyp_3")}
    return {"customerId": cust, "segmentId": seg, "choice": choice, "ratings": ratings}


def verdict(rows: list[str], kinds: dict, none: int = 0, cids: list[str] | None = None, repeats=(10, 10, 0.5)):
    """Message verdict for customers who chose `rows` (candidate ids), plus `none` who chose nothing."""
    cids = cids or ["hyp_1", "hyp_2", "hyp_3"]
    resps = [{"customerId": f"c{i}", "segmentId": "seg_1", "choice": c, "ratings": {}} for i, c in enumerate(rows + ["none"] * none)]
    table = stats.candidates_table(resps, cids, ["seg_1"])
    top = max(table, key=lambda c: c["choiceCount"])["candidateId"]
    boot = stats.bootstrap(resps, cids, top, [c for c in cids if c != top], 1)
    return stats.message_checks(table, kinds, {}, boot, len(resps), none, repeats)


class CopyChecks(unittest.TestCase):
    def test_same_banned_list_as_gtm_intake(self):
        sys.path.insert(0, str(demo.ROOT / ".claude" / "skills" / "gtm-intake" / "scripts"))
        import guardrails
        self.assertEqual(copy_checks.MESSAGING_BANNED, guardrails.MESSAGING_BANNED)
        self.assertEqual(copy_checks.DRUG_TERMS, guardrails.DRUG_TERMS)
        self.assertEqual(copy_checks.STOPWORDS, guardrails.STOPWORDS)
        phrases = [x["phrase"] for x in INTAKE["lexicon"]] + ["I\u2019m   done", "the"]
        lines = [f"{o['headline']} {o['subheadline']}" for o in DRAFTS["options"]] + ["I'M DONE with it"]
        for line in lines:
            for phrase in phrases:
                self.assertEqual(copy_checks.uses_phrase(line, phrase), guardrails.uses_phrase(line, phrase), (line, phrase))

    def test_health_brief(self):
        for level, text in [("ok", "Keep your strength while the weight comes off"), ("block", "The strength plan built for GLP-1"),
                            ("block", "Are you on a weight-loss shot?"), ("block", "Built for people with diabetes"),
                            ("block", "Melt 15 pounds"), ("block", "Recommended by doctors"), ("block", "“This saved my strength” — Sarah"),
                            ("block", "Better than TrackAll for lifters"), ("caution", "Stronger in just 6 weeks")]:
            self.assertEqual(copy_checks.check_copy(text, ["TrackAll (fictional calorie tracker)"], health=True)[0], level, text)
        self.assertTrue(copy_checks.is_health_brief(INTAKE))

    def test_other_businesses_keep_ordinary_words(self):
        for text in ["Treat yourself to fresh bread", "Prescription glasses in an hour", "Are you on a tight budget?",
                     "Frame your shots like a pro", "Try our “Morning Glory Muffin” - baked fresh", "Join the strength club"]:
            self.assertNotEqual(copy_checks.check_copy(text, ["Strong"], health=False)[0], "block", text)
        for text in ["Trusted by 10,000 owners", "The #1 bakery in town", "Top-rated plumbers", "Rated 4.9★"]:
            self.assertEqual(copy_checks.check_copy(text, [], health=False)[0], "block", text)
        # A one-word competitor name might be an ordinary word: flagged, not blocked, in any case.
        self.assertEqual(copy_checks.check_copy("Strong after 40", ["Strong"], health=False)[0], "caution")
        self.assertEqual(copy_checks.check_copy("Better than noom", ["Noom"], health=False)[0], "caution")
        self.assertEqual(copy_checks.check_copy("Switch from lose it!", ["Lose It!"], health=False)[0], "block")


class Build(unittest.TestCase):
    def test_demo_builds_six_blind_options_in_a_williams_square(self):
        pos, req = RUN["positioning-set.json"], RUN["experiment-request.json"]
        self.assertEqual([h["source"] for h in pos["hypotheses"]].count("generated"), 4)
        self.assertEqual({h["source"] for h in pos["hypotheses"]}, {"generated", "founder-current", "decoy"})
        labels = sorted(s["label"] for s in req["stimuli"])
        rows = req["orderings"]
        for position in range(6):
            self.assertEqual(sorted(r[position] for r in rows), labels)
        pairs = [(r[j], r[j + 1]) for r in rows for j in range(5)]
        self.assertEqual(len(set(pairs)), 30)  # every option right after every other exactly once
        texts = [s["text"] for s in req["stimuli"]]
        self.assertTrue(all("hyp_" not in t and ". " not in t and t.endswith(".") for t in texts), texts)  # headline only, like cr_1
        owner = next(h for h in pos["hypotheses"] if h["source"] == "founder-current")
        self.assertEqual(owner["headline"], next(c for c in INTAKE["creatives"] if c["id"] == "cr_1")["headline"])  # copied by code
        self.assertEqual(len(req["fingerprint"]), 12)

    def test_offset_start_rows_keep_the_whole_sample_balanced(self):
        from collections import Counter
        from ordering import ordering_index
        shown = Counter(ordering_index(s, 3, j, 6) for s in range(3) for j in range(16))
        self.assertEqual(set(shown.values()), {8})                     # plain j % k: rows 0-3 shown 9 times, rows 4-5 only 6
        self.assertEqual({ordering_index(s, 3, j, 6) for j in range(6) for s in range(3)}, set(range(6)))  # every group sees all
        mains = [r["orderingIndex"] for r in RUN["customer-responses"]["responses"] if not r["isRepeat"]]
        counts = Counter(mains)
        self.assertLessEqual(max(counts.values()) - min(counts.values()), 1)

    def test_odd_number_of_options_gets_mirrored_rows(self):
        rows = build_test.williams_square(list("ABCDE"))
        self.assertEqual(len(rows), 10)
        self.assertEqual(len({(r[j], r[j + 1]) for r in rows for j in range(4)}), 20)

    def test_bad_drafts_are_dropped_and_too_few_fails(self):
        drafts = copy.deepcopy(DRAFTS)
        drafts["options"][0]["headline"] = "The strength plan built for GLP-1"     # banned
        drafts["options"][1]["lexiconIds"] = ["lex_99"]                            # no real phrase left
        drafts["options"][2]["headline"] = "Lose weight, without losing muscle!"   # same as the current message
        drafts["options"][3]["subheadline"] = None                                 # every other option shows one
        drafts["options"][4] = "not an option"
        _, _, errors, warnings = build_test.build(INTAKE, drafts, demo.build_args())
        self.assertTrue(errors and "only 1 of 4" in errors[0], errors)
        self.assertTrue(any("lex_99" in w for w in warnings))
        self.assertTrue(any("no subheadline" in w for w in warnings))

    def test_owner_voice_phrases_dont_count_as_customer_words(self):
        intake, drafts = copy.deepcopy(INTAKE), copy.deepcopy(DRAFTS)
        lex_id = drafts["options"][0]["lexiconIds"][0]
        next(x for x in intake["lexicon"] if x["id"] == lex_id)["voice"] = "owner"
        drafts["options"][0]["lexiconIds"] = [lex_id]
        pos, _, _, warnings = build_test.build(intake, drafts, demo.build_args())
        self.assertTrue(any(f"'{lex_id}': not tagged customer voice" in w for w in warnings), warnings)
        self.assertNotIn(drafts["options"][0]["headline"], [h["headline"] for h in pos["hypotheses"]])

    def test_lopsided_targeting_is_warned(self):
        drafts = copy.deepcopy(DRAFTS)
        for o in drafts["options"]:
            o["targetSegmentIds"] = ["seg_1"]
        warnings = build_test.build(INTAKE, drafts, demo.build_args())[3]
        self.assertTrue(any("aren't balanced" in w for w in warnings))

    def test_not_ready_intake_is_refused(self):
        intake = copy.deepcopy(INTAKE)
        intake["readiness"]["status"] = "no-supported-segment"
        self.assertTrue(any("not 'ready'" in e for e in build_test.build(intake, DRAFTS, demo.build_args())[2]))

    def test_typed_current_message_with_a_subheadline(self):
        args = demo.build_args(current_creative=None, current_headline="Lose weight without losing muscle",
                               current_subheadline="Short strength sessions built for people losing weight.")
        _, req, errors, _ = build_test.build(INTAKE, DRAFTS, args)
        self.assertEqual(errors, [])
        self.assertTrue(all(s["text"].count(". ") == 1 for s in req["stimuli"]), [s["text"] for s in req["stimuli"]])

    def test_unknown_creative_is_refused(self):
        self.assertTrue(any("cr_9" in e for e in build_test.build(INTAKE, DRAFTS, demo.build_args(current_creative="cr_9"))[2]))

    def test_copy_must_really_use_a_cited_phrase_and_not_copy_the_decoy(self):
        drafts = copy.deepcopy(DRAFTS)
        drafts["options"][0].update(headline="Pancakes for a rainy Tuesday", subheadline="Fresh ideas every day.")
        drafts["options"][1]["headline"] = "The fitness app for everyone"
        pos, _, _, warnings = build_test.build(INTAKE, drafts, demo.build_args())
        self.assertTrue(any("doesn't really use" in w and "Pancakes" in w for w in warnings), warnings)
        self.assertEqual([h["headline"] for h in pos["hypotheses"]].count("The fitness app for everyone"), 1)  # the decoy only

    def test_same_shape_without_a_current_subheadline(self):
        args = demo.build_args(current_creative=None, current_headline="Lose weight without losing muscle", current_subheadline="")
        _, req, _, warnings = build_test.build(INTAKE, DRAFTS, args)
        self.assertTrue(all(s["text"].count(".") == 1 for s in req["stimuli"]), [s["text"] for s in req["stimuli"]])
        self.assertTrue(any("headline only" in w for w in warnings))

    def test_no_current_message_means_five_new_options_and_grammar(self):
        pos, req, errors, _ = build_test.build(INTAKE, DRAFTS, demo.build_args(current_creative=None, category="an app", channel="ad"))
        self.assertEqual(errors, [])
        self.assertEqual([h["source"] for h in pos["hypotheses"]].count("generated"), 5)
        self.assertEqual(req["scenario"]["context"], "You're looking at an ad for an app.")
        self.assertIn("The app for everyone", [h["headline"] for h in pos["hypotheses"]])


class Stats(unittest.TestCase):
    def test_segment_score_follows_the_contract_formula(self):
        rows = stats.segment_ranking([resp("c1", "seg_1", "hyp_1", 4), resp("c2", "seg_1", "none")], ["seg_1"])
        self.assertEqual((rows[0]["noneShare"], rows[0]["score"]), (0.5, round(0.5 * 4 / 5, 4)))

    def test_icp_verdicts(self):
        strong = [resp(f"a{i}", "seg_1", "hyp_1", 5) for i in range(20)]
        weak = [resp(f"b{i}", "seg_2", "none" if i % 2 else "hyp_2", 2) for i in range(20)]
        segs = ["seg_1", "seg_2"]
        self.assertEqual(stats.icp_verdict(strong + weak, segs, "seg_1", 1)[0], "guess-holds")
        self.assertEqual(stats.icp_verdict(strong + weak, segs, "seg_2", 1)[0], "different-segment")
        tied = [resp(f"c{i}", "seg_2", "hyp_1", 5) for i in range(20)]
        self.assertEqual(stats.icp_verdict(strong + tied, segs, "seg_2", 1)[0], "too-close-to-call")  # a tie isn't a hold
        self.assertEqual(stats.icp_verdict(strong[:1] + weak, segs, "seg_2", 1)[0], "too-close-to-call")  # one customer can't win
        self.assertEqual(stats.icp_verdict(strong, ["seg_1"], None, 1)[0], "no-guess")
        self.assertEqual(stats.icp_verdict(strong[:2], segs, "seg_1", 1)[0], "too-close-to-call")  # nobody to compare against
        self.assertEqual(stats.icp_verdict(strong[:2] + weak, segs, "seg_1", 1)[0], "too-close-to-call")  # two customers can't hold

    def test_decoy_rules(self):
        kinds = {"hyp_3": "decoy"}
        self.assertEqual(verdict(["hyp_1"] * 40, kinds)[1], "clear-winner")                        # decoy tied at 0 with hyp_2: last
        self.assertEqual(verdict(["hyp_1", "hyp_2", "hyp_3"] * 20, kinds)[1], "unreliable")         # decoy tied for the lead
        self.assertEqual(verdict([], kinds, none=48)[1], "no-clear-winner")                          # nobody chose anything
        self.assertEqual(verdict(["hyp_1"] * 10, kinds, none=30)[1], "no-clear-winner")              # most chose none
        self.assertEqual(verdict(["hyp_1"] * 16, kinds, none=20)[1], "no-clear-winner")              # none beat the top option
        six = [f"hyp_{i}" for i in range(1, 7)]
        strong = ["hyp_1"] * 30 + ["hyp_2"] * 10 + ["hyp_3", "hyp_4", "hyp_5"] + ["hyp_6"] * 2
        checks, v, _ = verdict(strong, {"hyp_6": "decoy"}, none=3, cids=six)
        self.assertNotEqual(v, "unreliable")                                                      # two stray decoy picks
        self.assertEqual(next(c for c in checks if c["id"] == "decoy")["status"], "warn")
        even = sum(([c] * 8 for c in six), [])
        self.assertEqual(verdict(even, {"hyp_6": "decoy"}, cids=six)[1], "unreliable")            # decoy as popular as the rest

    def test_unsteady_repeats_block_a_winner(self):
        rows = ["hyp_1"] * 40 + ["hyp_2"] * 5
        self.assertEqual(verdict(rows, {}, repeats=(9, 10, 0.5))[1], "clear-winner")      # well above luck
        self.assertEqual(verdict(rows, {}, repeats=(6, 10, 0.5))[1], "no-clear-winner")   # barely above luck
        self.assertEqual(verdict(rows, {}, repeats=(3, 3, 0.5))[1], "no-clear-winner")    # too few repeats to check
        self.assertEqual(verdict(rows, {}, repeats=(9, 10, 0.88))[1], "clear-winner")     # luck + 0.15 would need over 100%

    def test_wilson_ranges(self):
        self.assertEqual(stats.wilson(0, 48)[0], 0.0)
        self.assertGreater(stats.wilson(0, 48)[1], 0.03)       # zero picks still has room to move
        lo, hi = stats.wilson(21, 48)
        self.assertTrue(lo < 21 / 48 < hi)

    def test_bootstrap_is_seeded(self):
        resps = [resp(f"c{i}", "seg_1", ("hyp_1", "hyp_2", "hyp_3")[i % 7 % 3]) for i in range(301)]
        run = lambda seed: stats.bootstrap(resps, ["hyp_1", "hyp_2", "hyp_3"], "hyp_1", ["hyp_2", "hyp_3"], seed)  # noqa: E731
        self.assertEqual(run(3), run(3))
        self.assertNotEqual(run(3)["ranges"], run(4)["ranges"])

    def test_repeat_consistency(self):
        main = [resp("c1", "seg_1", "hyp_1"), resp("c2", "seg_1", "hyp_2")]
        self.assertEqual(stats.repeat_consistency(main, [resp("c1", "seg_1", "hyp_1"), resp("c2", "seg_1", "hyp_1")]), 0.5)
        self.assertIsNone(stats.repeat_consistency(main, []))


class Evaluate(unittest.TestCase):
    def setUp(self):
        self.pos, self.req, self.resps = RUN["positioning-set.json"], RUN["experiment-request.json"], RUN["customer-responses"]

    def test_answers_that_dont_match_what_was_shown_are_skipped(self):
        bad = copy.deepcopy(self.resps)
        mains = [r for r in bad["responses"] if not r["isRepeat"]]
        mains[0]["choice"] = "hyp_99"
        mains[1]["ratings"][0]["scores"]["clarity"] = True       # a bool isn't a score
        mains[2]["ratings"] = mains[2]["ratings"][:-1]            # one shown option not rated
        mains[3]["orderingIndex"] = 99
        del mains[4]["customerId"]
        res, warnings = evaluate.evaluate(INTAKE, self.pos, self.req, bad, None, 42)
        self.assertEqual(res["skipped"], 4)
        self.assertEqual(res["answered"], 43)
        self.assertEqual(sum(c["choiceCount"] for c in res["candidates"]) + res["noneCount"], res["answered"])

    def test_wrongly_typed_fields_are_skipped_not_a_crash(self):
        bad = copy.deepcopy(self.resps)
        bad["_note"] = None
        mains = [r for r in bad["responses"] if not r["isRepeat"]]
        mains[0]["segmentId"] = ["seg_1"]
        mains[1]["ratings"][0]["candidateId"] = ["hyp_1"]
        mains[2]["objections"] = 17                                # dropped; the answer still counts
        themes = {"themes": [{"id": "th_x", "theme": "x"}], "tags": [{"responseId": ["r"], "objectionIndex": 0, "themeId": ["th_x"]}]}
        res, _ = evaluate.evaluate(INTAKE, self.pos, self.req, bad, themes, 42)
        self.assertEqual((res["skipped"], res["answered"]), (2, 46))

    def test_answers_to_an_older_build_are_refused(self):
        old = copy.deepcopy(self.resps)
        old["requestFingerprint"] = "000000000000"
        with self.assertRaises(SystemExit):
            evaluate.evaluate(INTAKE, self.pos, self.req, old, None, 42)
        del old["requestFingerprint"]
        self.assertTrue(any("requestFingerprint" in w for w in evaluate.evaluate(INTAKE, self.pos, self.req, old, None, 42)[1]))

    def test_theme_counting_and_untagged_warning(self):
        themes = demo.tag_themes(self.resps)
        themes["tags"] = themes["tags"][:5] + [{"responseId": "nope", "objectionIndex": 0, "themeId": "th_price"}]
        themes["themes"].append({"id": "th_price", "theme": "duplicate"})
        res, warnings = evaluate.evaluate(INTAKE, self.pos, self.req, self.resps, themes, 42)
        self.assertEqual(sum(t["count"] for t in res["objectionThemes"]), 5)
        for text in ("no theme tag", "used twice", "ignored theme tag"):
            self.assertTrue(any(text in w for w in warnings), text)

    def test_empty_group_raises_small_sample(self):
        intake = copy.deepcopy(INTAKE)
        intake["segments"].append({**intake["segments"][1], "id": "seg_3", "isOwnerGuess": False})
        res, _ = evaluate.evaluate(intake, self.pos, self.req, self.resps, None, 42)
        self.assertIn("small-sample", res["confidenceFlags"])

    def test_fake_results_say_so_in_data(self):
        res = RUN["experiment-results.json"]
        self.assertEqual(res["schemaVersion"], 1)
        self.assertTrue(res["_note"].startswith("FAKE"))

    def test_demo_fixtures_are_reproducible(self):
        """fixtures/demo files come from tests/demo_pipeline.py; rerun it if this fails on purpose."""
        for name in ("positioning-set.json", "experiment-request.json", "experiment-results.json"):
            self.assertEqual(RUN[name], demo.load(name), name)


class Commands(unittest.TestCase):
    def test_documented_commands_run_from_a_workspace(self):
        with tempfile.TemporaryDirectory() as ws:
            run = lambda *a: subprocess.run([sys.executable, "-I", *map(str, a)], capture_output=True, text=True)  # noqa: E731
            (Path(ws) / "intake.json").write_text(json.dumps(INTAKE))
            (Path(ws) / "message-drafts.json").write_text(json.dumps(DRAFTS))
            self.assertEqual(run(SCRIPTS / "build_test.py", f"{ws}/intake.json", f"{ws}/message-drafts.json").returncode, 2)  # --out-dir required
            built = run(SCRIPTS / "build_test.py", f"{ws}/intake.json", f"{ws}/message-drafts.json", "--out-dir", ws,
                        "--current-creative", demo.CURRENT_CREATIVE, "--category", "fitness app")
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            files = [f"{ws}/{n}" for n in ("intake.json", "positioning-set.json", "experiment-request.json", "customer-responses.json")]
            self.assertEqual(run(SCRIPTS / "fake_responses.py", *files[:3], "--out", files[3]).returncode, 0)
            self.assertTrue(run(SCRIPTS / "evaluate.py", *files, "--list-objections").stdout.strip())
            self.assertEqual(run(SCRIPTS / "evaluate.py", *files, "--out", f"{ws}/experiment-results.json").returncode, 0)
            rendered = run(SCRIPTS / "render_results.py", f"{ws}/experiment-results.json", files[1], files[0], "-o", f"{ws}/results.md")
            self.assertEqual(rendered.returncode, 0, rendered.stderr)
            text = Path(ws, "results.md").read_text()
            self.assertIn("FAKE", text)
            self.assertNotIn("thin-evidence", text)  # flags are shown in plain words


if __name__ == "__main__":
    unittest.main()
