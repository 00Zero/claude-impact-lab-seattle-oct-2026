import json
from pathlib import Path

import pytest

from receipts import chain, config, guard
from tests.conftest import CHANGED_ACCOUNT, CLEAN, LOOKALIKE, PAY_TOOL, write_config


def call(cfg: config.Config, tool: str, tool_input: dict, **extra: object):
    event = {"session_id": "s1", "tool_name": tool, "tool_input": tool_input, **extra}
    return guard.decide(event, cfg)


def logged(cfg: config.Config) -> list[dict]:
    return [json.loads(line) for line in cfg.log_path.read_text().splitlines()]


def test_clean_payment_under_the_limit_is_left_alone(tmp_path: Path, db: Path) -> None:
    cfg = config.load(write_config(tmp_path, approval_threshold_cents=100000))
    assert call(cfg, PAY_TOOL, CLEAN) is None
    (entry,) = logged(cfg)
    assert entry["tool"] == guard.GUARD_TOOL
    assert entry["response"]["decision"] == "pass"
    assert entry["input"]["to_account"] == "********4471"


def test_clean_payment_over_the_limit_asks_the_owner(cfg: config.Config) -> None:
    decision, reason = call(cfg, PAY_TOOL, CLEAN)
    assert decision == "ask"
    assert "$800.00" in reason and "$500.00" in reason and "4471" in reason
    assert "000123454471" not in reason


def test_over_the_limit_in_bypass_mode_is_denied(cfg: config.Config) -> None:
    decision, reason = call(cfg, PAY_TOOL, CLEAN, permission_mode="bypassPermissions")
    assert decision == "deny" and "bypass" in reason


@pytest.mark.parametrize(("args", "check"), [(CHANGED_ACCOUNT, "C4"), (LOOKALIKE, "C8")])
def test_failing_check_denies_with_the_reason(cfg: config.Config, args: dict, check: str) -> None:
    decision, reason = call(cfg, PAY_TOOL, args)
    assert decision == "deny" and f"{check}:" in reason
    assert "9876543210" not in reason
    (entry,) = logged(cfg)
    assert entry["response"]["decision"] == "deny"
    assert "9876543210" not in cfg.log_path.read_text()


def test_missing_argument_denies(cfg: config.Config) -> None:
    decision, reason = call(cfg, PAY_TOOL, {"bill_id": "BILL-07", "amount_cents": 80000})
    assert decision == "deny" and "missing to_account" in reason


def test_other_tools_are_left_alone_and_not_logged(cfg: config.Config) -> None:
    assert call(cfg, "mcp__bakery__list_bills", {}) is None
    assert call(cfg, "Read", {"file_path": str(cfg.path)}) is None
    assert not cfg.log_path.exists()


def test_argument_names_come_from_the_config(tmp_path: Path, db: Path) -> None:
    tools = {"mcp__bank__send": {"bill_id": "ref", "amount_cents": "cents", "to_account": "iban"}}
    cfg = config.load(write_config(tmp_path, payment_tools=tools))
    given = {"ref": "BILL-08", "cents": 20000, "iban": "9876543210"}
    decision, reason = call(cfg, "mcp__bank__send", given)
    assert decision == "deny" and "C4:" in reason


def test_unreadable_records_deny(tmp_path: Path) -> None:
    cfg = config.load(write_config(tmp_path, source={"type": "sqlite", "path": "missing.db"}))
    decision, reason = call(cfg, PAY_TOOL, CLEAN)
    assert decision == "deny" and "Records couldn't be read" in reason
    assert not (tmp_path / "missing.db").exists()


def test_unknown_source_type_denies(tmp_path: Path) -> None:
    cfg = config.load(write_config(tmp_path, source={"type": "quickbooks"}))
    decision, reason = call(cfg, PAY_TOOL, CLEAN)
    assert decision == "deny" and "Records couldn't be read" in reason


def test_payment_that_cant_be_logged_is_denied(cfg: config.Config) -> None:
    (cfg.root / "logs").write_text("a file where the folder should be")
    decision, reason = call(cfg, PAY_TOOL, CLEAN)
    assert decision == "deny" and "wasn't logged" in reason


@pytest.mark.parametrize("tool", ["Edit", "Write", "MultiEdit"])
@pytest.mark.parametrize("target", ["receipts.json", "logs/chain.jsonl", "logs/x/y", "bakery.db"])
def test_claude_cant_edit_what_receipts_relies_on(
    cfg: config.Config, tool: str, target: str
) -> None:
    decision, reason = call(cfg, tool, {"file_path": str(cfg.root / target)})
    assert decision == "deny" and "Receipts protects" in reason


def test_relative_and_dotted_paths_are_caught(cfg: config.Config) -> None:
    assert call(cfg, "Write", {"file_path": "sub/../receipts.json"})[0] == "deny"
    assert call(cfg, "NotebookEdit", {"notebook_path": "logs/n.ipynb"})[0] == "deny"


def test_other_files_can_be_edited(cfg: config.Config) -> None:
    assert call(cfg, "Edit", {"file_path": str(cfg.root / "notes.md")}) is None
    assert call(cfg, "Write", {"file_path": str(cfg.root / "logs-old.txt")}) is None


@pytest.mark.parametrize(
    "command",
    [
        "sed -i '' 's/a/b/' logs/chain.jsonl",
        "echo '{}' > receipts.json",
        "rm logs/chain.head",
        "sqlite3 bakery.db 'update bills set status=1'",
    ],
)
def test_bash_naming_protected_files_is_denied(cfg: config.Config, command: str) -> None:
    assert call(cfg, "Bash", {"command": command})[0] == "deny"


def test_ordinary_bash_is_left_alone(cfg: config.Config) -> None:
    assert call(cfg, "Bash", {"command": "docker logs web && ls"}) is None


def test_log_holds_the_checks_and_stays_intact(cfg: config.Config) -> None:
    call(cfg, PAY_TOOL, CLEAN)
    call(cfg, PAY_TOOL, CHANGED_ACCOUNT)
    entries = logged(cfg)
    assert [c["id"] for c in entries[1]["response"]["checks"]] == ["C4", "C5", "C6", "C7", "C8"]
    assert chain.verify(cfg.log_path).ok


@pytest.mark.parametrize(
    "target", [".mcp.json", ".claude/settings.json", ".claude/settings.local.json"]
)
def test_claude_cant_change_which_hooks_or_tools_exist(cfg: config.Config, target: str) -> None:
    decision, _ = call(cfg, "Write", {"file_path": str(cfg.root / target)})
    assert decision == "deny"
    command = f"echo '{{}}' > {target}"
    assert call(cfg, "Bash", {"command": command})[0] == "deny"


def test_claude_cant_change_the_users_claude_settings(cfg: config.Config) -> None:
    assert call(cfg, "Edit", {"file_path": "~/.claude/settings.json"})[0] == "deny"


def test_broken_log_doesnt_crash_the_guard(tmp_path: Path, db: Path) -> None:
    for mode, expected in (("watch", None), ("enforce", "ask")):
        folder = tmp_path / mode
        folder.mkdir()
        (folder / "bakery.db").write_bytes(db.read_bytes())
        cfg = config.load(write_config(folder, mode=mode))
        cfg.log_path.parent.mkdir()
        cfg.log_path.write_text('{"hash": "ab", "tr')
        answer = call(cfg, PAY_TOOL, CLEAN)
        assert (answer[0] if answer else None) == expected
        assert not chain.verify(cfg.log_path).ok  # the damage stays visible
