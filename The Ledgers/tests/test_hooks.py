"""The plugin's hooks, run the way Claude Code runs them: python3 hooks/run.py <hook>."""

import json
import os
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

import pytest

from receipts import config, stop
from tests.conftest import CHANGED_ACCOUNT, CLEAN, PAY_TOOL, attempt

ROOT = Path(__file__).resolve().parent.parent
RUN = ROOT / "hooks" / "run.py"
SYSTEM_PYTHON = "/usr/bin/python3"


def run(hook: str, event: object, project: Path, python: str = sys.executable) -> str:
    """Run one hook like Claude Code does: the event on stdin, the project in the environment.
    Returns what the hook printed; a hook must always exit 0."""
    environment = {
        name: value for name, value in os.environ.items() if not name.startswith("RECEIPTS_")
    }
    environment["CLAUDE_PROJECT_DIR"] = str(project)
    environment["RECEIPTS_SECRETS_DIR"] = os.environ["RECEIPTS_SECRETS_DIR"]
    finished = subprocess.run(
        [python, str(RUN), hook], input=json.dumps(event), env=environment, cwd="/",
        capture_output=True, text=True, check=False,
    )  # fmt: skip
    assert finished.returncode == 0, finished.stderr
    return finished.stdout


def pre(tool: str, tool_input: dict) -> dict:
    return {"session_id": "s1", "tool_name": tool, "tool_input": tool_input}


def test_guard_denies_through_the_hook(cfg: config.Config) -> None:
    out = json.loads(run("guard", pre(PAY_TOOL, CHANGED_ACCOUNT), cfg.root))
    decision = out["hookSpecificOutput"]
    assert decision["hookEventName"] == "PreToolUse"
    assert decision["permissionDecision"] == "deny"
    assert "C4:" in decision["permissionDecisionReason"]


def test_guard_asks_over_the_limit(cfg: config.Config) -> None:
    out = json.loads(run("guard", pre(PAY_TOOL, CLEAN), cfg.root))
    assert out["hookSpecificOutput"]["permissionDecision"] == "ask"


def test_every_hook_is_silent_outside_a_receipts_project(tmp_path: Path) -> None:
    assert run("guard", pre(PAY_TOOL, CHANGED_ACCOUNT), tmp_path) == ""
    assert run("log", {**pre(PAY_TOOL, CLEAN), "tool_response": {}}, tmp_path) == ""
    assert run("stop", {"session_id": "s1"}, tmp_path) == ""
    assert not (tmp_path / "logs").exists()


def test_broken_config_denies_without_leaking(tmp_path: Path) -> None:
    (tmp_path / "receipts.json").write_text("{nope")
    out = json.loads(run("guard", pre("mcp__x__anything", {}), tmp_path))
    assert out["hookSpecificOutput"]["permissionDecision"] == "deny"
    assert "can't be read" in out["hookSpecificOutput"]["permissionDecisionReason"]


def test_log_hook_appends(cfg: config.Config) -> None:
    run("log", {**pre("mcp__bakery__list_bills", {}), "tool_response": {"ok": True}}, cfg.root)
    assert json.loads(cfg.log_path.read_text())["tool"] == "mcp__bakery__list_bills"


def test_stop_reports_every_bill_once(cfg: config.Config) -> None:
    attempt(cfg, CHANGED_ACCOUNT)
    attempt(cfg, CLEAN)
    message = json.loads(run("stop", {"session_id": "s1"}, cfg.root))["systemMessage"]
    assert message.startswith("Receipts: BILL-08: ISSUES_FOUND (C4 blocked:")
    assert "BILL-07: VERIFIED" in message
    assert "Full receipts in logs/receipts" in message
    assert (cfg.receipts_dir / "receipt_BILL-07.json").is_file()
    assert run("stop", {"session_id": "s1"}, cfg.root) == ""


def test_stop_reports_only_new_payments_and_this_session(cfg: config.Config) -> None:
    attempt(cfg, CHANGED_ACCOUNT, session="other")
    assert run("stop", {"session_id": "s1"}, cfg.root) == ""
    attempt(cfg, CLEAN)
    message = json.loads(run("stop", {"session_id": "s1"}, cfg.root))["systemMessage"]
    assert "BILL-07" in message and "BILL-08" not in message


def test_stop_is_silent_when_already_continuing(cfg: config.Config) -> None:
    attempt(cfg, CLEAN)
    assert run("stop", {"session_id": "s1", "stop_hook_active": True}, cfg.root) == ""


def test_stop_failure_is_reported_once(cfg: config.Config) -> None:
    attempt(cfg, CHANGED_ACCOUNT)
    (cfg.root / "bakery.db").unlink()
    message = json.loads(run("stop", {"session_id": "s1"}, cfg.root))["systemMessage"]
    assert message.startswith("Receipts: couldn't build the receipts")
    assert run("stop", {"session_id": "s1"}, cfg.root) == ""


def test_shown_text_is_one_safe_line() -> None:
    text = stop.one_line("From \x1b[2J billing\x9b@flour\u202eco.example acct 9876543210")
    assert "9876543210" not in text and "••3210" in text
    assert all(not unicodedata.category(ch).startswith("C") for ch in text)


def test_unreadable_event_changes_nothing(cfg: config.Config) -> None:
    environment = {**os.environ, "CLAUDE_PROJECT_DIR": str(cfg.root)}
    for hook in ("guard", "log", "stop"):
        finished = subprocess.run(
            [sys.executable, str(RUN), hook], input="not json", env=environment,
            capture_output=True, text=True, check=False,
        )  # fmt: skip
        assert (finished.returncode, finished.stdout) == (0, "")
    assert not cfg.log_path.exists()


@pytest.mark.skipif(not Path(SYSTEM_PYTHON).exists(), reason="no system python3")
def test_hooks_run_on_the_system_python(cfg: config.Config) -> None:
    """Hooks run on whatever python3 the machine has (3.9 on macOS)."""
    out = json.loads(run("guard", pre(PAY_TOOL, CHANGED_ACCOUNT), cfg.root, SYSTEM_PYTHON))
    assert out["hookSpecificOutput"]["permissionDecision"] == "deny"
    attempt(cfg, CHANGED_ACCOUNT)
    assert "BILL-08" in run("stop", {"session_id": "s1"}, cfg.root, SYSTEM_PYTHON)


def test_hooks_json_wires_every_hook() -> None:
    hooks = json.loads((ROOT / "hooks" / "hooks.json").read_text())["hooks"]
    (guard,) = hooks["PreToolUse"][0]["hooks"]
    assert guard["command"].endswith('/hooks/run.py" guard') and guard["onFailure"] == "block"
    assert (
        hooks["PreToolUse"][0]["matcher"]
        == "^(mcp__.*|Edit|Write|MultiEdit|NotebookEdit|Read|Grep|Bash)$"
    )
    assert hooks["PostToolUse"][0]["hooks"][0]["command"].endswith('/hooks/run.py" log')
    assert hooks["Stop"][0]["hooks"][0]["command"].endswith('/hooks/run.py" stop')


def test_no_hook_needs_the_projects_virtualenv() -> None:
    assert shutil.which("python3")
    hooks = (ROOT / "hooks" / "hooks.json").read_text()
    assert ".venv" not in hooks


def test_stop_message_mentions_the_demo_source(cfg: config.Config) -> None:
    attempt(cfg, CHANGED_ACCOUNT)
    message = json.loads(run("stop", {"session_id": "s1"}, cfg.root))["systemMessage"]
    assert message.endswith(f"({config.DEMO_NOTE}.)")
