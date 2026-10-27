import json
import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from receipts import config, hook_log, verify
from tests.conftest import CHANGED_ACCOUNT, CLEAN, LOOKALIKE, PAY_TOOL, attempt


@pytest.fixture
def demo(cfg: config.Config) -> config.Config:
    """The demo: the owner approves BILL-07; the guard refuses BILL-08 and BILL-09."""
    attempt(cfg, CLEAN)
    attempt(cfg, CHANGED_ACCOUNT)
    attempt(cfg, LOOKALIKE)
    return cfg


def insert_payment(cfg: config.Config, bill_id: str, amount: int, account: str) -> None:
    with closing(sqlite3.connect(cfg.root / "bakery.db")) as conn, conn:
        conn.execute(
            "INSERT INTO payments VALUES ('pay_x', ?, ?, ?, 'sent', '2026-10-25T10:00:00-07:00')",
            (bill_id, amount, account),
        )


def verdicts(cfg: config.Config) -> dict[str, str]:
    return {b: r["verdict"] for b, r in verify.build(cfg).receipts.items()}


def test_demo_run(demo: config.Config) -> None:
    receipts = verify.build(demo).receipts
    assert {b: r["verdict"] for b, r in receipts.items()} == {
        "BILL-07": "VERIFIED",
        "BILL-08": "ISSUES_FOUND",
        "BILL-09": "ISSUES_FOUND",
    }
    paid, changed = receipts["BILL-07"], receipts["BILL-08"]
    assert paid["payment"] == {
        "status": "sent",
        "payment_id": "pay_1",
        "amount_cents": 80000,
        "to_account": "********4471",
        "account_on_file": "********4471",
    }
    assert {c["id"]: c["status"] for c in paid["checks"]}["C10"] == "verified"
    assert paid["guard"]["decision"] == "ask" and paid["owner_action"] is None
    assert changed["payment"]["status"] == "blocked"
    assert changed["reason"].startswith("Stopped before any money moved")
    assert "bank account" in changed["owner_action"]
    assert {c["id"] for c in receipts["BILL-09"]["checks"] if c["status"] == "blocked"} == {"C8"}
    assert paid["order"]["id"] == "PO-2041" and len(paid["order"]["items"]) == 2


def test_summary_lines(demo: config.Config) -> None:
    lines = verify.summary(verify.build(demo))
    assert lines[0].startswith("Log: intact")
    assert lines[2].startswith("BILL-07 ($800.00 to Flour Co): VERIFIED")


def test_owner_declines(cfg: config.Config) -> None:
    attempt(cfg, CLEAN, approve=False)
    receipt = verify.build(cfg).receipts["BILL-07"]
    assert receipt["verdict"] == "NOT_PAID" and receipt["payment"]["status"] == "not_made"


def test_paid_even_though_the_guard_refused(cfg: config.Config) -> None:
    attempt(cfg, CHANGED_ACCOUNT)
    insert_payment(cfg, "BILL-08", 20000, "9876543210")
    receipt = verify.build(cfg).receipts["BILL-08"]
    assert receipt["verdict"] == "ISSUES_FOUND"
    assert receipt["reason"].startswith("Paid even though the guard refused it")
    assert receipt["payment"]["status"] == "sent"


def test_payment_tool_ran_without_the_guard(cfg: config.Config) -> None:
    event = {"session_id": "s1", "tool_name": PAY_TOOL, "tool_input": CLEAN}
    hook_log.log_event({**event, "tool_response": {"ok": True}}, cfg)
    insert_payment(cfg, "BILL-07", 80000, "000123454471")
    receipt = verify.build(cfg).receipts["BILL-07"]
    assert receipt["verdict"] == "ISSUES_FOUND" and "without the guard" in receipt["reason"]


def test_tool_said_paid_but_records_hold_nothing(cfg: config.Config) -> None:
    from receipts import guard

    event = {"session_id": "s1", "tool_name": PAY_TOOL, "tool_input": CLEAN}
    guard.decide(event, cfg)
    hook_log.log_event({**event, "tool_response": {"ok": True, "id": "pay_9"}}, cfg)
    receipt = verify.build(cfg).receipts["BILL-07"]
    assert receipt["verdict"] == "ISSUES_FOUND"
    assert {c["id"]: c["status"] for c in receipt["checks"]}["C10"] == "phantom"


def test_records_hold_a_different_payment(cfg: config.Config) -> None:
    from receipts import guard

    guard.decide({"session_id": "s1", "tool_name": PAY_TOOL, "tool_input": CLEAN}, cfg)
    insert_payment(cfg, "BILL-07", 80000, "9876543210")
    receipt = verify.build(cfg).receipts["BILL-07"]
    assert receipt["verdict"] == "ISSUES_FOUND" and "doesn't match" in receipt["reason"]


def test_edited_log_makes_every_receipt_untrusted(demo: config.Config) -> None:
    log = demo.log_path
    log.write_text(log.read_text().replace('"amount_cents":80000', '"amount_cents":8000', 1))
    result = verify.build(demo)
    assert set(verdicts(demo).values()) == {"UNTRUSTED"}
    assert "BROKEN at line 1" in verify.summary(result)[0]


def test_changed_bill_id_is_reported_not_skipped(demo: config.Config) -> None:
    demo.log_path.write_text(demo.log_path.read_text().replace("BILL-07", "BILL-70"))
    result = verify.build(demo)
    assert result.unknown_bills == ["BILL-70"]
    assert {r["verdict"] for r in result.receipts.values()} == {"UNTRUSTED"}
    assert any(line.startswith("BILL-70: UNKNOWN") for line in verify.summary(result))


