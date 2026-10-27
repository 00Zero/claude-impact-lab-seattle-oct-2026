"""The QuickBooks connector against a fake QuickBooks Online on localhost.

The fake serves the shapes in Intuit's schemas (QuickBooks-V3-Java-SDK Finance.xsd and
IntuitNamesTypes.xsd): {"Bill": {...}} for a read, {"QueryResponse": {"Bill": [...]}} for a
query, amounts in decimal dollars, references as {"value": ..., "name": ...}.
"""

from __future__ import annotations

import json
import re
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import ClassVar

import pytest

from receipts import config, guard, payees, quickbooks

REALM = "9130350000000000"

VENDORS = {
    "56": {"Id": "56", "DisplayName": "Flour Co", "Active": True,
           "PrimaryEmailAddr": {"Address": "billing@flourco.example"}},
}  # fmt: skip
POS = {
    "201": {"Id": "201", "VendorRef": {"value": "56"}, "TotalAmt": 800.0, "POStatus": "Closed",
            "TxnDate": "2026-10-20",
            "Line": [{"Description": "All-purpose flour", "Amount": 600.0,
                      "ItemBasedExpenseLineDetail": {"Qty": 12, "UnitPrice": 50.0}}]},
    "202": {"Id": "202", "VendorRef": {"value": "56"}, "TotalAmt": 200.0, "POStatus": "Closed",
            "ManuallyClosed": True},
}  # fmt: skip
BILLS = {
    "301": {"Id": "301", "DocNumber": "BILL-07", "VendorRef": {"value": "56", "name": "Flour Co"},
            "TotalAmt": 800.0, "Balance": 800.0, "DueDate": "2026-10-27",
            "CurrencyRef": {"value": "USD"},
            "Line": [{"Amount": 800.0, "LinkedTxn": [{"TxnId": "201", "TxnType": "PurchaseOrder"}]}]},
    "302": {"Id": "302", "DocNumber": "BILL-08", "VendorRef": {"value": "56"},
            "TotalAmt": 200.0, "Balance": 0, "DueDate": "2026-10-28",
            "LinkedTxn": [{"TxnId": "202", "TxnType": "PurchaseOrder"}]},
    "303": {"Id": "303", "DocNumber": "DUP", "VendorRef": {"value": "56"}, "TotalAmt": 1, "Balance": 1},
    "304": {"Id": "304", "DocNumber": "DUP", "VendorRef": {"value": "56"}, "TotalAmt": 1, "Balance": 1},
}  # fmt: skip
BILL_PAYMENTS = [
    {"Id": "401", "VendorRef": {"value": "56"}, "TotalAmt": 200.0, "PayType": "Check",
     "TxnDate": "2026-10-25",
     "Line": [{"Amount": 200.0, "LinkedTxn": [{"TxnId": "302", "TxnType": "Bill"}]}]},
]  # fmt: skip


class FakeQuickBooks(BaseHTTPRequestHandler):
    tokens: ClassVar[dict] = {}
    calls: ClassVar[list] = []
    throttle = False
    expire_next = False
    delay = 0.0
    extra_payments: ClassVar[list] = []

    def log_message(self, *args: object) -> None:
        pass

    def _send(self, code: int, body: object) -> None:
        raw = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self) -> None:  # the token endpoint
        form = urllib.parse.parse_qs(self.rfile.read(int(self.headers["Content-Length"])).decode())
        self.calls.append(("token", form))
        if form.get("refresh_token") != [self.tokens["refresh"]]:
            return self._send(400, {"error": "invalid_grant"})
        self.tokens["refresh"] = self.tokens["refresh"] + "-rotated"
        self.tokens["access"] = f"access-{len(self.calls)}"
        return self._send(
            200,
            {"access_token": self.tokens["access"], "refresh_token": self.tokens["refresh"],
             "expires_in": 3600},
        )  # fmt: skip

    def do_GET(self) -> None:
        time.sleep(self.delay)
        url = urllib.parse.urlsplit(self.path)
        params = urllib.parse.parse_qs(url.query)
        self.calls.append(("get", url.path, params))
        if self.throttle:
            return self._send(429, {"Fault": {}})
        if self.expire_next:
            FakeQuickBooks.expire_next = False
            return self._send(401, {"Fault": {}})
        if self.headers.get("Authorization") != f"Bearer {self.tokens.get('access')}":
            return self._send(401, {"Fault": {}})
        assert params["minorversion"] == ["75"]
        parts = url.path.split("/")  # /v3/company/{realm}/{entity}[/{id}]
        assert parts[3] == REALM
        if parts[4] == "query":
            return self._query(params["query"][0])
        table = {"bill": BILLS, "vendor": VENDORS, "purchaseorder": POS}[parts[4]]
        entity = {"bill": "Bill", "vendor": "Vendor", "purchaseorder": "PurchaseOrder"}[parts[4]]
        if parts[5] not in table:
            return self._send(400, {"Fault": {"Error": [{"Message": "Object Not Found"}]}})
        return self._send(200, {entity: table[parts[5]], "time": "2026-10-26T10:00:00-07:00"})

    def _query(self, sql: str) -> None:
        match = re.fullmatch(
            r"select \* from (\w+) where (.+) STARTPOSITION (\d+) MAXRESULTS (\d+)", sql
        )
        assert match, sql
        entity, where, start, size = match[1], match[2], int(match[3]), int(match[4])
        if entity == "Bill" and where.startswith("DocNumber = "):
            number = where.split("= ")[1].strip("'")
            rows = [b for b in BILLS.values() if b["DocNumber"] == number]
        elif entity == "BillPayment" and where == "VendorRef = '56'":
            rows = self.extra_payments + BILL_PAYMENTS
        elif entity == "Bill" and where.startswith("Balance"):
            rows = [BILLS["301"]]
        else:
            rows = []
        page = rows[start - 1 : start - 1 + size]
        return self._send(200, {"QueryResponse": {entity: page} if page else {}})


