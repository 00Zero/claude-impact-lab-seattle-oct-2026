"""Focused checks for behavior the demo depends on: grounding, omission rules,
quote fidelity, preference extraction without patient facts, and version safety."""

import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))

import coach  # noqa: E402
from store import Store  # noqa: E402

PREFS = coach.DEFAULT_STYLES[0]["preferences"]
TRANSCRIPT = 'Client: I call it "the Siren." It keeps sounding the alarm.\nTherapist: Let\'s come back to that next time.'
META_NO_ACTIONS = {"names": ["Priya"], "explicitNextActions": False}
META_ACTIONS = {"names": ["Priya"], "explicitNextActions": True}

GOOD = """Client Discussed:
The client described a worry they call "the Siren." The client reported it sounds the alarm most mornings.

Therapist Contribution:
The therapist used externalization by inviting the client to name the worry. The therapist asked how much of the day the worry took up."""


def status(checks, cid):
    return [c["status"] for c in checks if c["id"] == cid]


class Checks(unittest.TestCase):
    def test_good_note_passes(self):
        checks = coach.check_note(GOOD, PREFS, META_NO_ACTIONS, TRANSCRIPT)
        self.assertEqual(coach.failed_ids(checks), [])

    def test_numbered_and_bold_headings_are_recognized(self):
        note = GOOD.replace("Client Discussed:", "1. **Client Discussed:**").replace("Therapist Contribution:", "2. Therapist Contribution:")
        checks = coach.check_note(note, PREFS, META_NO_ACTIONS, TRANSCRIPT)
        self.assertEqual(status(checks, "sections_present"), ["pass"])
        self.assertEqual(status(checks, "no_preamble"), ["pass"])

    def test_optional_section_included_without_support_fails(self):
        note = GOOD + "\n\nNext Actions:\nThe client will journal daily about the worry."
        self.assertEqual(status(coach.check_note(note, PREFS, META_NO_ACTIONS, TRANSCRIPT), "optional_omission"), ["fail"])

    def test_placeholder_instead_of_omission_fails(self):
        for filler in ("None", "N/A", "", "Yes."):
            note = GOOD + "\n\nNext Actions: " + filler
            self.assertEqual(status(coach.check_note(note, PREFS, META_NO_ACTIONS, TRANSCRIPT), "optional_omission"), ["fail"], filler)
            self.assertEqual(status(coach.check_note(note, PREFS, META_ACTIONS, TRANSCRIPT), "optional_omission"), ["fail"], filler)

    def test_invented_quote_fails(self):
        note = GOOD.replace('"the Siren."', '"I am completely hopeless."')
        self.assertEqual(status(coach.check_note(note, PREFS, META_NO_ACTIONS, TRANSCRIPT), "quotes_exact"), ["fail"])

    def test_required_quote_flags_missing_source_quote_but_not_absent_quote(self):
        prefs = dict(PREFS, quotes={"max": 1, "requireWhenAvailable": True})
        self.assertEqual(status(coach.check_note(GOOD.replace('The client described a worry they call "the Siren."', "The client described worry."), prefs, META_NO_ACTIONS, TRANSCRIPT), "quotes_exact"), ["fail"])
        no_quote_source = "Client: The worry felt loud.\nTherapist: We will return to it next time."
        no_quote_note = "Client Discussed:\nThe client said the worry felt loud.\n\nTherapist Contribution:\nThe therapist listened and will return to it next time."
        self.assertEqual(status(coach.check_note(no_quote_note, prefs, META_NO_ACTIONS, no_quote_source), "quotes_exact"), ["pass"])

    def test_repeating_one_quote_counts_once(self):
        note = GOOD.replace("most mornings.", 'most mornings, and "the Siren" is loud.')
        self.assertEqual(status(coach.check_note(note, dict(PREFS, quotes={"max": 1}), META_NO_ACTIONS, TRANSCRIPT), "quotes_exact"), ["pass"])

    def test_client_quote_credited_to_therapist_fails(self):
        transcript = "Therapist: What helped?\nClient: I can hear that it felt that way."
        note = GOOD.replace('The therapist used externalization by inviting the client to name the worry.',
                            'The therapist used validation, saying "I can hear that it felt that way."')
        checks = coach.check_note(note, PREFS, META_NO_ACTIONS, transcript + "\n" + TRANSCRIPT)
        self.assertEqual(status(checks, "quote_attribution"), ["fail"])
        self.assertEqual(status(coach.check_note(GOOD, PREFS, META_NO_ACTIONS, TRANSCRIPT), "quote_attribution"), ["pass"])

    def test_attribution_is_judged_per_sentence_across_sections(self):
        transcript = 'Client: I just want to know they still care.\nTherapist: It is a dance neither of you chose.'
        note = ('Client Discussed:\nThe client stated, "I just want to know they still care."\n\n'
                'Therapist Contribution:\nThe therapist described "a dance neither of you chose."')
        self.assertEqual(status(coach.check_note(note, PREFS, META_NO_ACTIONS, transcript), "quote_attribution"), ["pass"])

    def test_names_and_gendered_pronouns_fail(self):
        note = GOOD.replace("The therapist asked", "Priya asked her")
        checks = coach.check_note(note, PREFS, META_NO_ACTIONS, TRANSCRIPT)
        self.assertEqual(status(checks, "no_names"), ["fail"])
        self.assertEqual(status(checks, "pronouns"), ["fail"])

    def test_repeated_section_fails(self):
        checks = coach.check_note(GOOD + "\n\n" + GOOD, PREFS, META_NO_ACTIONS, TRANSCRIPT)
        self.assertEqual(status(checks, "no_repeats"), ["fail"])


