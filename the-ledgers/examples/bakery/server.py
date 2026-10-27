"""bakery: a mock Sweet Rose Bakery back office as an MCP server, for trying Receipts.

Run: python server.py   (stdio, what Claude Code and the tests use)

The database path comes from BAKERY_DB (default bakery.db). This plays the business's real
systems, so it knows nothing about Receipts and runs no checks: pay_bill pays whatever it's
given. The Receipts guard is what stands in front of it.
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("bakery")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(os.environ.get("BAKERY_DB", "bakery.db"))
    conn.row_factory = sqlite3.Row
    return conn


@mcp.tool()
def list_bills(status: str = "open") -> dict:
    """List bills with the supplier's name, the order, who sent the bill and where it says to pay."""
    if status not in ("open", "paid", "all"):
        return {"ok": False, "error": "status must be open, paid or all"}
    with _connect() as conn:
        rows = conn.execute(
            "SELECT b.id, v.name AS vendor, b.amount_cents, b.due_date, b.status, b.order_id, "
            "b.from_addr, b.pay_to_account "
            "FROM bills b JOIN vendors v ON v.id = b.vendor_id "
            "WHERE ? = 'all' OR b.status = ? ORDER BY b.id",
            (status, status),
        ).fetchall()
    return {"ok": True, "bills": [dict(r) for r in rows]}


@mcp.tool()
def list_orders(status: str = "all") -> dict:
    """List purchase orders with the supplier's name and line items."""
    if status not in ("placed", "received", "cancelled", "all"):
        return {"ok": False, "error": "status must be placed, received, cancelled or all"}
    with _connect() as conn:
        orders = [
            dict(r)
            for r in conn.execute(
                "SELECT o.id, v.name AS vendor, o.order_date, o.status, o.total_cents "
                "FROM orders o JOIN vendors v ON v.id = o.vendor_id "
                "WHERE ? = 'all' OR o.status = ? ORDER BY o.id",
                (status, status),
            )
        ]
        for order in orders:
            order["items"] = [
                dict(r)
                for r in conn.execute(
                    "SELECT sku, name, quantity, unit_price_cents FROM order_items "
                    "WHERE order_id = ?",
                    (order["id"],),
                )
            ]
    return {"ok": True, "orders": orders}


@mcp.tool()
def read_inbox() -> dict:
    """Read every message in the bakery inbox, oldest first."""
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM inbox ORDER BY id").fetchall()
    return {"ok": True, "messages": [dict(r) for r in rows]}


@mcp.tool()
def pay_bill(bill_id: str, amount_cents: int, to_account: str) -> dict:
    """Pay a bill to the given bank account. Amount is in cents."""
    if not isinstance(bill_id, str) or not isinstance(to_account, str) or not to_account.strip():
        return {"ok": False, "error": "bill_id and to_account must be text"}
    if type(amount_cents) is not int or amount_cents <= 0:
        return {"ok": False, "error": "amount_cents must be a positive whole number"}
    with _connect() as conn:
        if not conn.execute("SELECT 1 FROM bills WHERE id = ?", (bill_id,)).fetchone():
            return {"ok": False, "error": "no such bill"}
        (count,) = conn.execute("SELECT COUNT(*) FROM payments").fetchone()
        pay_id = f"pay_{count + 1}"
        conn.execute(
            "INSERT INTO payments VALUES (?, ?, ?, ?, 'sent', ?)",
            (
                pay_id,
                bill_id,
                amount_cents,
                to_account,
                datetime.now().astimezone().isoformat(timespec="seconds"),
            ),
        )
        conn.execute("UPDATE bills SET status = 'paid' WHERE id = ?", (bill_id,))
    return {"ok": True, "id": pay_id}


if __name__ == "__main__":
    mcp.run("stdio")
