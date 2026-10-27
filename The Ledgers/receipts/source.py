"""Where Receipts reads the business's records from. It never writes to them.

A Source is a read-only connector to the system that holds the bills, orders, suppliers and
payments (for example an accounting API). Any object with these methods works. Records are
plain dicts with these fields:

  vendor:  id, name, email, bank_account
  bill:    id, vendor_id, order_id, from_addr, pay_to_account, amount_cents, due_date, status
  order:   id, vendor_id, order_date, total_cents, status
  item:    order_id, name, quantity, unit_price_cents
  payment: id, bill_id, amount_cents, to_account, status, created_at

SqliteSource is the demo and test connector: it reads a SQLite file whose tables are named
vendors, bills, orders, order_items and payments, with those fields as columns. Real businesses
use the QuickBooks connector (receipts.quickbooks). It opens the file read-only, so nothing that judges
the records can change them. It backs the example bakery and the tests. Use one per decision:
sqlite3 connections can't be shared between threads.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Protocol


class SourceError(Exception):
    """A connector couldn't read the records. The message is safe to show the owner: it holds
    no secrets and no account numbers."""


class Source(Protocol):
    def vendor(self, vendor_id: str) -> dict | None: ...
    def bill(self, bill_id: str) -> dict | None: ...
    def order(self, order_id: str) -> dict | None: ...
    def order_items(self, order_id: str) -> list[dict]: ...
    def payments_for_bill(self, bill_id: str) -> list[dict]: ...


class SqliteSource:
    """A Source over a SQLite file, opened read-only. For the example bakery and the tests."""

    def __init__(self, db_path: Path | str) -> None:
        # The file URI form, with special characters escaped, so a name containing "?" or "#"
        # can't change the mode=ro option. mode=ro also refuses to create a missing file.
        location = Path(db_path).resolve().as_uri() + "?mode=ro"
        self._db = sqlite3.connect(location, uri=True)
        self._db.row_factory = sqlite3.Row

    def _rows(self, table: str, column: str, value: object, order: str = "") -> list[dict]:
        statement = f"SELECT * FROM {table} WHERE {column} = ?" + (
            f" ORDER BY {order}" if order else ""
        )
        return [dict(row) for row in self._db.execute(statement, (value,))]

    def _first(self, table: str, record_id: object) -> dict | None:
        found = self._rows(table, "id", record_id)
        return found[0] if found else None

    def vendor(self, vendor_id: str) -> dict | None:
        return self._first("vendors", vendor_id)

    def bill(self, bill_id: str) -> dict | None:
        return self._first("bills", bill_id)

    def order(self, order_id: str) -> dict | None:
        return self._first("orders", order_id)

    def order_items(self, order_id: str) -> list[dict]:
        return self._rows("order_items", "order_id", order_id)

    def payments_for_bill(self, bill_id: str) -> list[dict]:
        return self._rows("payments", "bill_id", bill_id, order="id")

    def close(self) -> None:
        self._db.close()

    def __enter__(self) -> SqliteSource:  # noqa: PYI034 - typing.Self needs Python 3.11
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