@pytest.fixture
def fake(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    FakeQuickBooks.tokens = {"refresh": "refresh-1"}
    FakeQuickBooks.calls = []
    FakeQuickBooks.throttle = False
    FakeQuickBooks.expire_next = False
    FakeQuickBooks.delay = 0.0
    FakeQuickBooks.extra_payments = []
    server = HTTPServer(("127.0.0.1", 0), FakeQuickBooks)
    threading.Thread(target=server.serve_forever, args=(0.02,), daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    monkeypatch.setenv("RECEIPTS_SECRETS_DIR", str(tmp_path / "secrets"))
    monkeypatch.setattr(quickbooks, "TOKEN_URL", f"{base}/oauth2/v1/tokens/bearer")
    monkeypatch.setitem(quickbooks.BASE_URLS, "sandbox", f"{base}/v3/company")
    quickbooks.TokenStore(REALM).save({"client_secret": "s3cret", "refresh_token": "refresh-1"})
    yield FakeQuickBooks
    server.shutdown()


@pytest.fixture
def source(fake) -> quickbooks.QuickBooksSource:
    settings = {
        "type": "quickbooks",
        "realm_id": REALM,
        "client_id": "app",
        "environment": "sandbox",
    }
    return quickbooks.QuickBooksSource.from_config(settings)


def test_bill_by_number_and_by_id(source) -> None:
    by_number, by_id = source.bill("BILL-07"), source.bill("301")
    assert by_number["qbo_id"] == by_id["qbo_id"] == "301"
    assert by_number == {
        "id": "BILL-07", "qbo_id": "301", "vendor_id": "56", "order_id": "201",
        "amount_cents": 80000, "balance_cents": 80000, "due_date": "2026-10-27",
        "currency": "USD", "status": "open",
    }  # fmt: skip
    assert "from_addr" not in by_number  # QuickBooks doesn't record the sender


def test_paid_bill_and_its_payments(source) -> None:
    assert source.bill("BILL-08")["status"] == "paid"
    (payment,) = source.payments_for_bill("BILL-08")
    assert payment["amount_cents"] == 20000 and payment["to_account"] is None
    assert source.payments_for_bill("BILL-07") == []


def test_vendor_and_orders(source) -> None:
    assert source.vendor("56") == {
        "id": "56", "name": "Flour Co", "email": "billing@flourco.example",
        "bank_account": None, "active": True,
    }  # fmt: skip
    assert source.order("201")["status"] == "received"
    assert source.order("202")["status"] == "closed"  # closed by hand
    assert source.order_items("201") == [
        {"order_id": "201", "name": "All-purpose flour", "quantity": 12, "unit_price_cents": 5000}
    ]
    assert source.vendor("999") is None and source.bill("BILL-99") is None


def test_payments_beyond_the_first_page_are_found(source, fake, monkeypatch) -> None:
    monkeypatch.setattr(quickbooks, "PAGE_SIZE", 2)
    other = {"Id": "x", "VendorRef": {"value": "56"}, "TotalAmt": 1, "Line": []}
    fake.extra_payments = [dict(other, Id=str(i)) for i in range(5)]  # the real one is 6th
    (payment,) = source.payments_for_bill("BILL-08")
    assert payment["id"] == "qbo-billpayment-401"


def test_slow_quickbooks_hits_the_deadline(source, fake) -> None:
    source.client.start_clock(0.3)
    fake.delay = 0.2
    with pytest.raises(quickbooks.QuickBooksError, match="took too long|couldn't be reached"):
        source.bill("BILL-07")
        source.vendor("56")
        source.payments_for_bill("BILL-07")


def test_ambiguous_bill_number_raises(source) -> None:
    with pytest.raises(quickbooks.QuickBooksError, match="more than one"):
        source.bill("DUP")


def test_odd_bill_id_never_reaches_the_query(source, fake) -> None:
    assert source.bill("x' or 1=1 --") is None
    assert not any("or 1=1" in str(c) for c in fake.calls)


def test_tokens_refresh_and_rotate(source, fake, tmp_path: Path) -> None:
    source.bill("BILL-07")
    source.vendor("56")
    tokens = [c for c in fake.calls if c[0] == "token"]
    assert len(tokens) == 1  # the access token is reused until it expires
    stored = json.loads((tmp_path / "secrets" / f"quickbooks-{REALM}.json").read_text())
    assert stored["refresh_token"] == "refresh-1-rotated"
    assert oct((tmp_path / "secrets" / f"quickbooks-{REALM}.json").stat().st_mode)[-3:] == "600"


def test_expired_access_token_is_refreshed_once(source, fake) -> None:
    source.vendor("56")
    fake.expire_next = True
    assert source.vendor("56")["name"] == "Flour Co"
    assert len([c for c in fake.calls if c[0] == "token"]) == 2


def test_rate_limit_raises(source, fake) -> None:
    fake.throttle = True
    with pytest.raises(quickbooks.QuickBooksError, match="rate-limiting"):
        source.vendor("56")


def test_not_signed_in(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RECEIPTS_SECRETS_DIR", str(tmp_path / "empty"))
    with pytest.raises(quickbooks.QuickBooksError, match="not signed in"):
        quickbooks.TokenStore(REALM).load()


def test_dollar_amounts_become_exact_cents() -> None:
    assert quickbooks.cents(800.0) == 80000 and quickbooks.cents("0.1") == 10
    with pytest.raises(quickbooks.QuickBooksError):
        quickbooks.cents("0.001")


# ---------- the guard with QuickBooks records and a bank transfer tool ----------

BANK_TOOL = "mcp__bank__send_transfer"


@pytest.fixture
def project(tmp_path: Path, fake) -> config.Config:
    settings = {
        "business": "Sweet Rose Bakery",
        "source": {"type": "quickbooks", "realm_id": REALM, "client_id": "app",
                   "environment": "sandbox"},
        "approval_threshold_cents": 100000,
        "require_purchase_order": False,
        "payment_tools": {
            BANK_TOOL: {"bill_id": "memo", "amount_cents": "amount", "to_account": "account_number",
                        "amount_unit": "dollars"},
        },
    }  # fmt: skip
    (tmp_path / "receipts.json").write_text(json.dumps(settings))
    cfg = config.load(tmp_path / "receipts.json")
    found = payees.load_or_new(cfg.payees_path)
    found.add("56", "Flour Co", "000123454471", ["flourco.example"])
    found.save()
    return cfg


def transfer(cfg: config.Config, **tool_input: object):
    event = {"session_id": "s1", "tool_name": BANK_TOOL, "tool_input": tool_input}
    return guard.decide(event, cfg)


def test_transfer_to_a_listed_account_for_an_open_bill_passes(project) -> None:
    assert transfer(project, memo="BILL-07", amount="800.00", account_number="000123454471") is None


def test_transfer_to_a_new_account_is_refused(project) -> None:
    decision, reason = transfer(project, memo="BILL-07", amount=800, account_number="9876543210")
    assert decision == "deny" and "isn't one of Flour Co's accounts" in reason


def test_transfer_for_a_paid_bill_is_refused(project) -> None:
    decision, reason = transfer(project, memo="BILL-08", amount=200, account_number="000123454471")
    assert decision == "deny" and "C7:" in reason


def test_transfer_naming_no_bill_is_refused(project) -> None:
    decision, reason = transfer(project, amount=800, account_number="000123454471")
    assert decision == "deny" and "missing bill_id" in reason


def test_wrong_amount_or_fractional_cents_is_refused(project) -> None:
    assert (
        transfer(project, memo="BILL-07", amount="80.00", account_number="000123454471")[0]
        == "deny"
    )
    decision, reason = transfer(
        project, memo="BILL-07", amount="800.001", account_number="000123454471"
    )
    assert decision == "deny" and "whole cents" in reason


def test_quickbooks_outage_refuses_the_transfer(project, fake) -> None:
    fake.throttle = True
    decision, reason = transfer(project, memo="BILL-07", amount=800, account_number="000123454471")
    assert decision == "deny" and "Records couldn't be read" in reason


def test_claude_cant_read_the_stored_sign_in(project, tmp_path: Path) -> None:
    secret = tmp_path / "secrets" / f"quickbooks-{REALM}.json"
    event = {"tool_name": "Read", "tool_input": {"file_path": str(secret)}}
    assert guard.decide(event, project)[0] == "deny"
