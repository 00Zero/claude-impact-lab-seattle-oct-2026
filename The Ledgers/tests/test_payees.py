from __future__ import annotations

import json
import stat
import sys
from pathlib import Path

import pytest

from receipts import __main__ as cli
from receipts import config, guard, payees, verify
from tests.conftest import CHANGED_ACCOUNT, CLEAN, PAY_TOOL, attempt, write_config


def with_payees(cfg: config.Config, *entries: tuple[str, str, str, list[str]]) -> payees.Payees:
    found = payees.load_or_new(cfg.payees_path)
    for vendor_id, name, account, domains in entries:
        found.add(vendor_id, name, account, domains)
    found.save()
    return found


FLOUR = ("V-1", "Flour Co", "0001 2345-4471", ["flourco.example"])


def test_file_holds_no_full_account_number(cfg: config.Config) -> None:
    with_payees(cfg, FLOUR)
    text = cfg.payees_path.read_text()
    assert "000123454471" not in text and '"last4": "4471"' in text
    assert stat.S_IMODE(cfg.payees_path.stat().st_mode) == 0o600


def test_owns_matches_formatting_but_not_other_numbers(cfg: config.Config) -> None:
    found = with_payees(cfg, FLOUR)
    flour = found.for_vendor("V-1")
    assert found.owns(flour, "000123454471") and found.owns(flour, "0001-2345-4471")
    assert not found.owns(flour, "9876543210")
    assert not found.owns(flour, "00012345447１")  # a full-width digit isn't a plain number
    assert not found.owns(flour, 123454471)


def test_add_is_idempotent_and_merges_domains(cfg: config.Config) -> None:
    with_payees(
        cfg, FLOUR, ("V-1", "Flour Co", "000123454471", ["FlourCo.example.", "mail.example"])
    )
    (flour,) = payees.load(cfg.payees_path).payees
    assert len(flour.accounts) == 1
    assert flour.email_domains == ["flourco.example", "mail.example"]


@pytest.mark.parametrize(
    "text",
    [
        "{nope",
        "[]",
        '{"salt": "", "payees": []}',
        '{"salt": "s"}',
        '{"salt": "s", "payees": [{"name": "x"}]}',
    ],
)
def test_malformed_file_raises(tmp_path: Path, text: str) -> None:
    (tmp_path / "payees.json").write_text(text)
    with pytest.raises(payees.PayeesError):
        payees.load(tmp_path / "payees.json")


def test_bad_account_is_refused(cfg: config.Config) -> None:
    with pytest.raises(payees.PayeesError):
        payees.load_or_new(cfg.payees_path).add("V-1", "Flour Co", "acct 12", [])


# ---------- the payee list in the checks ----------


def decide(cfg: config.Config, args: dict, **extra: object):
    return guard.decide(
        {"session_id": "s1", "tool_name": PAY_TOOL, "tool_input": args, **extra}, cfg
    )


def test_listed_account_passes(tmp_path: Path, db: Path) -> None:
    cfg = config.load(write_config(tmp_path, approval_threshold_cents=100000))
    with_payees(cfg, FLOUR)
    assert decide(cfg, CLEAN) is None


def test_account_not_on_the_list_is_refused(cfg: config.Config) -> None:
    with_payees(cfg, FLOUR)
    decision, reason = decide(cfg, CHANGED_ACCOUNT)
    assert decision == "deny"
    assert "isn't one of Flour Co's accounts on your payee list" in reason


def test_supplier_missing_from_the_list_is_refused(cfg: config.Config) -> None:
    with_payees(cfg, ("V-9", "Someone Else", "111122223333", []))
    decision, reason = decide(cfg, CLEAN)
    assert decision == "deny" and "Flour Co isn't on your payee list" in reason


def test_list_overrides_the_records_account(cfg: config.Config) -> None:
    # The records say ••4471, but the owner's list only has a newer account.
    with_payees(cfg, ("V-1", "Flour Co", "555566667777", ["flourco.example"]))
    decision, reason = decide(cfg, CLEAN)
    assert decision == "deny" and "C4:" in reason


def test_list_domains_drive_the_sender_check(cfg: config.Config) -> None:
    with_payees(cfg, ("V-1", "Flour Co", "000123454471", ["other.example"]))
    decision, reason = decide(cfg, CLEAN)
    assert decision == "deny" and "C8:" in reason


def test_broken_payee_list_refuses(cfg: config.Config) -> None:
    cfg.payees_path.write_text("{nope")
    decision, reason = decide(cfg, CLEAN)
    assert decision == "deny" and "payee list can't be used" in reason


@pytest.mark.parametrize("tool, key", [("Read", "file_path"), ("Grep", "path")])
def test_claude_cant_read_the_list(cfg: config.Config, tool: str, key: str) -> None:
    event = {"tool_name": tool, "tool_input": {key: str(cfg.payees_path)}}
    assert guard.decide(event, cfg)[0] == "deny"
    assert guard.decide({"tool_name": "Read", "tool_input": {"file_path": "notes.md"}}, cfg) is None


