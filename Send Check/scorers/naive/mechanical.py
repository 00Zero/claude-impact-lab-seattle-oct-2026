"""Deterministic checks, no model calls.

Each check that fails adds a finding and deducts points from 100. Findings
marked "cap" are serious enough that the draft should not get a "send"
verdict until they are fixed.
"""
from __future__ import annotations

import re
import statistics

# Word ceilings per message type, from the "Length" table in Anthropic's
# outreach-composer slop_test.md (see corpus/ATTRIBUTION.md).
LENGTH_CEILINGS = {
    "cold": 120,
    "follow_up": 60,
    "warm": 150,
    "post_meeting": 100,
    "customer": 150,    # Send Check default for emails to existing customers
}

YOU_WORDS = {"you", "your", "yours", "you're", "you've", "you'll", "you'd"}
SELF_WORDS = {"i", "i'm", "i've", "i'd", "i'll", "me", "my", "we", "we're",
              "we've", "we'll", "our", "us"}

# Words too common to count as evidence of knowing the recipient.
STOPWORDS = {
    "about", "after", "again", "their", "there", "these", "those", "which",
    "while", "where", "would", "could", "should", "being", "other", "people",
    "years", "working", "works", "based", "business", "company", "companies",
    "team", "teams", "experience", "currently", "previously", "including",
    "focused", "helping", "through", "across", "within", "years'", "also",
}


CONTRACTION = re.compile(
    r"\b(\w+n't|\w+'re|\w+'ve|\w+'ll|\w+'d|i'm|(it|that|there|what|let|here|he|she|who)'s)\b")
UNCONTRACTED = re.compile(
    r"\b(i am|i have|i will|i would|we are|we have|we will|you are|it is|that is|"
    r"do not|does not|did not|cannot|will not|would not|is not|are not|let us)\b")


def sentences(text: str) -> list[str]:
    """Body sentences of 3+ words; greeting and sign-off lines drop out."""
    parts = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    return [p for p in parts if len(p.split()) >= 3]


def count_contractions(text: str) -> tuple[int, int]:
    """(contractions, uncontracted forms that could have been contractions)."""
    lower = text.lower().replace("’", "'")
    return len(CONTRACTION.findall(lower)), len(UNCONTRACTED.findall(lower))


# Disqualifying tells from docs/humanization-rubric.md (Part 4): each shows
# nobody checked the message before it went out. IDs match that rubric.
MERGE_FIELD = re.compile(r"\{\{?\s*[A-Za-z_][\w .]*\}\}?|\[(?:[A-Z][\w']*(?: [A-Za-z#][\w']*){0,3})\]")
# "Hi ," is a name that merged as blank; a plain "Hi," is a normal greeting
EMPTY_GREETING = re.compile(r"^(hi|hello|hey|dear|good (?:morning|afternoon|evening))[ \t]+,", re.I | re.M)
ASSISTANT_ARTIFACT = re.compile(
    r"^\s*(?:certainly|sure|absolutely|of course)[!,.]?\s+here(?:'s| is)\b|"
    r"\bhere(?:'s| is) (?:a|the|your) (?:draft|revised|rewritten|polished|version)\b|"
    r"\bi hope this helps\b|\bwould you like me to\b|\blet me know if you(?:'d| would) like me to\b|"
    r"\bas an ai\b|\bsubject line options\b", re.I | re.M)
CUTOFF_DISCLAIMER = re.compile(
    r"\bas of my (?:last|latest) (?:update|knowledge)\b|\bmy (?:knowledge|training) cutoff\b|"
    r"\bwhile specific details are limited\b", re.I)
FAKE_THREAD = re.compile(r"^\s*(?:re|fwd?)\s*:", re.I)
MARKDOWN_RESIDUE = re.compile(r"\*\*[^*\n]+\*\*|^#{1,6} \S|`[^`\n]+`", re.M)


def message_body(text: str) -> str:
    """The writer's own words: drop quoted reply lines and the signature block."""
    text = text.replace("’", "'").split("\n-- \n", 1)[0]
    return "\n".join(l for l in text.splitlines() if not l.lstrip().startswith(">"))


def disqualifiers(text: str, subject: str = "", message_type: str = "cold",
                  merge_fields_ok: bool = False) -> tuple[list[dict], list[str]]:
    """Disqualifying tells, each with its rubric ID and the exact span, plus reminders.

    Merge fields like [First Name] are expected in a template sent to a list
    (merge_fields_ok), so there they become a reminder instead.
    """
    body = message_body(text)
    found, reminders = [], []

    def hit(tell_id, tell, m):
        found.append({"id": tell_id, "tell": tell, "span": m.group(0).strip()})

    fields = sorted({m.group(0) for m in MERGE_FIELD.finditer(body)})
    if fields and merge_fields_ok:
        reminders.append(f"fill the merge fields before sending: {', '.join(fields)}")
    elif fields:
        found.append({"id": "B9", "tell": "unfilled merge field", "span": fields[0]})
    if m := EMPTY_GREETING.search(body):
        hit("B9", "greeting with the name missing", m)
    if m := ASSISTANT_ARTIFACT.search(body):
        hit("P20a", "leftover assistant text", m)
    if m := CUTOFF_DISCLAIMER.search(body):
        hit("P21", "AI cutoff disclaimer", m)
    if subject and message_type != "follow_up" and (m := FAKE_THREAD.search(subject)):
        hit("B8", "Re:/Fwd: on a first message", m)
    if m := MARKDOWN_RESIDUE.search(body):
        hit("B16", "markdown symbols that plain-text email shows literally", m)
    return found, reminders