def test_damaged_line_does_not_crash(demo: config.Config) -> None:
    rows = demo.log_path.read_text().splitlines()
    rows[1] = "not json"
    demo.log_path.write_text("\n".join(rows) + "\n")
    result = verify.build(demo)
    assert not result.chain.ok and set(verdicts(demo).values()) == {"UNTRUSTED"}


def test_write_replaces_earlier_receipts(demo: config.Config) -> None:
    out = demo.receipts_dir
    out.mkdir(parents=True)
    (out / "receipt_BILL-99.json").write_text('{"verdict": "VERIFIED"}')
    written = verify.write(out, verify.build(demo))
    assert sorted(p.name for p in out.glob("receipt_*.json")) == sorted(p.name for p in written)
    assert len(written) == 3


def test_no_raw_account_numbers_in_receipts(demo: config.Config) -> None:
    text = "".join(p.read_text() for p in verify.write(demo.receipts_dir, verify.build(demo)))
    assert "9876543210" not in text and "000123454471" not in text
    assert all(
        json.loads(p.read_text())["receipt_version"] == 1 for p in demo.receipts_dir.iterdir()
    )


def test_empty_log_says_so(cfg: config.Config) -> None:
    result = verify.build(cfg)
    assert result.receipts == {} and verify.summary(result)[-1] == "No payments in the log yet."


def test_odd_bill_id_is_safe_as_a_file_name(tmp_path: Path, cfg: config.Config) -> None:
    result = verify.Result(verify.build(cfg).chain, receipts={"../x": {"verdict": "VERIFIED"}})
    (written,) = verify.write(tmp_path / "out", result)
    assert written.parent == tmp_path / "out" and written.name == "receipt_.._x.json"


# ---------- every guard decision counts, not only the last ----------


def test_paid_then_a_blocked_retry_is_verified(tmp_path: Path, db: Path) -> None:
    from tests.conftest import write_config

    cfg = config.load(write_config(tmp_path, approval_threshold_cents=100000))
    attempt(cfg, CLEAN)
    attempt(cfg, CLEAN)  # refused: already paid
    receipt = verify.build(cfg).receipts["BILL-07"]
    assert receipt["verdict"] == "VERIFIED"
    assert receipt["reason"].endswith("a later attempt to pay it again was stopped")


def test_bill_paid_before_receipts_is_not_flagged(cfg: config.Config) -> None:
    insert_payment(cfg, "BILL-07", 80000, "000123454471")  # paid outside this log
    attempt(cfg, CLEAN)  # refused by C7
    receipt = verify.build(cfg).receipts["BILL-07"]
    assert receipt["verdict"] == "NOT_PAID" and "already paid" in receipt["reason"].lower()


def test_approved_payment_then_a_refused_one_that_went_through_anyway(cfg: config.Config) -> None:
    from receipts import guard

    guard.decide({"session_id": "s1", "tool_name": PAY_TOOL, "tool_input": CLEAN}, cfg)
    attempt(cfg, {**CLEAN, "to_account": "9876543210"})  # refused by C4
    insert_payment(cfg, "BILL-07", 80000, "9876543210")  # yet the records show it paid there
    receipt = verify.build(cfg).receipts["BILL-07"]
    assert receipt["verdict"] == "ISSUES_FOUND"
    assert receipt["reason"].startswith("Paid even though the guard refused it")


def test_long_numeric_bill_reference_still_matches(tmp_path: Path, db: Path) -> None:
    from tests.conftest import write_config

    with closing(sqlite3.connect(db)) as conn, conn:
        conn.execute("UPDATE bills SET id = '202610250001' WHERE id = 'BILL-07'")
    cfg = config.load(write_config(tmp_path, approval_threshold_cents=100000))
    args = {**CLEAN, "bill_id": "202610250001"}
    attempt(cfg, args)
    assert '"bill_id":"202610250001"' in cfg.log_path.read_text()
    result = verify.build(cfg)
    assert result.unknown_bills == [] and result.receipts["202610250001"]["verdict"] == "VERIFIED"


def test_retry_on_a_bill_paid_in_full_is_a_duplicate_stop(cfg: config.Config) -> None:
    # Records like QuickBooks: a paid bill has a zero balance. C5 must not join C7's refusal.
    with closing(sqlite3.connect(cfg.root / "bakery.db")) as conn, conn:
        conn.execute("UPDATE bills SET status = 'paid' WHERE id = 'BILL-07'")
    insert_payment(cfg, "BILL-07", 80000, "000123454471")
    from receipts import checks
    from receipts.source import SqliteSource

    class ZeroBalance(SqliteSource):
        def bill(self, bill_id):
            found = super().bill(bill_id)
            return {**found, "balance_cents": 0} if found else None

    with ZeroBalance(cfg.root / "bakery.db") as source:
        results = {r.id: r.status for r in checks.evaluate("pay_bill", CLEAN, source)}
    assert results["C5"] == "unknown" and results["C7"] == "block"


def test_payment_naming_no_bill_is_reported_not_a_bill(cfg: config.Config) -> None:
    from receipts import guard

    event = {"session_id": "s1", "tool_name": PAY_TOOL,
             "tool_input": {"amount_cents": 100, "to_account": "000123454471"}}  # fmt: skip
    assert guard.decide(event, cfg)[0] == "deny"
    result = verify.build(cfg)
    assert result.receipts == {} and result.unknown_bills == [] and result.no_bill == 1
    assert "1 payment(s) named no bill and were refused" in verify.summary(result)


def test_demo_source_is_announced(demo: config.Config) -> None:
    lines = verify.summary(verify.build(demo))
    assert lines[1] == f"Note: {config.DEMO_NOTE}."


def test_real_source_has_no_demo_note(cfg: config.Config) -> None:
    cfg.source = {"type": "quickbooks"}
    assert not cfg.demo_source
