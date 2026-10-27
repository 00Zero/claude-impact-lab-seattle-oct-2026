"""Blindness: nothing outside the allow-list (results, the owner's copy, file names) can reach any prompt.

Canary diff, not substring search: set every denied field to a canary value, rebuild every request, and
require the requests to be byte-identical to the originals.
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest

import helpers
import evaluate
import personas

CANARY = "CANARY-7f3a"
DENIED_TOP_LEVEL = ("business", "baseline", "priorExperiments", "creatives", "constraints", "interests", "overlaps",
                    "hypotheses", "icp", "roughMessaging", "evidence", "findings", "skeptic", "readiness",
                    "openQuestions", "mode")
DENIED_SEGMENT_FIELDS = ("name", "isOwnerGuess", "ownerRank", "sampleShare", "channels", "serviceability")


def requests_for(intake_path: str, assets: list[str] | None = None) -> str:
    args = evaluate.parse_args(["estimate"] + helpers.common_args(intake=intake_path, assets=assets) + ["--crowd"])
    setup = evaluate.prepare(args)
    return json.dumps([setup.bodies[c.id] for c in setup.calls], sort_keys=True)


def canaried(brief: dict) -> dict:
    for key in DENIED_TOP_LEVEL:
        brief[key] = CANARY if not isinstance(brief.get(key), list) else [CANARY]
    brief["schemaVersion"] = 1
    for segment in brief["segments"]:
        for key in DENIED_SEGMENT_FIELDS:
            segment[key] = CANARY
    for lex in brief["lexicon"]:
        if lex.get("voice") != "customer":
            lex["phrase"] = CANARY
    return brief


# The only brief paths a prompt may depend on. Everything else gets a canary in test_every_other_value.
ALLOWED = {("schemaVersion",), ("segments", "*", "id"), ("segments", "*", "description"),
           ("segments", "*", "attributes", "*", "name"), ("segments", "*", "attributes", "*", "values", "*", "value"),
           ("segments", "*", "attributes", "*", "values", "*", "weight"),
           ("segments", "*", "needs"), ("segments", "*", "barriers"),
           ("segments", "*", "decisionCriteria"), ("segments", "*", "concernBundles", "*", "concernIds"),
           ("segments", "*", "concernBundles", "*", "weight"), ("concerns", "*", "id"), ("concerns", "*", "label"),
           ("concerns", "*", "definition"), ("lexicon", "*", "phrase"), ("lexicon", "*", "segmentIds"),
           ("lexicon", "*", "voice")}


def walk(value: object, path: tuple = ()) -> object:
    """Replace every value outside ALLOWED with a canary of the same kind, keeping the shape."""
    generic = tuple("*" if isinstance(p, int) else p for p in path)
    if any(generic[:len(a)] == a for a in ALLOWED):
        return value
    if isinstance(value, dict):
        return {k: walk(v, path + (k,)) for k, v in value.items()}
    if isinstance(value, list):
        return [walk(v, path + (i,)) for i, v in enumerate(value)]
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, (int, float)):
        return 987654
    return CANARY


class BlindnessTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp()

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp)

    def test_denied_fields_never_change_a_request(self) -> None:
        original = requests_for(helpers.DEMO_INTAKE)
        brief = helpers.demo_brief()
        brief["lexicon"].append({"id": "lex_owner", "phrase": "owner wording", "segmentIds": ["seg_1"],
                                 "evidenceId": "ev_1", "voice": "owner"})
        with_owner_phrase = requests_for(helpers.write_json(os.path.join(self.tmp, "a.json"), brief))
        self.assertEqual(original, with_owner_phrase)
        changed = requests_for(helpers.write_json(os.path.join(self.tmp, "b.json"), canaried(helpers.demo_brief())))
        self.assertEqual(original, changed)
        self.assertNotIn(CANARY, changed)

    def test_every_other_value(self) -> None:
        # Deeper than the field list above: every nested value outside the allow-list (evidence ids, ranks,
        # bundle counts, the owner's lexicon entries' ids...) is replaced, and no request may change.
        brief = walk(helpers.demo_brief())
        brief["lexicon"] = [lex for lex in brief["lexicon"] if lex.get("voice") == "customer"]
        changed = requests_for(helpers.write_json(os.path.join(self.tmp, "w.json"), brief))
        self.assertEqual(requests_for(helpers.DEMO_INTAKE), changed)

    def test_file_names_never_reach_a_prompt(self) -> None:
        renamed = []
        for i, path in enumerate(helpers.DEMO_IMAGES):
            target = os.path.join(self.tmp, f"winner-{i}.png")
            shutil.copy(path, target)
            renamed.append(target)
        self.assertEqual(requests_for(helpers.DEMO_INTAKE), requests_for(helpers.DEMO_INTAKE, ["--images"] + renamed))

    def test_allowed_fields_do_reach_prompts(self) -> None:
        # The other side of the allow-list: a changed need must show up, or the canary test proves nothing.
        brief = helpers.demo_brief()
        brief["segments"][0]["needs"] = [CANARY]
        changed = requests_for(helpers.write_json(os.path.join(self.tmp, "c.json"), brief))
        self.assertIn(CANARY, changed)

    def test_only_customer_voice_phrases_are_used(self) -> None:
        brief = helpers.demo_brief()
        people, _ = personas.draw_personas(brief, 48, 7)
        customer = {lex["phrase"] for lex in brief["lexicon"] if lex.get("voice") == "customer"}
        self.assertTrue(all(set(p.voice) <= customer for p in people))


if __name__ == "__main__":
    unittest.main()
