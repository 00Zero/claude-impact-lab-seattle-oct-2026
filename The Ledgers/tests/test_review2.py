"""Regression tests for the second independent review's findings."""

from __future__ import annotations

import sqlite3
import threading
import time
from contextlib import closing
from pathlib import Path

import pytest

from receipts import chain, config, guard, pending, stop, verify
from receipts.filelock import locked
from tests.conftest import CLEAN, PAY_TOOL, attempt, write_config


def pay(cfg: config.Config, args: dict = CLEAN, session: str = "s1"):
    event = {"session_id": session, "tool_name": PAY_TOOL, "tool_input": args,
             "permission_mode": "default"}  # fmt: skip
    return guard.decide(event, cfg)


@pytest.fixture
def quick(tmp_path: Path, db: Path) -> config.Config:
    """A project where $800 is under the approval limit, so a clean payment is allowed."""
    return config.load(write_config(tmp_path, approval_threshold_cents=100000))


# ---------- 1: a refusal must not clear another payment's in-flight mark ----------


def test_third_parallel_payment_is_refused(quick: config.Config) -> None:
    assert pay(quick) is None  # A: approved, its tool call still running
    assert pay(quick)[0] == "deny"  # B: refused, A is in flight
    decision, reason = pay(quick)  # C: must be refused too
    assert decision == "deny" and "approved in the last 2 minutes" in reason


def test_logged_payment_clears_the_mark(quick: config.Config) -> None:
    attempt(quick, CLEAN)  # guard, payment, log hook
    assert not pending.in_flight(quick.root, "BILL-07", time.time())


def test_mark_expires(quick: config.Config) -> None:
    pending.start(quick.root, "BILL-07", time.time() - pending.WINDOW_SECONDS - 1)
    assert not pending.in_flight(quick.root, "BILL-07", time.time())


# ---------- 2: an unapproved extra payment must not hide behind a match ----------


def test_extra_unapproved_payment_is_an_issue(quick: config.Config) -> None:
    attempt(quick, CLEAN)
    with closing(sqlite3.connect(quick.root / "bakery.db")) as conn, conn:
        conn.execute(
            "INSERT INTO payments VALUES ('pay_x', 'BILL-07', 80000, '9876543210', 'sent', 'x')"
        )
    receipt = verify.build(quick).receipts["BILL-07"]
    assert receipt["verdict"] == "ISSUES_FOUND"
    assert "1 other payment(s)" in receipt["reason"]


# ---------- 3: Claude can't disable the guard ----------


@pytest.mark.parametrize("target", ["receipts/guard.py", "hooks/hooks.json", "hooks/run.py"])
def test_claude_cant_edit_receipts_own_code(quick: config.Config, target: str) -> None:
    path = guard.PLUGIN_ROOT / target
    assert (
        guard.decide({"tool_name": "Edit", "tool_input": {"file_path": str(path)}}, quick)[0]
        == "deny"
    )


def test_claude_cant_edit_installed_plugins(quick: config.Config) -> None:
    path = Path.home() / ".claude" / "plugins" / "cache" / "receipts" / "receipts" / "guard.py"
    assert (
        guard.decide({"tool_name": "Write", "tool_input": {"file_path": str(path)}}, quick)[0]
        == "deny"
    )


@pytest.mark.parametrize(
    "command", ["rm -rf logs", "mv logs /tmp/x", "rm logs/*", "echo x > logs/pending.json",
                'find "logs" -delete', "truncate -s0 ./logs/chain.jsonl"],
)  # fmt: skip
def test_bash_cant_destroy_the_logs(quick: config.Config, command: str) -> None:
    assert (
        guard.decide({"tool_name": "Bash", "tool_input": {"command": command}}, quick)[0] == "deny"
    )


@pytest.mark.parametrize("command", ["docker logs web", "ls logs", "cat notes.txt > summary.txt"])
def test_ordinary_commands_still_run(quick: config.Config, command: str) -> None:
    assert guard.decide({"tool_name": "Bash", "tool_input": {"command": command}}, quick) is None


# ---------- 4-6: the log ----------


def test_deleted_log_is_reported(quick: config.Config) -> None:
    attempt(quick, CLEAN)
    quick.log_path.unlink()
    status = chain.verify(quick.log_path)
    assert not status.ok and "deleted" in status.error


@pytest.mark.parametrize("line", ["[1]", "5", '"text"', "null"])
def test_non_entry_line_is_reported_not_a_crash(quick: config.Config, line: str) -> None:
    attempt(quick, CLEAN)
    rows = quick.log_path.read_text().splitlines()
    rows[0] = line
    quick.log_path.write_text("\n".join(rows) + "\n")
    status = chain.verify(quick.log_path)
    assert not status.ok and status.line == 1
    assert {r["verdict"] for r in verify.build(quick).receipts.values()} == {"UNTRUSTED"}


@pytest.mark.parametrize("head", ["", "garbage", "3", "x y z"])
def test_damaged_head_is_reported(quick: config.Config, head: str) -> None:
    attempt(quick, CLEAN)
    quick.log_path.with_suffix(".head").write_text(head)
    status = chain.verify(quick.log_path)
    assert not status.ok and "head" in status.error


def test_verify_during_appends_never_reports_false_tampering(tmp_path: Path) -> None:
    path = tmp_path / "chain.jsonl"
    bad: list = []

    def writer(n: int) -> None:
        for i in range(60):
            chain.append({"ts": i, "tool": f"t{n}"}, path)

    def reader() -> None:
        for _ in range(60):
            status = chain.verify(path)
            if not status.ok:
                bad.append(status)

    threads = [threading.Thread(target=writer, args=(n,)) for n in range(3)]
    threads.append(threading.Thread(target=reader))
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert bad == [] and chain.verify(path).entries == 180


# ---------- 7: time limits ----------


def test_verifier_has_no_shared_deadline(tmp_path: Path) -> None:
    from receipts.quickbooks import QuickBooksSource

    settings = {"realm_id": "123", "client_id": "app", "environment": "sandbox"}
    assert QuickBooksSource.from_config(settings).client.deadline is None


def test_guard_passes_its_deadline_to_the_source(quick: config.Config, monkeypatch) -> None:
    seen = []

    class Slow:
        def set_deadline(self, deadline: float) -> None:
            seen.append(deadline - time.monotonic())

        def bill(self, bill_id: str):
            raise TimeoutError("too slow")

    monkeypatch.setattr(config.Config, "open_source", lambda self: Slow())
    decision, _reason = pay(quick)
    assert decision == "deny" and 0 < seen[0] <= guard.DECISION_SECONDS


def test_busy_lock_refuses_instead_of_hanging(quick: config.Config, monkeypatch) -> None:
    monkeypatch.setattr(guard, "LOCK_WAIT_SECONDS", 0.2)
    held = threading.Event()
    release = threading.Event()

    def hold() -> None:
        with locked(pending.lock_path(quick.root)):
            held.set()
            release.wait(5)

    t = threading.Thread(target=hold)
    t.start()
    held.wait(5)
    started = time.monotonic()
    decision, reason = pay(quick)
    release.set()
    t.join()
    assert decision == "deny" and "in time" in reason
    assert time.monotonic() - started < 2


# ---------- 9: the end-of-turn message ----------


def test_stop_message_reports_payments_naming_no_bill(quick: config.Config) -> None:
    pay(quick, {"amount_cents": 100, "to_account": "000123454471"}, session="s9")
    message = stop.report({"session_id": "s9"}, quick)
    assert "None" not in message
    assert "1 payment(s) named no bill and were refused" in message