class Extraction(unittest.TestCase):
    EXAMPLE = """Client Discussed:
The client reported that their sister Marisol moved to Denver in March. The client described "feeling left behind."

Therapist Contribution:
The therapist used externalization. The therapist asked relative influence questions.

Next Actions:
The client will call Marisol on Sunday."""

    def test_structure_kept_patient_facts_dropped(self):
        prefs = coach.extract_preferences(self.EXAMPLE)["preferences"]
        self.assertEqual([s["name"] for s in prefs["sections"]], ["Client Discussed", "Therapist Contribution", "Next Actions"])
        self.assertFalse(prefs["sections"][2]["required"])
        compiled = coach.compile_prompt(prefs)
        for fact in ("Marisol", "Denver", "March", "left behind", "Sunday"):
            self.assertNotIn(fact, compiled)
            self.assertNotIn(fact, str(prefs))


class Samples(unittest.TestCase):
    def test_every_sample_note_parses_with_optional_last_section(self):
        samples = coach.load_samples()
        self.assertEqual(len(samples), 4)
        for x in samples:
            self.assertTrue(x["text"].startswith("FICTIONAL SAMPLE NOTE"), x["id"])
            secs = coach.extract_preferences(x["text"])["preferences"]["sections"]
            self.assertGreaterEqual(len(secs), 3, x["id"])
            self.assertFalse(secs[-1]["required"], x["id"])
            self.assertTrue(all(s["required"] for s in secs[:-1]), x["id"])

    def test_every_fixture_is_labeled_fictional(self):
        m = coach.load_fixture_manifest()
        for fid, meta in m["fixtures"].items():
            if meta.get("library"):
                continue  # provenance documented in examples/sample-transcripts/README.md
            first = (coach.FIXTURE_DIR / meta["file"]).read_text().splitlines()[0]
            self.assertTrue(first.startswith("FICTIONAL TRANSCRIPT"), fid)
        for nt in m["noteTypes"]:
            self.assertEqual(len(set(nt["fixtures"].values())), 3, "A, B and C must be different transcripts")


class Library(unittest.TestCase):
    def test_library_sessions_load_and_fit_context(self):
        import ollama
        m = coach.load_fixture_manifest()
        readme = (coach.ROOT / "examples" / "sample-transcripts" / "README.md").read_text()
        self.assertIn("fictional", readme.lower())
        prompt = coach.compile_prompt(PREFS)
        for fid in m["library"]["sessions"]:
            ollama.check_context_budget(prompt, coach.user_message(coach.load_transcript(fid)))

    def test_unannotated_session_asks_clinician_instead_of_guessing(self):
        meta = {"names": [], "explicitNextActions": None}
        with_actions = GOOD + "\n\nNext Actions:\nThe client will rest this evening."
        self.assertEqual(status(coach.check_note(with_actions, PREFS, meta, TRANSCRIPT), "optional_omission"), ["warn"])
        self.assertEqual(status(coach.check_note(GOOD + "\n\nNext Actions: None", PREFS, meta, TRANSCRIPT), "optional_omission"), ["fail"])


