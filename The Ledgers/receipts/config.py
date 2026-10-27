"""The project's Receipts settings: receipts.json in the project folder.

    {
      "business": "Sweet Rose Bakery",
      "mode": "enforce",
      "source": {"type": "quickbooks", "environment": "production",
                 "realm_id": "9130350000000000", "client_id": "AB..."},
      "approval_threshold_cents": 50000,
      "require_purchase_order": true,
      "payment_tools": {
        "mcp__bakery__pay_bill": {
          "bill_id": "bill_id", "amount_cents": "amount_cents", "to_account": "to_account"
        }
      }
    }

source is where the business's records are read from, read-only:
- "quickbooks": QuickBooks Online through its API (receipts.quickbooks). This is the production
  source.
- "sqlite": a SQLite file (receipts.source.SqliteSource), for the example bakery and the tests
  only. It is never a business's real books, so the verifier and the end-of-turn summary say
  when it's in use.

mode is "enforce" (refuse failing payments, ask the owner over the threshold) or "watch" (check
and log every payment and report what would have been stopped, but never block: for a pilot).
require_purchase_order makes check C6 refuse bills that aren't linked to an open purchase order.
The owner's payee list lives outside the project, in Receipts' secrets folder (see
receipts.paths and receipts.payees).

payment_tools names every tool that moves money, and for each one which of its arguments hold
the bill id, the amount and the account paid. A bank transfer tool usually has no bill argument:
map bill_id to its memo or reference field, and a transfer that names no bill is refused. Set
"amount_unit": "dollars" when the tool takes dollars (a number or a string such as "800.00");
the default is cents. An amount that isn't a whole number of cents is refused. The guard checks only these tools, so a
tool that pays and isn't listed is not checked: list them all.

The file is found at env RECEIPTS_CONFIG, else $CLAUDE_PROJECT_DIR/receipts.json. A folder
without one isn't a Receipts project, and every hook stays silent there. Paths in the file are
relative to the file's folder.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path

from receipts import paths, payees, pii
from receipts.source import Source, SqliteSource

FILE_NAME = "receipts.json"
DEMO_NOTE = "Records come from the demo SQLite source, not real books"
DEFAULT_THRESHOLD_CENTS = 50000
MODES = ("enforce", "watch")
PAYMENT_FIELDS = ("bill_id", "amount_cents", "to_account")
# Bill references that are logged as they are: plain ids aren't secret, and masking a long
# numeric reference would stop the log matching it to its bill.
SAFE_REF = re.compile(r"[A-Za-z0-9._-]{1,40}")
AMOUNT_UNITS = ("cents", "dollars")


def to_cents(value: object, unit: str) -> object:
    """The amount in integer cents, or the value unchanged when it can't be one exactly (the
    checks then refuse it as not whole cents)."""
    if unit == "cents" or isinstance(value, bool):
        return value
    try:
        dollars = Decimal(str(value)) if isinstance(value, (int, float, str)) else None
    except InvalidOperation:
        return value
    if dollars is None or not dollars.is_finite():
        return value
    cents = dollars * 100
    return int(cents) if cents == cents.to_integral_value() else value


class ConfigError(Exception):
    """receipts.json exists but can't be used; the message says why, in plain words."""


