"""Command line for the owner: run it in a Receipts project folder (one with a receipts.json).

  python3 -m receipts verify
      Check the log against the records, write logs/receipts/receipt_<bill>.json and print
      one line per bill. Exit 0 when the log is intact, 1 when it was changed.

  python3 -m receipts check BILL_ID AMOUNT_CENTS TO_ACCOUNT
      Run the payment checks for one payment without paying. Exit 0 if allowed, 1 if a check
      blocks it.

  python3 -m receipts payee add VENDOR_ID NAME [--domain DOMAIN ...]
      Add a supplier's bank account to the payee list. The account number is asked for at a
      hidden prompt, twice, so it never lands in shell history.

  python3 -m receipts payee list
      Show the payee list (names, email domains, last 4 digits of each account).

  python3 -m receipts quickbooks login
      Store the Intuit app's client secret and a QuickBooks refresh token (hidden prompts) in
      the Keychain, or a private file outside the project.

  python3 -m receipts quickbooks test
      Sign in and read one bill, to check the connection.

Set RECEIPTS_CONFIG to use a receipts.json elsewhere.
"""

from __future__ import annotations

import argparse
import getpass
import sys

from receipts import config, payees, verify
from receipts.guard import run_checks


def _verify(cfg: config.Config) -> int:
    result = verify.build(cfg)
    verify.write(cfg.receipts_dir, result)
    print("\n".join(verify.summary(result)))
    print(f"Receipts: {cfg.receipts_dir}")
    return 0 if result.chain.ok else 1


def _check(cfg: config.Config, bill_id: str, amount: int, account: str) -> int:
    args = {"bill_id": bill_id, "amount_cents": amount, "to_account": account}
    if cfg.demo_source:
        print(f"Note: {config.DEMO_NOTE}.")
    results = run_checks(cfg, args, cfg.load_payees())
    for r in results:
        print(f"{r.status.upper():7} {r.id:3} {r.title}")
    return 1 if any(r.status == "block" for r in results) else 0


def _payee_add(cfg: config.Config, vendor_id: str, name: str, domains: list[str]) -> int:
    account = getpass.getpass(f"Bank account number for {name} (hidden): ")
    if getpass.getpass("Type it again: ") != account:
        print("The two entries don't match; nothing was saved.", file=sys.stderr)
        return 1
    found = payees.load_or_new(cfg.payees_path)
    payee = found.add(vendor_id, name, account, domains)
    found.save()
    last4 = payee.accounts[-1]["last4"]
    print(f"Saved: {payee.name} ({payee.vendor_id}), account ending {last4}.")
    return 0


def _payee_list(cfg: config.Config) -> int:
    found = cfg.load_payees()
    if not found or not found.payees:
        print("No payees yet. Add one with: python3 -m receipts payee add VENDOR_ID NAME")
        return 0
    for p in found.payees:
        accounts = ", ".join(f"••{a['last4']}" for a in p.accounts) or "no accounts"
        domains = ", ".join(p.email_domains) or "no email domains"
        print(f"{p.vendor_id}  {p.name}: {accounts}; {domains}")
    return 0


def _quickbooks(cfg: config.Config, command: str) -> int:
    from receipts import quickbooks

    if cfg.source.get("type") != "quickbooks":
        print("receipts.json's source isn't \"quickbooks\".", file=sys.stderr)
        return 1
    store = quickbooks.TokenStore(str(cfg.source.get("realm_id", "")))
    if command == "login":
        secret = getpass.getpass("Intuit app client secret (hidden): ")
        token = getpass.getpass("QuickBooks refresh token (hidden): ")
        if not secret or not token:
            print("Both are needed; nothing was saved.", file=sys.stderr)
            return 1
        store.save({"client_secret": secret, "refresh_token": token})
        print("Saved. Run `python3 -m receipts quickbooks test` to check the connection.")
        return 0
    source = quickbooks.QuickBooksSource.from_config(cfg.source)
    bills = source.client.query("Bill", "Balance > '0'", limit=1)
    print(f"Connected to QuickBooks company {cfg.source.get('realm_id')}.")
    print("Found an open bill." if bills else "No open bills found.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="python3 -m receipts")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("verify", help="check the log against the records and write receipts")
    check = sub.add_parser("check", help="run the payment checks for one payment")
    check.add_argument("bill_id")
    check.add_argument("amount_cents", type=int)
    check.add_argument("to_account")
    payee = sub.add_parser("payee", help="manage the payee list")
    payee_sub = payee.add_subparsers(dest="payee_command", required=True)
    add = payee_sub.add_parser("add", help="add a supplier's bank account")
    add.add_argument("vendor_id", help="the supplier's id in your records")
    add.add_argument("name")
    add.add_argument("--domain", action="append", default=[], help="an email domain they bill from")
    payee_sub.add_parser("list", help="show the payee list")
    qbo = sub.add_parser("quickbooks", help="connect to QuickBooks Online")
    qbo_sub = qbo.add_subparsers(dest="qbo_command", required=True)
    qbo_sub.add_parser("login", help="store the client secret and refresh token")
    qbo_sub.add_parser("test", help="check the connection")
    opts = parser.parse_args()
    try:
        cfg = config.load()
        if cfg is None:
            sys.exit(
                f"Receipts: no {config.FILE_NAME} here. Run this in a Receipts project folder."
            )
        if opts.command == "verify":
            sys.exit(_verify(cfg))
        if opts.command == "check":
            sys.exit(_check(cfg, opts.bill_id, opts.amount_cents, opts.to_account))
        if opts.command == "quickbooks":
            sys.exit(_quickbooks(cfg, opts.qbo_command))
        if opts.payee_command == "add":
            sys.exit(_payee_add(cfg, opts.vendor_id, opts.name, opts.domain))
        sys.exit(_payee_list(cfg))
    except Exception as exc:
        known = (config.ConfigError, payees.PayeesError)
        if not isinstance(exc, known) and type(exc).__name__ != "QuickBooksError":
            raise
        sys.exit(f"Receipts: {exc}")


if __name__ == "__main__":
    main()