class Compilation(unittest.TestCase):
    def test_grounding_survives_every_feedback_change(self):
        new, changes, _ = coach.apply_feedback(PREFS, list(coach.FEEDBACK_TAGS), "Keep it warm.", {"name": "Diagnosis"})
        self.assertTrue(changes)
        self.assertTrue(coach.prompt_keeps_grounding(coach.compile_prompt(new)))
        self.assertEqual(PREFS["emphasis"], [], "feedback must not mutate the original preferences")

    def test_feedback_without_reason_proposes_nothing(self):
        self.assertEqual(coach.apply_feedback(PREFS, [], "")[1], [])

    def test_conflicting_length_tags_change_nothing_and_explain(self):
        new, changes, notes = coach.apply_feedback(PREFS, ["too_long", "omitted_content"], "")
        self.assertEqual(changes, [])
        self.assertEqual(coach.compile_prompt(new), coach.compile_prompt(PREFS))
        self.assertTrue(notes)

    def test_added_section_is_optional_and_before_trailing_optional(self):
        new, changes, notes = coach.apply_feedback(PREFS, [], "", {"name": "Diagnosis"})
        names = [s["name"] for s in new["sections"]]
        self.assertEqual(names, ["Client Discussed", "Therapist Contribution", "Diagnosis", "Next Actions"])
        self.assertFalse(new["sections"][2]["required"])
        self.assertIn("Diagnosis", coach.compile_prompt(new))
        self.assertTrue(any("invent" in n for n in notes))

    def test_prompt_diff_shows_added_instruction(self):
        new, _, _ = coach.apply_feedback(PREFS, [], "Keep it warm.")
        diff = coach.prompt_diff(coach.compile_prompt(PREFS), coach.compile_prompt(new))
        self.assertIn({"op": "add", "text": "- Keep it warm."}, diff)

    def test_vague_feedback_gets_focused_clarification_without_model_call(self):
        result = coach.interpret_feedback(PREFS, "make it better", [], None,
                                          lambda *_: self.fail("must not trust model for vague request"))
        self.assertEqual(result["kind"], "clarification")
        self.assertIn("Exactly one sentence per section", result["options"])

    def test_exact_sentence_and_conditional_quote_patch_preserve_other_fields(self):
        def infer(system, user):
            self.assertIn("Never return prompt text", system)
            return ('{"kind":"patch","patch":[{"path":"sentences.min","value":1},'
                    '{"path":"sentences.max","value":1},{"path":"quotes.max","value":1},'
                    '{"path":"quotes.requireWhenAvailable","value":true}],'
                    '"explanation":"One sentence and quote when source supports it."}'), {}
        result = coach.interpret_feedback(PREFS, "exactly one sentence and include a quote", [], None, infer)
        updated, _ = coach.apply_typed_patch(PREFS, result["patch"])
        self.assertEqual(updated["sentences"], {"min": 1, "max": 1})
        self.assertEqual(updated["quotes"], {"max": 1, "requireWhenAvailable": True})
        self.assertEqual(updated["sections"], PREFS["sections"])
        self.assertIn("when the transcript contains a suitable client phrase", coach.compile_prompt(updated))

    def test_interpreter_unknown_paths_and_oversized_patch_are_rejected(self):
        for content in (
            '{"kind":"patch","patch":[{"path":"prompt","value":"rewrite all"}]}',
            '{"kind":"patch","patch":[' + ','.join('{"path":"sentences.max","value":3}' for _ in range(5)) + ']}',
            '{"kind":"patch","patch":[{"path":"sentences.max","value":99}]}',
        ):
            result = coach.interpret_feedback(PREFS, "shorten the sections slightly", [], None, lambda *_: (content, {}))
            self.assertEqual(result["kind"], "no_change")

    def test_fenced_patch_without_kind_and_explicit_quote_intent_are_normalized(self):
        raw = '```json\n{"patch":[{"path":"sentences.max","value":1}],"explanation":"Shorter"}\n```'
        result = coach.interpret_feedback(PREFS,
            "Exactly one sentence per section and include one exact client quote when available", [], None,
            lambda *_: (raw, {}))
        self.assertEqual(result["kind"], "patch")
        after, _ = coach.apply_typed_patch(PREFS, result["patch"])
        self.assertEqual(after["sentences"], {"min": 1, "max": 1})
        self.assertGreaterEqual(after["quotes"]["max"], 1)
        self.assertTrue(after["quotes"]["requireWhenAvailable"])

    def test_invalid_json_shapes_paths_and_unhashable_emphasis_fail_closed(self):
        for raw in (
            '[]', '"patch"',
            '{"kind":"patch","patch":[{"path":[],"value":1}]}',
            '{"kind":"patch","patch":[{"path":"emphasis","value":[{}]}]}',
            '{"kind":"patch","patch":[{"path":"emphasis","value":[[]]}]}',
        ):
            with self.subTest(raw=raw):
                result = coach.interpret_feedback(PREFS, "shorter please", [], None, lambda *_: (raw, {}))
                self.assertEqual(result["kind"], "no_change")

    def test_empty_clarification_uses_focused_fallback(self):
        result = coach.interpret_feedback(PREFS, "shorter please", [], None,
            lambda *_: ('{"kind":"clarification"}', {}))
        self.assertTrue(result["question"])
        self.assertTrue(result["options"])

    def test_malformed_interpreter_response_is_no_change(self):
        result = coach.interpret_feedback(PREFS, "shorter", [], None, lambda *_: ("not json", {}))
        self.assertEqual(result["kind"], "no_change")

    def test_new_optional_section_remains_optional_and_grounded(self):
        result = coach.interpret_feedback(PREFS, "", [], {"name": "Diagnosis"}, lambda *_: self.fail())
        updated, _ = coach.apply_typed_patch(PREFS, result["patch"])
        sec = next(s for s in updated["sections"] if s["name"] == "Diagnosis")
        self.assertFalse(sec["required"])
        self.assertIn("Only information explicitly stated", sec["guidance"])


