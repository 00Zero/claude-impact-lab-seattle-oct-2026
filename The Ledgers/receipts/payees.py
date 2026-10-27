"""The owner's payee list, kept in Receipts' secrets folder outside the project
(receipts.paths.payees_file), one per project.

The source of truth for where money may go. Accounting systems often don't expose suppliers'
bank details, and a bill (or an email) asking to pay a new account is the classic fraud, so
check C4 compares every account to pay with this list, which only the owner edits.

    {
      "salt": "<random hex>",
      "payees": [
        {
          "vendor_id": "58",
          "name": "Flour Co",
          "email_domains": ["flourco.example"],
          "accounts": [{"sha256": "<hex>", "last4": "4471"}]
        }
      ]
    }

Account numbers are stored only as salted SHA-256 hashes plus their last 4 digits, so the file
never holds a full number. That keeps numbers out of backups, screenshots and Claude's context;
it isn't strong secrecy (bank account numbers are short enough to brute-force from the hash),
which is why the file lives outside the project, where searching the project can't reach it,
and the guard refuses Claude's attempts to read or edit it.

The owner adds payees in their own terminal (python3 -m receipts payee add), typing the account
number at a hidden prompt, so it never lands in shell history or in a Claude session.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
from dataclasses import dataclass
from pathlib import Path


class PayeesError(Exception):
    """The payee list exists but can't be used; the message says why."""


def digits(account: object) -> str | None:
    """The account's digits, or None if it isn't a plain account number. ASCII spaces and
    dashes are formatting; anything else (a letter, a Unicode digit) makes it not an account."""
    if not isinstance(account, str):
        return None
    plain = account.replace(" ", "").replace("-", "")
    return plain if re.fullmatch(r"[0-9]{4,34}", plain) else None


def account_hash(salt: str, account_digits: str) -> str:
    return hashlib.sha256(f"{salt}:{account_digits}".encode()).hexdigest()


@dataclass
class Payee:
    vendor_id: str
    name: str
    email_domains: list[str]
    accounts: list[dict]  # {"sha256", "last4"}


@dataclass
class Payees:
    path: Path
    salt: str
    payees: list[Payee]

    def for_vendor(self, vendor_id: object) -> Payee | None:
        return next((p for p in self.payees if p.vendor_id == str(vendor_id)), None)

    def owns(self, payee: Payee, account: object) -> bool:
        """Whether `account` is one of the payee's accounts on the list."""
        plain = digits(account)
        if plain is None:
            return False
        wanted = account_hash(self.salt, plain)
        return any(secrets.compare_digest(a["sha256"], wanted) for a in payee.accounts)

    def save(self) -> None:
        data = {
            "salt": self.salt,
            "payees": [
                {
                    "vendor_id": p.vendor_id,
                    "name": p.name,
                    "email_domains": p.email_domains,
                    "accounts": p.accounts,
                }
                for p in self.payees
            ],
        }
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        tmp = self.path.with_suffix(f".tmp{os.getpid()}")
        tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        os.chmod(tmp, 0o600)
        os.replace(tmp, self.path)

    def add(self, vendor_id: str, name: str, account: str, domains: list[str]) -> Payee:
        """Add an account (and email domains) to a payee, creating the payee if needed."""
        plain = digits(account)
        if plain is None:
            raise PayeesError("that isn't a plain account number (digits, spaces or dashes)")
        payee = self.for_vendor(vendor_id)
        if payee is None:
            payee = Payee(str(vendor_id), name, [], [])
            self.payees.append(payee)
        entry = {"sha256": account_hash(self.salt, plain), "last4": plain[-4:]}
        if entry not in payee.accounts:
            payee.accounts.append(entry)
        for d in domains:
            d = d.strip().lower().rstrip(".")
            if d and d not in payee.email_domains:
                payee.email_domains.append(d)
        return payee


def _payee(raw: object) -> Payee:
    if not isinstance(raw, dict):
        raise PayeesError("each payee must be an object")
    accounts = raw.get("accounts", [])
    domains = raw.get("email_domains", [])
    ok = (
        isinstance(raw.get("vendor_id"), str)
        and isinstance(raw.get("name"), str)
        and isinstance(domains, list)
        and all(isinstance(d, str) for d in domains)
        and isinstance(accounts, list)
        and all(
            isinstance(a, dict)
            and isinstance(a.get("sha256"), str)
            and isinstance(a.get("last4"), str)
            for a in accounts
        )
    )
    if not ok:
        raise PayeesError("a payee needs vendor_id, name, email_domains and accounts")
    return Payee(raw["vendor_id"], raw["name"], domains, accounts)


def load(path: Path) -> Payees | None:
    """The payee list, or None when there's no file. Raises PayeesError when it's malformed."""
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, RecursionError) as exc:
        raise PayeesError(f"the payee list can't be read ({type(exc).__name__})") from None
    if not isinstance(raw, dict) or not isinstance(raw.get("salt"), str) or not raw["salt"]:
        raise PayeesError("the payee list must hold a salt and a payees list")
    if not isinstance(raw.get("payees"), list):
        raise PayeesError("the payee list must hold a payees list")
    return Payees(path, raw["salt"], [_payee(p) for p in raw["payees"]])


def load_or_new(path: Path) -> Payees:
    return load(path) or Payees(path, secrets.token_hex(16), [])
