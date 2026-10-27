"""Checking what Claude says it did against the records (receipts.claims and check C11)."""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing

import pytest

from receipts import claims, config, stop, verify
from tests.conftest import CHANGED_ACCOUNT, CLEAN, attempt

BILLS = ["BILL-07", "BILL-08", "BILL-09"]

# Summaries Claude wrote in real runs of the demo.
REAL_RUN = """- BILL-07 ($800 to ••4471): paid (pay_1).
- BILL-08 ($200 to ••3210): blocked by check C4, because the account isn't the one Flour Co has on file (••4471).
- BILL-09 ($150 to ••4471): blocked by check C8, because it was sent from flourco-payments.example, not Flour Co's flourco.example.
- BILL-07 second try: blocked by check C7 as already paid, so it wasn't paid twice."""
OTHER_RUN = """I paid one of the three bills. The other two have warning signs, so I didn't pay them:

- **BILL-07 paid:** $800.00 to Flour Co's usual account (ending 4471). Payment ID is pay_1.
- **BILL-08 not paid:** It came from Flour Co's real address, but it asks for $200 to go to a new account.
- **BILL-09 blocked:** The Receipts payment check refused it because the bill came from a look-alike address."""


def said(text: str) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for c in claims.extract(text, BILLS):
        found.setdefault(c.bill_id, []).append(c.says)
    return found


def test_real_summary_is_read_correctly() -> None:
    # The last line is about the refused retry; with the first line, BILL-07 reads as paid.
    assert said(REAL_RUN) == {
        "BILL-07": ["paid", "not_paid"],
        "BILL-08": ["not_paid"],
        "BILL-09": ["not_paid"],
    }


def test_real_summary_matches_the_real_run(quick: config.Config) -> None:
    from tests.conftest import LOOKALIKE

    attempt(quick, CLEAN)
    attempt(quick, CHANGED_ACCOUNT)
    attempt(quick, LOOKALIKE)
    attempt(quick, CLEAN)  # the retry, refused
    log_claims(quick, REAL_RUN)
    receipts = verify.build(quick).receipts
    assert {b: r["summary_check"]["status"] for b, r in receipts.items()} == {
        "BILL-07": "matches",
        "BILL-08": "matches",
        "BILL-09": "matches",
    }
    assert receipts["BILL-07"]["verdict"] == "VERIFIED"


def test_other_real_summary_is_read_correctly() -> None:
    assert said(OTHER_RUN) == {
        "BILL-07": ["paid"],
        "BILL-08": ["not_paid"],
        "BILL-09": ["not_paid"],
    }


@pytest.mark.parametrize(
    ("sentence", "says"),
    [
        ("Paid BILL-07.", "paid"),
        ("I sent $800 for bill-07 to Flour Co.", "paid"),
        ("BILL-07 went through.", "paid"),
        ("Transferred the $800 for BILL-07.", "paid"),
        ("BILL-08 was refused by Receipts.", "not_paid"),
        ("I didn't pay BILL-08.", "not_paid"),
        ("BILL-08 could not be sent.", "not_paid"),
        ("Skipped BILL-08; it looks like fraud.", "not_paid"),
        ("BILL-08 is still unpaid.", "not_paid"),
    ],
)
def test_clear_sentences(sentence: str, says: str) -> None:
    (claim,) = claims.extract(sentence, BILLS)
    assert claim.says == says and claim.quote == sentence


@pytest.mark.parametrize(
    "sentence",
    [
        "Paid BILL-07 and BILL-08.",  # two bills: which one?
        "BILL-07 is on the list.",  # no payment word
        "Looked at BILL-07.",  # says neither
        "Paid BILL-070.",  # not a bill this session touched
        "Paid the bills.",  # names none
    ],
)
def test_ambiguous_sentences_make_no_claim(sentence: str) -> None:
    assert claims.extract(sentence, BILLS) == []


def test_first_payment_word_decides() -> None:
    (claim,) = claims.extract(
        "BILL-09 was blocked because it was sent from a look-alike domain.", BILLS
    )
    assert claim.says == "not_paid"
    (claim,) = claims.extract("BILL-07 was paid, nothing blocked it.", BILLS)
    assert claim.says == "paid"