class Versions(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(self.tmp.name)
        s = self.store.create_style("S", "default", "narrative")
        self.v1 = self.store.add_version(s["id"], PREFS, "p1", "first")
        self.v2 = self.store.add_version(s["id"], PREFS, "p2", "second", state="proposed", parent_id=self.v1["id"])
        self.sid = s["id"]

    def tearDown(self):
        self.tmp.cleanup()

    def test_draft_is_not_active_until_approved(self):
        self.assertIsNone(self.store.style(self.sid)["activeVersionId"])

    def test_activate_archives_previous_and_rollback_restores(self):
        self.store.activate(self.v1["id"])
        self.store.activate(self.v2["id"])
        self.assertEqual(self.store.version(self.v1["id"])["state"], "archived")
        self.assertTrue(self.store.activate(self.v1["id"]))  # restored
        self.assertEqual(self.store.style(self.sid)["activeVersionId"], self.v1["id"])
        self.assertEqual(self.store.version(self.v2["id"])["prompt"], "p2")

    def test_rejected_proposal_cannot_activate(self):
        self.store.decide(self.v2["id"], "rejected")
        with self.assertRaises(ValueError):
            self.store.activate(self.v2["id"])

    def test_events_drop_long_text(self):
        self.store.event("feedback_submitted", comment="x" * 200, tags=["too_long"])
        line = (Path(self.tmp.name) / "events.jsonl").read_text()
        self.assertNotIn("xxxx", line)
        self.assertIn("too_long", line)

    def _proposal(self, base, pid="p"):
        return self.store.add_proposal(id=pid, styleId=self.sid, runId="run",
            baseVersionId=base["id"], baseVersion=base["version"],
            patch=[{"path":"sentences.max", "before":4, "after":3}], status="pending")

    def test_rejected_or_deferred_proposal_does_not_block_later_confirmation(self):
        self.store.decide(self.v2["id"], "rejected")
        self.store.activate(self.v1["id"])
        prop = self._proposal(self.v1)
        version = self.store.confirm_proposal(prop["id"], self.v1["id"], PREFS, "compiled", "confirmed", {})
        self.assertEqual(version["state"], "proposed")

    def test_deferred_version_does_not_block_later_confirmation(self):
        self.store.decide(self.v2["id"], "deferred")
        prop = self._proposal(self.v1)
        version = self.store.confirm_proposal(prop["id"], self.v1["id"], PREFS, "compiled", "confirmed", {})
        self.assertEqual(version["state"], "proposed")

    def test_rollback_active_base_allows_matching_patch_and_changed_active_base_is_stale(self):
        self.store.activate(self.v1["id"])
        self.store.activate(self.v2["id"])
        self.store.activate(self.v1["id"])
        prop = self._proposal(self.v1)
        self.assertEqual(self.store.confirm_proposal(prop["id"], self.v1["id"], PREFS, "compiled", "ok", {})["state"], "proposed")
        other = self._proposal(self.v1, "p2")
        self.store.activate(self.v2["id"])
        with self.assertRaisesRegex(ValueError, "stale"):
            self.store.confirm_proposal(other["id"], self.v1["id"], PREFS, "compiled", "ok", {})

    def test_concurrent_confirm_and_decline_consume_proposal_once(self):
        prop = self._proposal(self.v2)
        gate = threading.Barrier(3)
        outcomes = []
        def confirm():
            gate.wait()
            try:
                self.store.confirm_proposal(prop["id"], self.v2["id"], PREFS, "compiled", "ok", {})
                outcomes.append("confirmed")
            except ValueError:
                outcomes.append("confirm_rejected")
        def decline():
            gate.wait()
            try:
                self.store.decide_proposal(prop["id"], "declined")
                outcomes.append("declined")
            except ValueError:
                outcomes.append("decline_rejected")
        threads = [threading.Thread(target=confirm), threading.Thread(target=decline)]
        for t in threads: t.start()
        gate.wait()
        for t in threads: t.join()
        self.assertEqual(sum(x in ("confirmed", "declined") for x in outcomes), 1)
        self.assertEqual(len(self.store.versions_of(self.sid)), 3 if "confirmed" in outcomes else 2)


if __name__ == "__main__":
    unittest.main()
