import json
from pathlib import Path

import pytest

from receipts import config
from tests.conftest import EXAMPLE, PAY_TOOL, write_config


def test_example_config_loads() -> None:
    cfg = config.load(EXAMPLE / "receipts.json")
    assert cfg is not None
    assert cfg.business == "Sweet Rose Bakery"
    assert cfg.approval_threshold_cents == 50000
    assert cfg.log_path == EXAMPLE / "logs" / "chain.jsonl"
    assert PAY_TOOL in cfg.payment_tools


def test_no_file_means_not_a_receipts_project(tmp_path: Path) -> None:
    assert config.load(tmp_path / "receipts.json") is None


def test_found_through_the_project_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    write_config(tmp_path)
    monkeypatch.delenv("RECEIPTS_CONFIG", raising=False)
    monkeypatch.setenv("CLAUDE_PROJECT_DIR", str(tmp_path))
    assert config.load().root == tmp_path.resolve()


@pytest.mark.parametrize(
    ("text", "message"),
    [
        ("{nope", "can't be read"),
        ("[]", "JSON object"),
        (json.dumps({"payment_tools": {"t": {}}}), "source"),
        (json.dumps({"source": {"type": "sqlite"}}), "payment_tools"),
        (
            json.dumps({"source": {"type": "sqlite"}, "payment_tools": {"t": {"bill_id": "b"}}}),
            "payment_tools.t",
        ),
        (
            json.dumps(
                {
                    "source": {"type": "sqlite"},
                    "payment_tools": {"t": {}},
                    "approval_threshold_cents": "500",
                }
            ),
            "approval_threshold_cents",
        ),
    ],
)
def test_broken_file_raises(tmp_path: Path, text: str, message: str) -> None:
    path = tmp_path / "receipts.json"
    path.write_text(text)
    with pytest.raises(config.ConfigError, match=message):
        config.load(path)


def test_payment_args_maps_and_leaves_out_missing(tmp_path: Path) -> None:
    tools = {"t": {"bill_id": "ref", "amount_cents": "cents", "to_account": "acct"}}
    cfg = config.load(write_config(tmp_path, payment_tools=tools))
    assert cfg.payment_args("t", {"ref": "B", "cents": 5}) == {"bill_id": "B", "amount_cents": 5}
    assert cfg.payment_args("other", {"ref": "B"}) is None
    assert cfg.payment_args("t", "not a dict") == {}


@pytest.mark.parametrize(
    ("value", "expected"),
    [(800, 80000), ("800.00", 80000), (0.1, 10), ("1e2", 10000), ("800.001", "800.001"),
     ("abc", "abc"), (True, True), (None, None), ("nan", "nan")],
)  # fmt: skip
def test_dollars_become_exact_cents_or_stay_as_given(value: object, expected: object) -> None:
    assert config.to_cents(value, "dollars") == expected
    assert config.to_cents(value, "cents") == value


def test_dotted_argument_paths(tmp_path: Path) -> None:
    tools = {
        "mcp__qbo__create_bill_payment": {
            "bill_id": "params.billPayment.PrivateNote",
            "amount_cents": "params.billPayment.TotalAmt",
            "to_account": "params.account",
            "amount_unit": "dollars",
        }
    }
    cfg = config.load(write_config(tmp_path, payment_tools=tools))
    given = {"params": {"billPayment": {"PrivateNote": "BILL-07", "TotalAmt": 800.0}}}
    assert cfg.payment_args("mcp__qbo__create_bill_payment", given) == {
        "bill_id": "BILL-07",
        "amount_cents": 80000,
    }


def test_bad_amount_unit(tmp_path: Path) -> None:
    tools = {"t": {"bill_id": "b", "amount_cents": "a", "to_account": "c", "amount_unit": "euros"}}
    with pytest.raises(config.ConfigError, match="amount_unit"):
        config.load(write_config(tmp_path, payment_tools=tools))
