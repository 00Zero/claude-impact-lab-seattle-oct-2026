"""The payment rules C4-C8, rule by rule, against the example bakery's records."""

from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from receipts.checks import RULES, CheckResult, allowed, evaluate
from receipts.payees import Payees
from receipts.source import SourceError, SqliteSource
from tests.conftest import CHANGED_ACCOUNT, CLEAN, LOOKALIKE

ON_FILE = "000123454471"


def sql(db: Path, *statements: str) -> None:
    with closing(sqlite3.connect(db)) as conn, conn:
        for statement in statements:
            conn.execute(statement)


def check(db: Path, request: dict | None = None, **options: object) -> dict[str, CheckResult]:
    with SqliteSource(db) as source:
        return {r.id: r for r in evaluate("pay_bill", request or CLEAN, source, **options)}


def statuses(results: dict[str, CheckResult]) -> dict[str, str]:
    return {rule_id: r.status for rule_id, r in results.items()}


def payee_list(tmp_path: Path, *accounts: str, domains: tuple[str, ...] = ("flourco.example",)):
    found = Payees(tmp_path / "payees.json", "test-salt", [])
    for account in accounts:
        found.add("V-1", "Flour Co", account, list(domains))
    return found


# ---------- the clean payment ----------


def test_clean_payment_passes_every_rule(db: Path) -> None:
    results = check(db)
    assert statuses(results) == {
        "C4": "pass",
        "C5": "pass",
        "C6": "pass",
        "C7": "pass",
        "C8": "pass",
    }
    assert allowed(list(results.values()))


def test_every_rule_reports_under_its_own_id(db: Path) -> None:
    assert list(check(db)) == list(RULES)


# ---------- C4: where the money goes ----------


@pytest.mark.parametrize(
    "to_account", ["9876543210", "111111114471", "0001-2345-4471x", "", "abc", 123454471]
)
def test_c4_refuses_any_other_account(db: Path, to_account: object) -> None:
    assert check(db, {**CLEAN, "to_account": to_account})["C4"].status == "block"


def test_c4_accepts_formatting_of_the_same_account(db: Path) -> None:
    assert check(db, {**CLEAN, "to_account": "0001 2345-4471"})["C4"].status == "pass"


def test_c4_says_when_only_the_last_digits_match(db: Path) -> None:
    title = check(db, {**CLEAN, "to_account": "999999994471"})["C4"].title
    assert "only the last 4 digits match" in title


def test_c4_refuses_a_bill_asking_for_another_account(db: Path) -> None:
    result = check(db, CHANGED_ACCOUNT)["C4"]
    assert result.status == "block" and "••3210" in result.title and "••4471" in result.title
    sql(db, "UPDATE bills SET pay_to_account = '9876543210' WHERE id = 'BILL-07'")
    assert check(db)["C4"].status == "block"  # paying the right account doesn't excuse the bill


def test_c4_without_an_account_on_file(db: Path) -> None:
    sql(db, "UPDATE vendors SET bank_account = ''")
    result = check(db)["C4"]
    assert result.status == "block" and "payee list" in result.title


def test_c4_payee_list_overrides_the_records(db: Path, tmp_path: Path) -> None:
    listed = payee_list(tmp_path, "555566667777")
    assert check(db, payees=listed)["C4"].status == "block"
    assert check(db, {**CLEAN, "to_account": "555566667777"}, payees=listed)["C4"].status == "block"
    sql(db, "UPDATE bills SET pay_to_account = '555566667777' WHERE id = 'BILL-07'")
    result = check(db, {**CLEAN, "to_account": "555566667777"}, payees=listed)["C4"]
    assert result.status == "pass"


def test_c4_supplier_missing_from_the_list(db: Path, tmp_path: Path) -> None:
    empty = Payees(tmp_path / "payees.json", "salt", [])
    result = check(db, payees=empty)["C4"]
    assert result.status == "block" and "isn't on your payee list" in result.title


def test_c4_never_shows_a_full_account_number(db: Path) -> None:
    results = check(db, CHANGED_ACCOUNT)
    text = repr([vars(r) for r in results.values()])
    assert "9876543210" not in text and ON_FILE not in text


# ---------- C5: how much ----------


@pytest.mark.parametrize("amount", [79999, 80001, 8000, 0, -80000])
def test_c5_refuses_a_different_amount(db: Path, amount: int) -> None:
    assert check(db, {**CLEAN, "amount_cents": amount})["C5"].status == "block"


@pytest.mark.parametrize("amount", ["80000", 800.0, True, None])
def test_c5_refuses_anything_but_whole_cents(db: Path, amount: object) -> None:
    result = check(db, {**CLEAN, "amount_cents": amount})["C5"]
    assert result.status == "block" and "whole cents" in result.title


def test_c5_refuses_a_bill_that_disagrees_with_its_order(db: Path) -> None:
    sql(db, "UPDATE bills SET amount_cents = 90000 WHERE id = 'BILL-07'")
    result = check(db, {**CLEAN, "amount_cents": 90000})["C5"]
    assert result.status == "block" and "order PO-2041" in result.title


def test_c5_without_an_order_is_unknown(db: Path) -> None:
    sql(db, "UPDATE bills SET order_id = NULL WHERE id = 'BILL-07'")
    assert check(db, require_order=False)["C5"].status == "unknown"


def test_c5_steps_aside_when_nothing_is_owed(db: Path) -> None:
    sql(db, "UPDATE bills SET status = 'paid' WHERE id = 'BILL-07'")
    assert check(db)["C5"].status == "unknown"


