"""The example bakery and the command line, the way a user runs them."""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from receipts import config
from tests.conftest import CHANGED_ACCOUNT, CLEAN, EXAMPLE, attempt

server = pytest.importorskip("examples.bakery.server", reason="needs the mcp package")

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def bakery(db: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("BAKERY_DB", str(db))
    return db


def test_server_registers_its_tools() -> None:
    names = {t.name for t in asyncio.run(server.mcp.list_tools())}
    assert names == {"list_bills", "list_orders", "read_inbox", "pay_bill"}


def test_server_pays_whatever_it_is_given(bakery: Path) -> None:
    # The example plays a real system: it runs no checks. The guard is what stops this.
    assert server.pay_bill(**CHANGED_ACCOUNT) == {"ok": True, "id": "pay_1"}
    assert server.list_bills("paid")["bills"][0]["id"] == "BILL-08"


@pytest.mark.parametrize(
    "args",
    [
        {"bill_id": "BILL-99", "amount_cents": 1, "to_account": "1"},
        {"bill_id": "BILL-07", "amount_cents": 0, "to_account": "1"},
        {"bill_id": "BILL-07", "amount_cents": 1, "to_account": " "},
    ],
)
def test_server_refuses_malformed_calls(bakery: Path, args: dict) -> None:
    assert server.pay_bill(**args)["ok"] is False


def test_server_lists_orders_and_inbox(bakery: Path) -> None:
    orders = {o["id"]: o for o in server.list_orders()["orders"]}
    assert len(orders["PO-2041"]["items"]) == 2
    assert any("bank changed" in m["body"] for m in server.read_inbox()["messages"])


def test_example_mcp_config_points_at_the_server() -> None:
    mcp = json.loads((EXAMPLE / ".mcp.json").read_text())["mcpServers"]["bakery"]
    assert (EXAMPLE / mcp["args"][0]).is_file()
    assert set(config.load(EXAMPLE / "receipts.json").payment_tools) == {"mcp__bakery__pay_bill"}


def cli(*args: str, project: Path) -> subprocess.CompletedProcess:
    env = {**os.environ, "PYTHONPATH": str(ROOT), "RECEIPTS_CONFIG": str(project / "receipts.json")}
    return subprocess.run(
        [sys.executable, "-m", "receipts", *args],
        cwd=project,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_cli_verify(cfg: config.Config) -> None:
    attempt(cfg, CLEAN)
    done = cli("verify", project=cfg.root)
    assert done.returncode == 0
    assert "BILL-07 ($800.00 to Flour Co): VERIFIED" in done.stdout
    log = cfg.log_path
    log.write_text(log.read_text().replace('"amount_cents":80000', '"amount_cents":8000', 1))
    done = cli("verify", project=cfg.root)
    assert done.returncode == 1 and "BROKEN" in done.stdout


def test_cli_check(cfg: config.Config) -> None:
    assert cli("check", "BILL-07", "80000", "000123454471", project=cfg.root).returncode == 0
    done = cli("check", "BILL-08", "20000", "9876543210", project=cfg.root)
    assert done.returncode == 1 and "BLOCK   C4" in done.stdout
    assert "9876543210" not in done.stdout


def test_cli_outside_a_project(tmp_path: Path) -> None:
    done = cli("verify", project=tmp_path)
    assert done.returncode == 1 and "no receipts.json" in done.stderr
