"""Read-only connector to QuickBooks Online: bills, vendors, purchase orders and bill payments.

In receipts.json:

    "source": {
      "type": "quickbooks",
      "environment": "production",          # or "sandbox"
      "realm_id": "9130350000000000",       # the QuickBooks company id
      "client_id": "AB..."                  # the Intuit app's client id
    }

The app's client secret and the OAuth refresh token are secrets: the owner stores them with
`python3 -m receipts quickbooks login` (hidden prompts). They go to the macOS Keychain, or on
other systems to a file only the owner can read, outside the project folder. Never in
receipts.json, which Claude can read.

Mapping to Receipts' records (receipts.source):
- bill: looked up by QuickBooks Id when the bill id is all digits, else by its bill number
  (DocNumber). Balance 0 means paid. QuickBooks doesn't record the address a bill came from or
  an account it asks to be paid to, so those fields are absent (check C8 reports "unknown").
- vendor: DisplayName and PrimaryEmailAddr. QuickBooks keeps no US vendor bank details (only
  Australian), so check C4 needs the owner's payee list.
- order: a purchase order the bill links to. POStatus "Open" counts as placed and "Closed" as
  received; a purchase order closed by hand counts as closed, which check C6 refuses.
- payments: bill payments whose lines link to the bill. They record payments (by check or
  card); they hold no destination account.

Every failure (network, sign-in, rate limit, an ambiguous bill number) raises QuickBooksError,
so the guard refuses the payment.
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal

from receipts.paths import secrets_dir
from receipts.source import SourceError

BASE_URLS = {
    "production": "https://quickbooks.api.intuit.com/v3/company",
    "sandbox": "https://sandbox-quickbooks.api.intuit.com/v3/company",
}
TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
MINOR_VERSION = "75"
TIMEOUT_S = 10  # per request
DEADLINE_S = 20  # for all of one guard decision's requests: under Claude Code's 30s hook limit
PAGE_SIZE = 1000  # QuickBooks' largest MAXRESULTS
MAX_PAGES = 20
KEYCHAIN_SERVICE = "receipts-quickbooks"
SAFE_ID = re.compile(r"[A-Za-z0-9._-]{1,40}")


class QuickBooksError(SourceError):
    """QuickBooks couldn't be read; the message is safe to show (no tokens, no account data)."""


def cents(amount: object) -> int:
    """QuickBooks amounts are decimal dollars; Receipts uses integer cents."""
    if isinstance(amount, bool) or not isinstance(amount, (int, float, str)):
        raise QuickBooksError(f"unexpected amount {amount!r}")
    value = Decimal(str(amount)) * 100
    if value != value.to_integral_value():
        raise QuickBooksError(f"amount {amount} isn't a whole number of cents")
    return int(value)


# ---------- secrets ----------


