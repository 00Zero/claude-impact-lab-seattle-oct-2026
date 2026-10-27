from __future__ import annotations

import json
from pathlib import Path

import pytest

from examples.bakery.seed import seed
from receipts import config

EXAMPLE = Path(__file__).resolve().parent.parent / "examples" / "bakery"
PAY_TOOL = "mcp__bakery__pay_bill"
CLEAN = {"bill_id": "BILL-07", "amount_cents": 80000, "to_account": "000123454471"}
CHANGED_ACCOUNT = {"bill_id": "BILL-08", "amount_cents": 20000, "to_account": "9876543210"}
LOOKALIKE = {"bill_id": "BILL-09", "amount_cents": 15000, "to_account": "000123454471"}


@pytest.fixture(autouse=True)
def private_secrets(tmp_path_factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch):
    """Every test gets its own secrets folder, so no test touches the real ~/.config/receipts."""
    folder = tmp_path_factory.mktemp("secrets")
    monkeypatch.setenv("RECEIPTS_SECRETS_DIR", str(folder))
    return folder


@pytest.fixture
def db(tmp_path: Path) -> Path:
    """A freshly seeded example database; tests change rows here, never in the example."""
    path = tmp_path / "bakery.db"
    seed(path)
    return path


@pytest.fixture
def cfg(tmp_path: Path, db: Path) -> config.Config:
    """A Receipts project in tmp_path: the example's receipts.json next to a fresh database."""
    (tmp_path / "receipts.json").write_text((EXAMPLE / "receipts.json").read_text())
    loaded = config.load(tmp_path / "receipts.json")
    assert loaded is not None
    return loaded


def write_config(folder: Path, **changes: object) -> Path:
    data = json.loads((EXAMPLE / "receipts.json").read_text())
    data.update(changes)
    path = folder / "receipts.json"
    path.write_text(json.dumps(data))
    return path


def attempt(
    cfg: config.Config,
    args: dict,
    *,
    approve: bool = True,
    session: str = "s1",
    tool: str = PAY_TOOL,
) -> tuple[str, str] | None:
    """One payment tool call the way Claude Code runs it: the guard first; if it doesn't deny
    (and the owner approves an "ask"), the example server pays, then the log hook records it.
    Returns the guard's answer."""
    import os

    pytest.importorskip("mcp", reason="the example server needs the mcp package")
    from examples.bakery import server
    from receipts import guard, hook_log

    event = {"session_id": session, "tool_name": tool, "tool_input": args}
    answer = guard.decide({**event, "permission_mode": "default"}, cfg)
    if answer and (answer[0] == "deny" or (answer[0] == "ask" and not approve)):
        return answer
    old = os.environ.get("BAKERY_DB")
    os.environ["BAKERY_DB"] = str(cfg.root / "bakery.db")
    try:
        response = server.pay_bill(**args)
    finally:
        if old is None:
            os.environ.pop("BAKERY_DB")
        else:
            os.environ["BAKERY_DB"] = old
    hook_log.log_event({**event, "tool_response": response}, cfg)
    return answer