@pytest.mark.parametrize(
    "command",
    ["cat {list}", "grep -r salt ~/.config/receipts", "python3 -m receipts payee add V-2 X"],
)
def test_claude_cant_reach_the_list_through_bash(cfg: config.Config, command: str) -> None:
    command = command.format(list=cfg.payees_path)
    assert guard.decide({"tool_name": "Bash", "tool_input": {"command": command}}, cfg)[0] == "deny"


def test_list_lives_outside_the_project(cfg: config.Config) -> None:
    with_payees(cfg, FLOUR)
    assert cfg.root not in cfg.payees_path.parents
    assert not list(cfg.root.glob("payees*"))


@pytest.mark.parametrize("path", [None, ".", "{secrets}/..", "{secrets}"])
def test_searches_that_would_reach_the_list_are_refused(
    cfg: config.Config, private_secrets: Path, path: str | None
) -> None:
    given = {"pattern": "salt"}
    if path is not None:
        given["path"] = path.format(secrets=private_secrets)
    decision = guard.decide({"tool_name": "Grep", "tool_input": given}, cfg)
    if path in (None, "."):
        assert decision is None  # searching the project can't reach the list any more
    else:
        assert decision[0] == "deny"


# ---------- double payments and watch mode ----------


def test_second_payment_while_one_is_in_flight_is_refused(tmp_path: Path, db: Path) -> None:
    cfg = config.load(write_config(tmp_path, approval_threshold_cents=100000))
    assert decide(cfg, CLEAN) is None  # approved; its tool call hasn't run yet
    decision, reason = decide(cfg, CLEAN)
    assert decision == "deny" and "approved in the last 2 minutes" in reason


def test_finished_payment_is_no_longer_in_flight(tmp_path: Path, db: Path) -> None:
    cfg = config.load(write_config(tmp_path, approval_threshold_cents=100000))
    attempt(cfg, CLEAN)  # guard, payment, log
    decision, reason = decide(cfg, CLEAN)
    assert decision == "deny" and "already paid" in reason  # C7 from the records now


def test_watch_mode_never_blocks_but_records(tmp_path: Path, db: Path) -> None:
    cfg = config.load(write_config(tmp_path, mode="watch"))
    assert decide(cfg, CHANGED_ACCOUNT) is None
    assert decide(cfg, CLEAN) is None  # over the limit: no ask in watch mode either
    entry = json.loads(cfg.log_path.read_text().splitlines()[0])
    assert entry["response"]["decision"] == "deny" and entry["response"]["mode"] == "watch"
    assert (
        guard.decide({"tool_name": "Write", "tool_input": {"file_path": "receipts.json"}}, cfg)[0]
        == "deny"
    )  # files stay protected


def test_watch_mode_verdict_says_what_would_have_happened(tmp_path: Path, db: Path) -> None:
    cfg = config.load(write_config(tmp_path, mode="watch"))
    attempt(cfg, CHANGED_ACCOUNT)
    receipt = verify.build(cfg).receipts["BILL-08"]
    assert receipt["verdict"] == "ISSUES_FOUND" and receipt["guard"]["mode"] == "watch"
    assert receipt["reason"].startswith("Paid; in enforce mode Receipts would have stopped it")


def test_bad_mode_is_a_config_error(tmp_path: Path) -> None:
    with pytest.raises(config.ConfigError, match="mode"):
        config.load(write_config(tmp_path, mode="relaxed"))


# ---------- the owner's commands ----------


def run_cli(monkeypatch: pytest.MonkeyPatch, cfg: config.Config, *args: str, typed=()) -> int:
    answers = iter(typed)
    monkeypatch.setattr(cli.getpass, "getpass", lambda prompt="": next(answers))
    monkeypatch.setenv("RECEIPTS_CONFIG", str(cfg.path))
    monkeypatch.setattr(sys, "argv", ["receipts", *args])
    with pytest.raises(SystemExit) as done:
        cli.main()
    return done.value.code


def test_payee_add_and_list(monkeypatch, capsys, cfg: config.Config) -> None:
    code = run_cli(
        monkeypatch,
        cfg,
        "payee",
        "add",
        "V-1",
        "Flour Co",
        "--domain",
        "flourco.example",
        typed=("000123454471", "000123454471"),
    )
    assert code == 0 and "account ending 4471" in capsys.readouterr().out
    assert run_cli(monkeypatch, cfg, "payee", "list") == 0
    assert "V-1  Flour Co: ••4471; flourco.example" in capsys.readouterr().out


def test_payee_add_needs_matching_entries(monkeypatch, cfg: config.Config) -> None:
    code = run_cli(
        monkeypatch, cfg, "payee", "add", "V-1", "Flour Co", typed=("000123454471", "000123454472")
    )
    assert code == 1 and not cfg.payees_path.exists()