class TokenStore:
    """The client secret and OAuth tokens for one QuickBooks company, kept out of the project.

    macOS: the login Keychain (via the `security` tool). Elsewhere: a JSON file with mode 0600
    in $XDG_CONFIG_HOME/receipts (default ~/.config/receipts), or RECEIPTS_SECRETS_DIR.
    """

    def __init__(self, realm_id: str) -> None:
        self.realm_id = realm_id
        self.keychain = sys.platform == "darwin" and shutil.which("security") is not None
        self.file = secrets_dir() / f"quickbooks-{realm_id}.json"
        if os.environ.get("RECEIPTS_SECRETS_DIR"):
            self.keychain = False  # an explicit folder wins (tests, servers)

    def load(self) -> dict:
        if self.keychain:
            done = subprocess.run(
                ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a",
                 self.realm_id, "-w"],
                capture_output=True, text=True, check=False,
            )  # fmt: skip
            raw = done.stdout.strip() if done.returncode == 0 else ""
        else:
            raw = self.file.read_text(encoding="utf-8") if self.file.exists() else ""
        if not raw:
            raise QuickBooksError(
                "not signed in to QuickBooks: run `python3 -m receipts quickbooks login`"
            )
        try:
            data = json.loads(raw)
        except ValueError:
            raise QuickBooksError(
                "the stored QuickBooks sign-in is damaged; log in again"
            ) from None
        if not isinstance(data, dict) or not data.get("refresh_token"):
            raise QuickBooksError("the stored QuickBooks sign-in is incomplete; log in again")
        return data

    def save(self, data: dict) -> None:
        raw = json.dumps(data)
        if self.keychain:
            # -U updates an existing item. The value is briefly visible to this user's own
            # processes as an argument; the Keychain itself is encrypted at rest.
            done = subprocess.run(
                ["security", "add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a",
                 self.realm_id, "-w", raw],
                capture_output=True, text=True, check=False,
            )  # fmt: skip
            if done.returncode != 0:
                raise QuickBooksError("couldn't save the QuickBooks sign-in to the Keychain")
            return
        self.file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        tmp = self.file.with_suffix(f".tmp{os.getpid()}")
        tmp.write_text(raw, encoding="utf-8")
        os.chmod(tmp, 0o600)
        os.replace(tmp, self.file)


# ---------- HTTP ----------


def _request(req: urllib.request.Request, deadline: float | None = None) -> dict:
    timeout = float(TIMEOUT_S)
    if deadline is not None:
        timeout = min(timeout, deadline - time.monotonic())
        if timeout <= 0:
            raise QuickBooksError("QuickBooks took too long to answer")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise QuickBooksError(
                "QuickBooks is rate-limiting requests; try again in a minute"
            ) from None
        raise QuickBooksError(f"QuickBooks answered HTTP {exc.code}") from exc
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise QuickBooksError(f"QuickBooks couldn't be reached ({type(exc).__name__})") from None


