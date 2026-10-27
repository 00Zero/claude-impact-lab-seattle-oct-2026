"""mechanical.py: deterministic checks."""
import pytest

from scorers.naive import mechanical


def checks(result):
    return {f["check"] for f in result["findings"]}


def test_good_short_draft_passes():
    r = mechanical.check(
        "Hi Dana,\nSaw your crew just took on the Fremont remodel. "
        "Do you need a second drywall team for it?",
        recipient_context="Owner of a remodeling firm, just started the Fremont remodel",
    )
    assert r["score"] == 100
    assert "fremont" in r["recipient_terms_found"]


def test_long_cold_email_capped():
    r = mechanical.check("word " * 200 + "?")
    f = next(f for f in r["findings"] if f["check"] == "length")
    assert f["cap"]


def test_follow_up_ceiling_is_shorter():
    assert mechanical.check("word " * 80 + "?", message_type="follow_up")["findings"]
    assert not mechanical.check("word " * 80 + "?", message_type="cold")["findings"]


def test_no_ask_and_many_asks():
    assert "ask" in checks(mechanical.check("You will like this."))
    assert "ask" in checks(mechanical.check("You? You? You?"))


def test_sender_focused_draft_flagged():
    assert "you_i_ratio" in checks(mechanical.check("We are great. Our team is great. Can I call?"))


def test_no_recipient_detail_is_a_cap():
    r = mechanical.check("Do you want a demo?", recipient_context="Runs a bakery in Tacoma")
    f = next(f for f in r["findings"] if f["check"] == "personalization")
    assert f["cap"]


def test_company_name_alone_is_not_personalization():
    r = mechanical.check(
        "Hi Dana, Northside Remodeling looks great. Want a demo?",
        recipient_context="Dana owns Northside Remodeling in Seattle",
        recipient_name="Dana", recipient_company="Northside Remodeling",
    )
    assert "personalization" in checks(r)


def test_recipient_terms_skip_generic_words():
    terms = mechanical.recipient_terms(
        "Runs a 14-person shop in Tacoma. Spreadsheets aren't cutting it for scheduling.")
    assert terms == ["tacoma", "spreadsheets", "scheduling"]


def test_uniform_sentence_length_flagged():
    even = ("We build tools for busy teams. They save hours every single week. "
            "Our clients love the simple setup. Can we show you a demo?")
    assert "uniform_sentences" in checks(mechanical.check(even))


def test_varied_sentence_length_passes():
    varied = ("Saw the Fremont job. Scheduling two crews across three sites while "
              "the inspector keeps moving dates is brutal, and we fixed exactly that "
              "for a shop your size last spring. Worth ten minutes?")
    assert "uniform_sentences" not in checks(mechanical.check(varied))


def test_no_contractions_flagged():
    stiff = "I am writing because we are a good fit. It is quick. Do you want a call?"
    assert "no_contractions" in checks(mechanical.check(stiff))
    assert "no_contractions" not in checks(mechanical.check(
        "I'm writing because we're a good fit. It is quick. Want a call?"))


def ids(text, **kw):
    found, reminders = mechanical.disqualifiers(text, **kw)
    return [d["id"] for d in found], reminders


@pytest.mark.parametrize("text,expected", [
    ("Hi {FirstName}, want a demo?", "B9"),
    ("Hi [First Name], want a demo?", "B9"),
    ("Hi ,\nWant a demo?", "B9"),
    ("Certainly! Here's a draft:\n\nHi Dana, want a demo?", "P20a"),
    ("Hi Dana, want a demo?\n\nI hope this helps!", "P20a"),
    ("As of my last update, your firm has 14 staff. Want a demo?", "P21"),
    ("Hi Dana, our **new scheduler** ships Friday. Want a demo?", "B16"),
])
def test_disqualifying_tells(text, expected):
    assert expected in ids(text)[0]


def test_fake_thread_subject_only_on_first_messages():
    assert ids("Hi Dana, want a demo?", subject="Re: scheduling")[0] == ["B8"]
    assert ids("Hi Dana, any update?", subject="Re: scheduling", message_type="follow_up")[0] == []


def test_merge_fields_in_a_list_template_are_a_reminder():
    found, reminders = ids("Hi [First Name], your rate becomes [New Rate] on Dec 1.", merge_fields_ok=True)
    assert found == [] and "[First Name]" in reminders[0] and "[New Rate]" in reminders[0]


def test_clean_draft_and_exemptions_pass():
    clean = "Hi Dana,\nSaw your Fremont post [1]. Want a demo Friday?\n\n> Re: old thread **quoted**\n-- \nSam [Sales]"
    assert ids(clean) == ([], [])


def test_plain_hi_comma_is_not_a_missing_name():
    assert ids("Hi,\nYour rate goes up 12% on December 1.")[0] == []
