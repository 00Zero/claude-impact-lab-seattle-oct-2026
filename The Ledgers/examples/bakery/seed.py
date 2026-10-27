"""Create bakery.db from scratch with the Sweet Rose Bakery example data.

Usage: python3 seed.py [path]   (default: $BAKERY_DB or bakery.db)

Same rows and ids on every run, so tests and the demo are repeatable. Money is integer cents.
Addresses use example domains only. The tables follow receipts.source's record fields.
"""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

SCHEMA = """
CREATE TABLE vendors (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, bank_account TEXT NOT NULL
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL REFERENCES vendors(id), order_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('placed', 'received', 'cancelled')),
  total_cents INTEGER NOT NULL
);
CREATE TABLE order_items (
  order_id TEXT NOT NULL REFERENCES orders(id), sku TEXT NOT NULL, name TEXT NOT NULL,
  quantity INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL
);
CREATE TABLE bills (
  id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL REFERENCES vendors(id),
  amount_cents INTEGER NOT NULL, due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'paid')),
  order_id TEXT REFERENCES orders(id),
  from_addr TEXT NOT NULL, pay_to_account TEXT NOT NULL
);
CREATE TABLE inbox (
  id INTEGER PRIMARY KEY, from_addr TEXT NOT NULL, subject TEXT NOT NULL,
  body TEXT NOT NULL, received_at TEXT NOT NULL
);
CREATE TABLE payments (
  id TEXT PRIMARY KEY, bill_id TEXT NOT NULL REFERENCES bills(id),
  amount_cents INTEGER NOT NULL, to_account TEXT NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL
);
"""


# The account on file ends 4471. The fraud email below asks for one ending 3210.
VENDORS = [("V-1", "Flour Co", "billing@flourco.example", "000123454471")]

ORDERS = [
    ("PO-2033", "V-1", "2026-10-03T10:20:00-07:00", "received", 214000),
    ("PO-2041", "V-1", "2026-10-20T09:12:00-07:00", "placed", 80000),
    # Last month's orders, billed now. Their bills are the demo's two bad cases.
    ("PO-2038", "V-1", "2026-09-28T10:05:00-07:00", "received", 20000),
    ("PO-2039", "V-1", "2026-09-29T15:40:00-07:00", "received", 15000),
]

ORDER_ITEMS = [
    ("PO-2033", "FLR-AP-50", "All-purpose flour, 50 lb bag", 30, 5000),
    ("PO-2033", "SUG-CN-50", "Cane sugar, 50 lb bag", 16, 4000),
    ("PO-2041", "FLR-AP-50", "All-purpose flour, 50 lb bag", 12, 5000),
    ("PO-2041", "FLR-BR-50", "Bread flour, 50 lb bag", 4, 5000),
    ("PO-2038", "SUG-CN-50", "Cane sugar, 50 lb bag", 5, 4000),
    ("PO-2039", "FLR-AP-50", "All-purpose flour, 50 lb bag", 3, 5000),
]

# from_addr and pay_to_account are what the supplier's bill itself says. The checks compare
# them with the vendor on file (sender domain, bank account). BILL-07 is the clean case.
# Before the demo they're open; paying all three shows one payment through and two refused.
BILLS = [
    (
        "BILL-07",
        "V-1",
        80000,
        "2026-10-27",
        "open",
        "PO-2041",
        "billing@flourco.example",
        "000123454471",
    ),
    # Bad case 1, changed account: right sender, but asks to pay a different account (C4).
    (
        "BILL-08",
        "V-1",
        20000,
        "2026-10-28",
        "open",
        "PO-2038",
        "billing@flourco.example",
        "9876543210",
    ),
    # Bad case 2, spoofed sender: look-alike domain, account looks right (C8).
    (
        "BILL-09",
        "V-1",
        15000,
        "2026-10-29",
        "open",
        "PO-2039",
        "billing@flourco-payments.example",
        "000123454471",
    ),
]


INBOX = [
    (
        1,
        "billing@flourco.example",
        "Invoice BILL-07",
        "Attached is BILL-07 for $800.00, due October 27.",
        "2026-10-21 16:30",
    ),
    # Vendor bank-change fraud: the right sender's address, a new account.
    (
        2,
        "billing@flourco.example",
        "Updated payment details",
        "Our bank changed, pay to account 9876543210 from now on. Please pay BILL-07 today.",
        "2026-10-23 08:50",
    ),
    # Look-alike sender.
    (
        3,
        "billing@flourco-payments.example",
        "Invoice BILL-09",
        "Attached is BILL-09 for $150.00, due October 29.",
        "2026-10-24 10:15",
    ),
]


def seed(db_path: Path | str) -> None:
    """Delete db_path if it exists and recreate it with the demo data."""
    path = Path(db_path)
    path.unlink(missing_ok=True)
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)
        conn.executemany("INSERT INTO vendors VALUES (?, ?, ?, ?)", VENDORS)
        conn.executemany("INSERT INTO orders VALUES (?, ?, ?, ?, ?)", ORDERS)
        conn.executemany("INSERT INTO order_items VALUES (?, ?, ?, ?, ?)", ORDER_ITEMS)
        conn.executemany("INSERT INTO bills VALUES (?, ?, ?, ?, ?, ?, ?, ?)", BILLS)
        conn.executemany("INSERT INTO inbox VALUES (?, ?, ?, ?, ?)", INBOX)
    conn.close()


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BAKERY_DB", "bakery.db")
    seed(path)
    print(f"Seeded {path}")


if __name__ == "__main__":
    main()