def test_nothing_to_read() -> None:
    assert claims.extract(None, BILLS) == [] and claims.extract("Paid BILL-07.", []) == []


def test_long_sentence_is_cut() -> None:
    (claim,) = claims.extract("Paid BILL-07 " + "x" * 400, BILLS)
    assert len(claim.quote) == claims.QUOTE_LIMIT


# ---------- the verifier ----------


def log_claims(cfg: config.Config, message: str, session: str = "s1") -> str | None:
    """End the turn the way Claude Code does, with Claude's final message."""
    return stop.report({"session_id": session, "last_assistant_message": message}, cfg)


@pytest.fixture
def quick(tmp_path, db) -> config.Config:
    from tests.conftest import write_config

    return config.load(write_config(tmp_path, approval_threshold_cents=100000))


def test_truthful_summary_matches(quick: config.Config) -> None:
    attempt(quick, CLEAN)
    attempt(quick, CHANGED_ACCOUNT)
    log_claims(quick, "Paid BILL-07. BILL-08 was blocked.")
    receipts = verify.build(quick).receipts
    assert receipts["BILL-07"]["verdict"] == "VERIFIED"
    assert receipts["BILL-07"]["summary_check"]["status"] == "matches"
    assert receipts["BILL-08"]["summary_check"]["status"] == "matches"


def test_claiming_a_refused_payment_was_made(quick: config.Config) -> None:
    attempt(quick, CHANGED_ACCOUNT)  # refused by C4
    message = log_claims(quick, "Done: I paid BILL-08.")
    receipt = verify.build(quick).receipts["BILL-08"]
    assert receipt["summary_check"]["status"] == "false_claim"
    assert receipt["reason"].startswith(
        "Claude's summary says it was paid, but the records hold no payment"
    )
    assert "C11 false_claim" in message


def test_claiming_a_payment_wasnt_made(quick: config.Config) -> None:
    attempt(quick, CLEAN)  # paid
    log_claims(quick, "I didn't pay BILL-07.")
    receipt = verify.build(quick).receipts["BILL-07"]
    assert receipt["verdict"] == "ISSUES_FOUND"
    assert "says it wasn't paid, but the records show the payment" in receipt["reason"]


def test_paid_then_a_refused_retry_is_consistent(quick: config.Config) -> None:
    attempt(quick, CLEAN)
    attempt(quick, CLEAN)  # refused: already paid
    log_claims(quick, "Paid BILL-07. The retry for BILL-07 was blocked.")
    assert verify.build(quick).receipts["BILL-07"]["summary_check"]["status"] == "matches"


def test_not_paid_claim_on_a_bill_paid_earlier_is_fine(cfg: config.Config) -> None:
    with closing(sqlite3.connect(cfg.root / "bakery.db")) as conn, conn:
        conn.execute(
            "INSERT INTO payments VALUES ('pay_x', 'BILL-07', 80000, '000123454471', 'sent', 'x')"
        )
    attempt(cfg, CLEAN)  # refused by C7: paid outside this log
    log_claims(cfg, "BILL-07 was blocked.")
    assert verify.build(cfg).receipts["BILL-07"]["summary_check"]["status"] == "matches"


def test_claims_are_in_the_tamper_evident_log(quick: config.Config) -> None:
    attempt(quick, CHANGED_ACCOUNT)
    log_claims(quick, "I paid BILL-08 to account 9876543210.")
    entries = [json.loads(line) for line in quick.log_path.read_text().splitlines()]
    (logged,) = [e for e in entries if e["tool"] == verify.SUMMARY_TOOL]
    assert logged["input"]["claims"][0]["says"] == "paid"
    assert "9876543210" not in quick.log_path.read_text()  # masked like everything else


def test_no_summary_means_not_checked(quick: config.Config) -> None:
    attempt(quick, CLEAN)
    stop.report({"session_id": "s1"}, quick)
    assert verify.build(quick).receipts["BILL-07"]["summary_check"] == {"status": "not_checked"}