@dataclass
class Config:
    path: Path
    business: str = ""
    source: dict = field(default_factory=dict)
    approval_threshold_cents: int = DEFAULT_THRESHOLD_CENTS
    payment_tools: dict[str, dict[str, str]] = field(default_factory=dict)
    amount_units: dict[str, str] = field(default_factory=dict)  # tool -> "cents" | "dollars"
    mode: str = "enforce"
    require_purchase_order: bool = True

    @property
    def root(self) -> Path:
        """The project folder: where receipts.json is, and where logs/ goes."""
        return self.path.parent

    @property
    def demo_source(self) -> bool:
        """Whether the records come from the demo SQLite source rather than real books."""
        return self.source.get("type") == "sqlite"

    @property
    def log_path(self) -> Path:
        return self.root / "logs" / "chain.jsonl"

    @property
    def receipts_dir(self) -> Path:
        return self.root / "logs" / "receipts"

    @property
    def payees_path(self) -> Path:
        return paths.payees_file(self.root)

    def load_payees(self) -> payees.Payees | None:
        """The owner's payee list, or None without one. Raises PayeesError if it's malformed."""
        return payees.load(self.payees_path)

    def payment_args(self, tool: str, tool_input: object) -> dict | None:
        """The payment's bill_id, amount_cents and to_account from a payment tool's arguments,
        or None if `tool` isn't a payment tool. A missing argument is left out, so the checks
        report it and block."""
        mapping = self.payment_tools.get(tool)
        if mapping is None:
            return None
        given = tool_input if isinstance(tool_input, dict) else {}
        args = {f: _lookup(given, mapping[f]) for f in PAYMENT_FIELDS}
        args = {f: v for f, v in args.items() if v is not _MISSING}
        if "amount_cents" in args:
            args["amount_cents"] = to_cents(
                args["amount_cents"], self.amount_units.get(tool, "cents")
            )
        return args

    def masked_input(self, tool: str, tool_input: object) -> object:
        """A tool's input for the log: numbers masked, except a payment tool's bill reference
        when it's a plain id (so the log can be matched to the bill)."""
        masked = pii.mask(tool_input)
        mapping = self.payment_tools.get(tool)
        if mapping and isinstance(masked, dict):
            raw = _lookup(tool_input, mapping["bill_id"]) if isinstance(tool_input, dict) else None
            if isinstance(raw, str) and SAFE_REF.fullmatch(raw):
                _put(masked, mapping["bill_id"], raw)
        return masked

    def open_source(self) -> Source:
        kind = self.source.get("type")
        if kind == "sqlite":
            return SqliteSource(self.root / str(self.source.get("path", "")))
        if kind == "quickbooks":
            from receipts.quickbooks import QuickBooksSource

            return QuickBooksSource.from_config(self.source)
        raise ConfigError(f'source type "{kind}" isn\'t supported')


_MISSING = object()


def _lookup(given: dict, path: str) -> object:
    """An argument by name, or by a dotted path into nested objects ("params.billPayment.Id")."""
    value: object = given
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return _MISSING
        value = value[part]
    return value


def _put(given: dict, path: str, value: object) -> None:
    *parents, last = path.split(".")
    for part in parents:
        given = given[part]
    given[last] = value


def config_path() -> Path:
    if os.environ.get("RECEIPTS_CONFIG"):
        return Path(os.environ["RECEIPTS_CONFIG"]).resolve()
    return Path(os.environ.get("CLAUDE_PROJECT_DIR") or ".").resolve() / FILE_NAME


def load(path: Path | None = None) -> Config | None:
    """The settings, or None when there's no receipts.json. Raises ConfigError when the file
    exists but is unreadable or malformed, so callers can fail closed."""
    path = path or config_path()
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, RecursionError) as exc:
        raise ConfigError(f"{FILE_NAME} can't be read ({type(exc).__name__})") from None
    if not isinstance(raw, dict):
        raise ConfigError(f"{FILE_NAME} must hold a JSON object")
    threshold = raw.get("approval_threshold_cents", DEFAULT_THRESHOLD_CENTS)
    if type(threshold) is not int or threshold < 0:
        raise ConfigError("approval_threshold_cents must be a whole number of cents, 0 or more")
    source = raw.get("source")
    if not isinstance(source, dict) or not isinstance(source.get("type"), str):
        raise ConfigError('source must be an object with a "type"')
    tools = raw.get("payment_tools")
    if not isinstance(tools, dict) or not tools:
        raise ConfigError("payment_tools must name at least one payment tool")
    for name, mapping in tools.items():
        if not isinstance(mapping, dict) or any(
            not isinstance(mapping.get(f), str) for f in PAYMENT_FIELDS
        ):
            raise ConfigError(f"payment_tools.{name} must map {', '.join(PAYMENT_FIELDS)}")
        if mapping.get("amount_unit", "cents") not in AMOUNT_UNITS:
            raise ConfigError(f'payment_tools.{name}.amount_unit must be "cents" or "dollars"')
    mode = raw.get("mode", "enforce")
    if mode not in MODES:
        raise ConfigError('mode must be "enforce" or "watch"')
    require_order = raw.get("require_purchase_order", True)
    if not isinstance(require_order, bool):
        raise ConfigError("require_purchase_order must be true or false")
    business = raw.get("business", "")
    return Config(
        path=path,
        business=business if isinstance(business, str) else "",
        source=source,
        approval_threshold_cents=threshold,
        payment_tools={n: {f: m[f] for f in PAYMENT_FIELDS} for n, m in tools.items()},
        amount_units={n: m.get("amount_unit", "cents") for n, m in tools.items()},
        mode=mode,
        require_purchase_order=require_order,
    )