# ---------- C6: the order ----------


@pytest.mark.parametrize(
    "change",
    [
        "UPDATE orders SET status = 'cancelled' WHERE id = 'PO-2041'",
        "UPDATE orders SET vendor_id = 'V-9' WHERE id = 'PO-2041'",
        "UPDATE bills SET order_id = 'PO-9999' WHERE id = 'BILL-07'",
        "UPDATE bills SET order_id = NULL WHERE id = 'BILL-07'",
    ],
)
def test_c6_refuses_a_bill_without_an_open_order(db: Path, change: str) -> None:
    sql(db, "PRAGMA foreign_keys = OFF", change)
    assert check(db)["C6"].status == "block"


def test_c6_order_is_optional_when_the_owner_says_so(db: Path) -> None:
    sql(db, "UPDATE bills SET order_id = NULL WHERE id = 'BILL-07'")
    assert check(db, require_order=False)["C6"].status == "unknown"


def test_c6_received_orders_are_open(db: Path) -> None:
    sql(db, "UPDATE orders SET status = 'received' WHERE id = 'PO-2041'")
    assert check(db)["C6"].status == "pass"


# ---------- C7: only once ----------


def test_c7_refuses_a_paid_bill(db: Path) -> None:
    sql(db, f"INSERT INTO payments VALUES ('pay_1', 'BILL-07', 80000, '{ON_FILE}', 'sent', 'x')")
    result = check(db)["C7"]
    assert result.status == "block" and "already paid" in result.title


def test_c7_ignores_failed_payments(db: Path) -> None:
    sql(db, f"INSERT INTO payments VALUES ('pay_1', 'BILL-07', 80000, '{ON_FILE}', 'failed', 'x')")
    assert check(db)["C7"].status == "pass"


def test_c7_refuses_while_a_payment_is_in_flight(db: Path) -> None:
    result = check(db, in_flight=True)["C7"]
    assert result.status == "block" and "last 2 minutes" in result.title


# ---------- C8: who sent the bill ----------


def test_c8_refuses_a_look_alike_domain(db: Path) -> None:
    result = check(db, LOOKALIKE)["C8"]
    assert result.status == "block" and "flourco-payments.example" in result.title


@pytest.mark.parametrize(
    "sender", ["billing@flourco.example.evil", "Flour Co <billing@flourco.example>", "no-at-sign"]
)
def test_c8_refuses_anything_but_the_suppliers_domain(db: Path, sender: str) -> None:
    sql(db, f"UPDATE bills SET from_addr = '{sender}' WHERE id = 'BILL-07'")
    assert check(db)["C8"].status == "block"


def test_c8_domain_case_doesnt_matter(db: Path) -> None:
    sql(db, "UPDATE bills SET from_addr = 'Billing@FlourCo.Example' WHERE id = 'BILL-07'")
    assert check(db)["C8"].status == "pass"


def test_c8_unknown_when_the_records_dont_say(db: Path) -> None:
    sql(db, "UPDATE bills SET from_addr = '' WHERE id = 'BILL-07'")
    assert check(db)["C8"].status == "unknown"


def test_c8_uses_the_payee_lists_domains(db: Path, tmp_path: Path) -> None:
    listed = payee_list(tmp_path, ON_FILE, domains=("other.example",))
    assert check(db, payees=listed)["C8"].status == "block"


def test_c8_no_domain_on_file_refuses(db: Path) -> None:
    sql(db, "UPDATE vendors SET email = ''")
    assert check(db)["C8"].status == "block"


# ---------- failing closed ----------


def test_unknown_bill_blocks(db: Path) -> None:
    results = check(db, {**CLEAN, "bill_id": "BILL-99"})
    assert results["C6"].status == "block" and not allowed(list(results.values()))


@pytest.mark.parametrize("missing", ["bill_id", "amount_cents", "to_account"])
def test_missing_field_blocks(db: Path, missing: str) -> None:
    request = {k: v for k, v in CLEAN.items() if k != missing}
    (result,) = check(db, request).values()
    assert result.id == "C0" and result.status == "block" and missing in result.title


def test_unknown_action_blocks(db: Path) -> None:
    with SqliteSource(db) as source:
        (result,) = evaluate("refund", CLEAN, source)
    assert result.status == "block"


def test_records_that_cant_be_read_block_without_leaking(db: Path) -> None:
    class Broken:
        def bill(self, bill_id: str):
            raise RuntimeError("account 9876543210 exploded")

    (result,) = evaluate("pay_bill", CLEAN, Broken())
    assert result.status == "block" and "9876543210" not in result.title


def test_connector_errors_are_shown(db: Path) -> None:
    class Offline:
        def bill(self, bill_id: str):
            raise SourceError("QuickBooks is rate-limiting requests")

    (result,) = evaluate("pay_bill", CLEAN, Offline())
    assert result.status == "block" and "rate-limiting" in result.title


def test_a_rule_that_crashes_blocks(db: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(facts):
        raise ValueError("bug")

    monkeypatch.setitem(RULES, "C8", boom)
    results = check(db)
    assert results["C8"].status == "block" and not allowed(list(results.values()))


@pytest.mark.parametrize(
    ("given", "expected"),
    [(["pass", "unknown"], True), (["pass", "block"], False), ([], True), (["unknown"], True)],
)
def test_only_block_stops_a_payment(given: list[str], expected: bool) -> None:
    assert allowed([CheckResult("C", s, "") for s in given]) is expected