def recipient_terms(context: str, exclude: str = "") -> list[str]:
    """Distinctive words from recipient context (bio, CRM notes, site copy).

    Counts proper nouns (a capitalized word mid-sentence, like "Fremont")
    and long specific words (8+ letters, like "spreadsheets"); short common
    words match drafts by accident. Words in `exclude` (the recipient's name
    and company) are left out on purpose: merging those into a template is
    not personalization.
    """
    skip = STOPWORDS | {w.lower() for w in re.findall(r"[A-Za-z']+", exclude)}
    seen = []
    for m in re.finditer(r"[A-Za-z][A-Za-z']+", context):
        w, lw = m.group(), m.group().lower()
        before = context[:m.start()].rstrip()
        sentence_start = not before or before[-1] in '.!?:"“'
        proper = w[0].isupper() and not sentence_start and len(w) >= 3
        if (proper or len(w) >= 8) and lw not in skip and lw not in seen:
            seen.append(lw)
    return seen


def check(text: str, message_type: str = "cold",
          recipient_context: str = "", recipient_name: str = "",
          recipient_company: str = "") -> dict:
    """Run every mechanical check; return score (0-100) and findings."""
    findings = []
    norm = text.replace("’", "'")
    words = re.findall(r"[A-Za-z0-9']+", norm)
    n_words = len(words)
    lower = [w.lower() for w in words]

    def add(name, points, detail, cap=False):
        findings.append({"check": name, "points": points, "detail": detail, "cap": cap})

    # Length
    ceiling = LENGTH_CEILINGS.get(message_type, LENGTH_CEILINGS["cold"])
    if n_words > ceiling:
        ratio = n_words / ceiling
        add("length", 10 if ratio <= 1.25 else 20,
            f"{n_words} words; a {message_type.replace('_', ' ')} message should be under {ceiling}",
            cap=ratio > 1.5)

    # You/I balance
    n_you = sum(w in YOU_WORDS for w in lower)
    n_self = sum(w in SELF_WORDS for w in lower)
    if n_self > n_you and n_self >= 3:   # one "us" in a two-line notice is not a pattern
        add("you_i_ratio", 10,
            f"talks about the sender more than the reader ({n_self} I/we vs {n_you} you)")

    # Ask count
    n_asks = len(re.findall(r"\?", norm))
    if n_asks == 0 and message_type != "customer":   # notices to customers need no question
        add("ask", 10, "no question for the reader to answer; the ask is unclear")
    elif n_asks > 1:
        add("ask", min(15, 5 * (n_asks - 1)),
            f"{n_asks} questions; one small ask gets more replies")

    # Em-dash density
    n_dashes = norm.count("—") + norm.count(" -- ")
    if n_words and n_dashes * 100 / n_words > 1:
        add("em_dash", 5, f"{n_dashes} em dashes in {n_words} words, a common AI tell")

    # Uniform paragraph length
    paras = [len(p.split()) for p in re.split(r"\n\s*\n", norm.strip()) if len(p.split()) >= 5]
    if len(paras) >= 3 and statistics.pstdev(paras) / statistics.mean(paras) < 0.15:
        add("uniform_paragraphs", 5,
            f"{len(paras)} paragraphs of nearly the same length ({paras}), a common AI tell")

    # Uniform sentence length: people mix short and long sentences
    lengths = [len(s.split()) for s in sentences(norm)]
    if len(lengths) >= 4 and statistics.pstdev(lengths) / statistics.mean(lengths) < 0.25:
        add("uniform_sentences", 5,
            f"{len(lengths)} sentences of nearly the same length ({lengths}); people vary theirs")

    # No contractions: "I am writing to" reads stiffer than "I'm writing"
    n_contracted, n_uncontracted = count_contractions(norm)
    if n_uncontracted >= 2 and n_contracted == 0:
        add("no_contractions", 5,
            f"{n_uncontracted} spots like \"I am\" or \"do not\" and no contractions; reads formal")

    # Exactly three parallel bullets
    bullet = re.compile(r"^\s*([-*•]|\d+[.)])\s+")
    runs, run = [], 0
    for line in norm.splitlines():
        if bullet.match(line):
            run += 1
        else:
            if run:
                runs.append(run)
            run = 0
    if run:
        runs.append(run)
    if 3 in runs:
        add("three_bullets", 5, "a list of exactly three bullets, a common AI tell")

    # Personalization tokens
    terms = recipient_terms(recipient_context, exclude=f"{recipient_name} {recipient_company}")
    found = [t for t in terms if re.search(r"(?<!\w)" + re.escape(t) + r"(?!\w)", norm.lower())]
    if terms and not found:
        add("personalization", 15,
            "nothing from the recipient's context appears in the draft", cap=True)

    penalty = sum(f["points"] for f in findings)
    return {
        "score": max(0, 100 - penalty),
        "words": n_words,
        "length_ceiling": ceiling,
        "recipient_terms_found": found,
        "findings": findings,
    }