class Client:
    """A minimal QuickBooks Online Accounting API client: read one entity, run one query."""

    def __init__(
        self,
        realm_id: str,
        client_id: str,
        store: TokenStore,
        environment: str = "production",
        base_url: str | None = None,
        token_url: str | None = None,
    ) -> None:
        if environment not in BASE_URLS:
            raise QuickBooksError('environment must be "production" or "sandbox"')
        if not re.fullmatch(r"[0-9]{1,30}", realm_id):
            raise QuickBooksError("realm_id must be the QuickBooks company id (digits)")
        self.realm_id, self.client_id, self.store = realm_id, client_id, store
        self.base = (base_url or BASE_URLS[environment]).rstrip("/") + f"/{realm_id}"
        self.token_url = token_url or TOKEN_URL
        self.deadline: float | None = None  # time.monotonic() by which every request must end

    def start_clock(self, seconds: float = DEADLINE_S) -> None:
        self.deadline = time.monotonic() + seconds

    def _access_token(self, force: bool = False) -> str:
        data = self.store.load()
        if not force and data.get("access_token") and data.get("expires_at", 0) > time.time() + 60:
            return data["access_token"]
        secret = data.get("client_secret", "")
        basic = base64.b64encode(f"{self.client_id}:{secret}".encode()).decode()
        body = urllib.parse.urlencode(
            {"grant_type": "refresh_token", "refresh_token": data["refresh_token"]}
        ).encode()
        req = urllib.request.Request(
            self.token_url,
            data=body,
            method="POST",
            headers={
                "Authorization": f"Basic {basic}",
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        try:
            token = _request(req, self.deadline)
        except QuickBooksError as exc:
            raise QuickBooksError(f"QuickBooks sign-in failed ({exc}); log in again") from None
        if not token.get("access_token"):
            raise QuickBooksError("QuickBooks sign-in returned no access token; log in again")
        # Refresh tokens rotate: always keep the newest one.
        data.update(
            access_token=token["access_token"],
            expires_at=time.time() + float(token.get("expires_in", 3600)),
            refresh_token=token.get("refresh_token", data["refresh_token"]),
        )
        self.store.save(data)
        return data["access_token"]

    def _get(self, path: str, params: dict | None = None) -> dict:
        query = urllib.parse.urlencode({**(params or {}), "minorversion": MINOR_VERSION})
        url = f"{self.base}/{path}?{query}"
        for attempt in (0, 1):
            req = urllib.request.Request(
                url,
                headers={
                    "Authorization": f"Bearer {self._access_token(force=attempt == 1)}",
                    "Accept": "application/json",
                },
            )
            try:
                return _request(req, self.deadline)
            except QuickBooksError as exc:
                cause = exc.__cause__
                if attempt == 0 and isinstance(cause, urllib.error.HTTPError) and cause.code == 401:
                    continue  # the access token was revoked or expired early: refresh once
                raise
        raise QuickBooksError("QuickBooks rejected the sign-in")  # pragma: no cover

    def read(self, entity: str, entity_id: str) -> dict | None:
        """One entity by Id, or None if QuickBooks has no such entity."""
        if not entity_id.isdigit():
            return None
        try:
            body = self._get(f"{entity.lower()}/{entity_id}")
        except QuickBooksError as exc:
            cause = exc.__cause__
            if isinstance(cause, urllib.error.HTTPError) and cause.code in (400, 404):
                return None
            raise
        found = body.get(entity)
        return found if isinstance(found, dict) else None

    def query(self, entity: str, where: str, limit: int | None = None) -> list[dict]:
        """Every matching row (or the first `limit`), page by page: QuickBooks returns at most
        PAGE_SIZE rows at a time."""
        found: list[dict] = []
        size = min(limit, PAGE_SIZE) if limit else PAGE_SIZE
        for page in range(MAX_PAGES):
            sql = (
                f"select * from {entity} where {where} "
                f"STARTPOSITION {page * size + 1} MAXRESULTS {size}"
            )
            body = self._get("query", {"query": sql})
            rows = (body.get("QueryResponse") or {}).get(entity) or []
            found += [r for r in rows if isinstance(r, dict)]
            if len(rows) < size or (limit and len(found) >= limit):
                return found[:limit] if limit else found
        raise QuickBooksError(f"more than {MAX_PAGES * PAGE_SIZE} {entity} rows; narrow the query")


def _quote(value: str) -> str:
    """A value for QuickBooks' query language. Only SAFE_ID values get here, which can't hold
    a quote; escape anyway."""
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def _ref(obj: object) -> str | None:
    value = obj.get("value") if isinstance(obj, dict) else None
    return str(value) if value is not None else None


# ---------- the Source ----------


class QuickBooksSource:
    """receipts.source.Source over QuickBooks Online. Read-only: it only sends GET requests."""

    def __init__(self, client: Client) -> None:
        self.client = client
        self._bills: dict[str, dict | None] = {}

    @classmethod
    def from_config(cls, settings: dict) -> QuickBooksSource:
        realm_id = str(settings.get("realm_id", ""))
        client = Client(
            realm_id,
            str(settings.get("client_id", "")),
            TokenStore(realm_id),
            str(settings.get("environment", "production")),
        )
        return cls(client)

    def set_deadline(self, deadline: float) -> None:
        """Every request from now on must finish by `deadline` (time.monotonic()). The guard
        sets this per payment decision; the verifier, which reads many bills, doesn't."""
        self.client.deadline = deadline

    def _raw_bill(self, bill_id: str) -> dict | None:
        if bill_id in self._bills:
            return self._bills[bill_id]
        found = None
        if SAFE_ID.fullmatch(bill_id):
            found = self.client.read("Bill", bill_id) if bill_id.isdigit() else None
            if found is None:
                matches = self.client.query("Bill", f"DocNumber = {_quote(bill_id)}")
                if len(matches) > 1:
                    raise QuickBooksError(f"more than one bill is numbered {bill_id}")
                found = matches[0] if matches else None
        self._bills[bill_id] = found
        return found

    def bill(self, bill_id: str) -> dict | None:
        raw = self._raw_bill(str(bill_id))
        if raw is None:
            return None
        links = list(raw.get("LinkedTxn") or [])
        for line in raw.get("Line") or []:
            if isinstance(line, dict):
                links += line.get("LinkedTxn") or []
        order_id = next(
            (
                str(t.get("TxnId"))
                for t in links
                if isinstance(t, dict) and t.get("TxnType") == "PurchaseOrder"
            ),
            None,
        )
        balance = cents(raw.get("Balance", 0))
        return {
            "id": str(bill_id),
            "qbo_id": str(raw.get("Id")),
            "vendor_id": _ref(raw.get("VendorRef")),
            "order_id": order_id,
            "amount_cents": cents(raw.get("TotalAmt", 0)),
            "balance_cents": balance,
            "due_date": raw.get("DueDate"),
            "currency": _ref(raw.get("CurrencyRef")),
            "status": "paid" if balance == 0 else "open",
        }

    def vendor(self, vendor_id: str) -> dict | None:
        raw = self.client.read("Vendor", str(vendor_id))
        if raw is None:
            return None
        email = raw.get("PrimaryEmailAddr")
        return {
            "id": str(raw.get("Id")),
            "name": raw.get("DisplayName"),
            "email": email.get("Address") if isinstance(email, dict) else None,
            "bank_account": None,
            "active": raw.get("Active", True),
        }

    def order(self, order_id: str) -> dict | None:
        raw = self.client.read("PurchaseOrder", str(order_id))
        if raw is None:
            return None
        if raw.get("ManuallyClosed"):
            status = "closed"
        else:
            status = {"Open": "placed", "Closed": "received"}.get(raw.get("POStatus"), "unknown")
        return {
            "id": str(raw.get("Id")),
            "vendor_id": _ref(raw.get("VendorRef")),
            "order_date": raw.get("TxnDate"),
            "total_cents": cents(raw.get("TotalAmt", 0)),
            "status": status,
            "_lines": raw.get("Line") or [],
        }

    def order_items(self, order_id: str) -> list[dict]:
        raw = self.order(order_id)
        items = []
        for line in (raw or {}).get("_lines", []):
            detail = line.get("ItemBasedExpenseLineDetail") if isinstance(line, dict) else None
            if isinstance(detail, dict):
                items.append(
                    {
                        "order_id": str(order_id),
                        "name": line.get("Description")
                        or (detail.get("ItemRef") or {}).get("name"),
                        "quantity": detail.get("Qty"),
                        "unit_price_cents": cents(detail["UnitPrice"])
                        if "UnitPrice" in detail
                        else None,
                    }
                )
        return items

    def payments_for_bill(self, bill_id: str) -> list[dict]:
        raw = self._raw_bill(str(bill_id))
        if raw is None:
            return []
        qbo_id, vendor = str(raw.get("Id")), _ref(raw.get("VendorRef"))
        if not vendor or not SAFE_ID.fullmatch(vendor):
            return []
        found = []
        for pay in self.client.query("BillPayment", f"VendorRef = {_quote(vendor)}"):
            for line in pay.get("Line") or []:
                linked = line.get("LinkedTxn") if isinstance(line, dict) else None
                if any(
                    isinstance(t, dict)
                    and t.get("TxnType") == "Bill"
                    and str(t.get("TxnId")) == qbo_id
                    for t in linked or []
                ):
                    found.append(
                        {
                            "id": f"qbo-billpayment-{pay.get('Id')}",
                            "bill_id": str(bill_id),
                            "amount_cents": cents(line.get("Amount", 0)),
                            "to_account": None,
                            "status": "sent",
                            "created_at": pay.get("TxnDate"),
                        }
                    )
        return found

    def close(self) -> None:
        self._bills.clear()
