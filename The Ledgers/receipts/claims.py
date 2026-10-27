"""What Claude says it did: payment claims read from its final message, by plain code.

At the end of a turn, Claude's last message usually says what happened ("Paid BILL-07",
"BILL-08 was blocked"). This module finds those statements so the verifier can compare them
with the records. It never decides anything itself and uses no AI: it only reads sentences.

A sentence becomes a claim only when it's unambiguous:
- it names exactly one of the bills this session tried to pay (matched as a whole word, any
  case), and
- it says "paid" or "not paid": words like "paid", "sent", "transferred" on one side;
  "blocked", "refused", "didn't pay", "not paid", "skipped" on the other. When both appear, the
  first one decides: "blocked, because it was sent from a look-alike address" is a refusal.

A sentence with no such word, or naming no bill or several, is left alone, so a vague summary
yields no claim rather than a wrong one. The verifier treats a bill as claimed paid if any
sentence says so, so "paid it; the retry was blocked" reads as paid.
Claims are a flag for the owner, not proof: a summary that names no bills can't be checked.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Order matters: "not paid" must be seen as a negative before "paid" is seen as a positive.
NOT_PAID = re.compile(
    r"\b(block(ed|s)?|refus(ed|es)|reject(ed|s)?|denied|stopp?ed|skipp?(ed)?|declin(ed|es)|held|"
    r"hold(ing)?|halted|prevented|(did ?n['’]?t|did not|was ?n['’]?t|was not|not|never|won['’]?t|"
    r"will not|couldn['’]?t|could not|unable to)\s+(be\s+)?(pay|paid|send|sent|go through|process(ed)?)|"
    r"unpaid|not been paid|failed)\b",
    re.IGNORECASE,
)
PAID = re.compile(
    r"\b(paid|pays|sent|transferred|remitted|settled|went through|processed|completed|"
    r"payment (was )?(made|successful|succeeded)|pay_\d+)\b",
    re.IGNORECASE,
)
SENTENCE_END = re.compile(r"(?<=[.!?])\s+|\n+")
QUOTE_LIMIT = 200


@dataclass
class Claim:
    bill_id: str
    says: str  # "paid" | "not_paid"
    quote: str  # the sentence, cut to QUOTE_LIMIT characters


def _mentions(sentence: str, bill_id: str) -> bool:
    pattern = r"(?<![A-Za-z0-9_-])" + re.escape(bill_id) + r"(?![A-Za-z0-9_-])"
    return re.search(pattern, sentence, re.IGNORECASE) is not None


def extract(message: object, bills: list[str]) -> list[Claim]:
    """The unambiguous payment claims in `message` about the given bills, in order."""
    if not isinstance(message, str) or not bills:
        return []
    found: list[Claim] = []
    for raw in SENTENCE_END.split(message):
        sentence = " ".join(raw.split())
        named = [b for b in bills if _mentions(sentence, b)]
        if len(named) != 1:
            continue
        negative = NOT_PAID.search(sentence)
        positive = PAID.search(NOT_PAID.sub(lambda m: " " * len(m.group(0)), sentence))
        if negative is None and positive is None:
            continue  # says nothing about paying: leave it alone
        first_negative = negative is not None and (
            positive is None or negative.start() <= positive.start()
        )
        says = "not_paid" if first_negative else "paid"
        quote = sentence if len(sentence) <= QUOTE_LIMIT else sentence[: QUOTE_LIMIT - 1] + "…"
        found.append(Claim(named[0], says, quote))
    return found
