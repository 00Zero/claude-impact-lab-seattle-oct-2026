"""The payment rules C4-C8: plain code that decides whether a payment may go ahead.

The guard (receipts.guard) calls evaluate() before a payment tool runs. Each rule looks at the
payment request and at facts read once from the business's records (through a read-only
Source) and the owner's payee list. The request is never trusted over the records.

Every rule answers with a CheckResult whose status is:
  pass     the rule is satisfied
  block    the payment must not go ahead
  unknown  the records can't answer this rule (for example, they don't say who sent the bill)

Only "block" stops a payment (allowed()). Anything unexpected blocks: a rule that raises, records
that can't be read, a request missing a field (fail closed).
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field

from receipts.payees import Payee, Payees, digits
from receipts.source import Source, SourceError

REQUIRED = ("bill_id", "amount_cents", "to_account")
OPEN_ORDER = ("placed", "received")


@dataclass
class CheckResult:
    id: str
    status: str  # pass | block | unknown
    title: str
    evidence: list[str] = field(default_factory=list)  # record references, e.g. "bills:BILL-07"
    inputs: dict = field(default_factory=dict)  # what was compared, account numbers masked


def allowed(results: list[CheckResult]) -> bool:
    """A payment may go ahead unless some rule blocks it."""
    return all(r.status != "block" for r in results)


# ---------- small helpers ----------


def _shown(account: object) -> str:
    """An account as people may see it: its last 4 digits only."""
    plain = digits(account)
    if plain:
        return "••" + plain[-4:]
    return "none" if account in (None, "") else "an unreadable account"


def _dollars(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def _email_domain(address: object) -> str | None:
    """The domain of a plain email address, lower-cased; None for anything else."""
    if not isinstance(address, str):
        return None
    match = re.fullmatch(r"[^@\s<>,;\"]+@([^@\s<>,;\"]+)", address.strip())
    return match.group(1).lower().rstrip(".") if match else None


# ---------- the facts every rule reads ----------


@dataclass
class Facts:
    """One payment request and what the records and the payee list say about it."""

    request: dict
    bill: dict
    vendor: dict
    order: dict | None
    payments: list[dict]
    payees: Payees | None
    require_order: bool
    in_flight: bool

    @property
    def supplier(self) -> str:
        return self.vendor.get("name") or f"supplier {self.bill.get('vendor_id')}"

    @property
    def listed(self) -> Payee | None:
        return self.payees.for_vendor(self.bill.get("vendor_id")) if self.payees else None

    @property
    def owed(self) -> int:
        """What's still owed on the bill."""
        return self.bill.get("balance_cents", self.bill.get("amount_cents"))

    @property
    def paid_in_full(self) -> bool:
        return self.bill.get("status") == "paid" or self.bill.get("balance_cents") == 0

    def ref(self, kind: str, record: dict | None) -> list[str]:
        return [f"{kind}:{record['id']}"] if record and "id" in record else []


# ---------- the rules ----------


def rule_c4_account(f: Facts) -> CheckResult:
    """Money may only go to an account the business already trusts for this supplier: the
    owner's payee list when there is one, else the account in the records. A bill that asks
    for a different account is refused too, even if the agent didn't follow it."""
    to, asks = f.request["to_account"], f.bill.get("pay_to_account")
    evidence = f.ref("bills", f.bill)
    if f.payees is not None:
        payee = f.listed
        evidence.append(f"payees:{f.bill.get('vendor_id')}")
        inputs = {
            "to_account": _shown(to),
            "listed": [a["last4"] for a in payee.accounts] if payee else [],
        }
        if payee is None:
            return CheckResult(
                "C4", "block", f"{f.supplier} isn't on your payee list", evidence, inputs
            )
        if digits(to) is None:
            return CheckResult(
                "C4", "block", f"{_shown(to)} isn't a plain account number", evidence, inputs
            )
        if not f.payees.owns(payee, to):
            title = f"Account {_shown(to)} isn't one of {payee.name}'s accounts on your payee list"
            return CheckResult("C4", "block", title, evidence, inputs)
        if asks and not f.payees.owns(payee, asks):
            title = f"The bill asks to pay {_shown(asks)}, which isn't on your payee list"
            return CheckResult(
                "C4", "block", title, evidence, {**inputs, "bill_asks": _shown(asks)}
            )
        return CheckResult(
            "C4", "pass", f"Pays {payee.name}'s account on your payee list", evidence, inputs
        )

    trusted = digits(f.vendor.get("bank_account"))
    evidence += f.ref("vendors", f.vendor)
    inputs = {"to_account": _shown(to), "on_file": _shown(trusted), "bill_asks": _shown(asks)}
    if trusted is None:
        title = f"{f.supplier} has no bank account on file; add them to your payee list"
        return CheckResult("C4", "block", title, evidence, inputs)
    if digits(to) is None:
        return CheckResult(
            "C4", "block", f"{_shown(to)} isn't a plain account number", evidence, inputs
        )
    if digits(to) != trusted:
        same_ending = digits(to)[-4:] == trusted[-4:]
        title = (
            f"Account {_shown(to)} isn't {f.supplier}'s account on file; only the last 4 digits match"
            if same_ending
            else f"Account {_shown(to)} differs from {f.supplier}'s on file {_shown(trusted)}"
        )
        return CheckResult("C4", "block", title, evidence, inputs)
    if asks is not None and digits(asks) != trusted:
        title = f"The bill asks to pay {_shown(asks)}, not {f.supplier}'s on file {_shown(trusted)}"
        return CheckResult("C4", "block", title, evidence, inputs)
    return CheckResult("C4", "pass", f"Pays {f.supplier}'s account on file", evidence, inputs)


def rule_c5_amount(f: Facts) -> CheckResult:
    """The amount must be exactly what's owed on the bill, and a bill raised against a purchase
    order must match the order's total."""
    amount = f.request["amount_cents"]
    order_total = f.order.get("total_cents") if f.order else None
    inputs = {"amount_cents": amount, "owed_cents": f.owed, "order_cents": order_total}
    evidence = f.ref("bills", f.bill) + f.ref("orders", f.order)
    if type(amount) is not int:  # not bool, not "800", not 800.0
        return CheckResult("C5", "block", "The amount must be whole cents", evidence, inputs)
    if f.paid_in_full:
        # Nothing is owed. Rule C7 says so; comparing with $0.00 would only add noise.
        return CheckResult("C5", "unknown", "The bill is already paid in full", evidence, inputs)
    if amount != f.owed:
        title = f"Paying {_dollars(amount)} but {_dollars(f.owed)} is owed on the bill"
        return CheckResult("C5", "block", title, evidence, inputs)
    if order_total is None:
        return CheckResult("C5", "unknown", "No purchase order to compare with", evidence, inputs)
    if f.bill.get("amount_cents") != order_total:
        title = (
            f"The bill totals {_dollars(f.bill.get('amount_cents', 0))} but order "
            f"{f.order['id']} totals {_dollars(order_total)}"
        )
        return CheckResult("C5", "block", title, evidence, inputs)
    return CheckResult("C5", "pass", f"Pays exactly the {_dollars(amount)} owed", evidence, inputs)


def rule_c6_order(f: Facts) -> CheckResult:
    """A bill should be for an open order placed with the same supplier. Bills without an order
    are refused only when the owner requires purchase orders."""
    inputs = {"order_id": f.bill.get("order_id"), "require_order": f.require_order}
    evidence = f.ref("bills", f.bill) + f.ref("orders", f.order)
    if f.order is None:
        status = "block" if f.require_order else "unknown"
        return CheckResult(
            "C6", status, f"Bill {f.bill['id']} isn't linked to a known order", evidence, inputs
        )
    inputs["order_status"] = f.order.get("status")
    if f.order.get("vendor_id") != f.bill.get("vendor_id"):
        title = f"Order {f.order['id']} is with a different supplier than bill {f.bill['id']}"
        return CheckResult("C6", "block", title, evidence, inputs)
    if f.order.get("status") not in OPEN_ORDER:
        title = f"Order {f.order['id']} is {f.order.get('status')}, so its bill can't be paid"
        return CheckResult("C6", "block", title, evidence, inputs)
    return CheckResult(
        "C6", "pass", f"Bill {f.bill['id']} is for open order {f.order['id']}", evidence, inputs
    )


def rule_c7_once(f: Facts) -> CheckResult:
    """A bill is paid once: not while a payment for it is under way, and not after it's paid."""
    sent = [p for p in f.payments if p.get("status") != "failed"]
    inputs = {"bill_status": f.bill.get("status"), "payments": [p.get("id") for p in sent]}
    evidence = f.ref("bills", f.bill) + [f"payments:{p.get('id')}" for p in sent]
    if f.in_flight:
        title = (
            f"A payment for bill {f.bill['id']} was approved in the last 2 minutes and hasn't "
            "finished; wait for it, or try again in 2 minutes"
        )
        return CheckResult("C7", "block", title, evidence, inputs)
    if sent or f.paid_in_full:
        return CheckResult("C7", "block", f"Bill {f.bill['id']} is already paid", evidence, inputs)
    return CheckResult("C7", "pass", f"Bill {f.bill['id']} hasn't been paid yet", evidence, inputs)


def rule_c8_sender(f: Facts) -> CheckResult:
    """The bill must have come from the supplier's own email domain (the payee list's domains, or
    the supplier's email in the records). Look-alike domains are the classic invoice fraud."""
    payee = f.listed
    trusted = (
        [d.lower() for d in payee.email_domains]
        if payee is not None
        else [d for d in [_email_domain(f.vendor.get("email"))] if d]
    )
    evidence = f.ref("bills", f.bill)
    sender = f.bill.get("from_addr")
    if not sender:
        inputs = {"from_domain": None, "trusted": trusted}
        return CheckResult(
            "C8",
            "unknown",
            "The records don't say which address the bill came from",
            evidence,
            inputs,
        )
    domain = _email_domain(sender)
    inputs = {"from_domain": domain, "trusted": trusted}
    if domain is None or domain not in trusted:
        expected = " or ".join(trusted) or "no domain on file"
        title = f"Bill came from {domain or 'an unreadable address'}, not {f.supplier}'s {expected}"
        return CheckResult("C8", "block", title, evidence, inputs)
    return CheckResult(
        "C8", "pass", f"Bill came from {f.supplier}'s domain {domain}", evidence, inputs
    )


RULES: dict[str, Callable[[Facts], CheckResult]] = {
    "C4": rule_c4_account,
    "C5": rule_c5_amount,
    "C6": rule_c6_order,
    "C7": rule_c7_once,
    "C8": rule_c8_sender,
}


# ---------- running them ----------


def _payment_checks(
    request: dict, source: Source, payees: Payees | None, require_order: bool, in_flight: bool
) -> list[CheckResult]:
    missing = [name for name in REQUIRED if name not in request]
    if missing:
        return [CheckResult("C0", "block", f"The payment is missing {', '.join(missing)}")]
    bill = source.bill(request["bill_id"])
    if bill is None:
        none = "No bill to check against"
        results = [CheckResult(rule_id, "unknown", none) for rule_id in RULES]
        results[2] = CheckResult("C6", "block", f"No bill {request['bill_id']} on file")
        return results
    facts = Facts(
        request=request,
        bill=bill,
        vendor=source.vendor(bill.get("vendor_id")) or {},
        order=source.order(bill["order_id"]) if bill.get("order_id") else None,
        payments=source.payments_for_bill(bill["id"]),
        payees=payees,
        require_order=require_order,
        in_flight=in_flight,
    )
    results = []
    for rule_id, rule in RULES.items():
        try:
            results.append(rule(facts))
        except Exception as exc:  # noqa: BLE001 - a rule that breaks must block, never pass
            results.append(CheckResult(rule_id, "block", f"Check crashed: {type(exc).__name__}"))
    return results


def evaluate(
    action: str,
    request: dict,
    source: Source,
    payees: Payees | None = None,
    require_order: bool = True,
    in_flight: bool = False,
) -> list[CheckResult]:
    """Run the rules for one payment ("pay_bill" is the only action). payees is the owner's
    payee list (None: trust the account in the records); in_flight says a payment for this bill
    was approved and hasn't finished."""
    if action != "pay_bill":
        return [CheckResult("C0", "block", f"No checks are defined for {action}")]
    try:
        return _payment_checks(request, source, payees, require_order, in_flight)
    except SourceError as exc:  # a connector's message is written to be shown
        return [CheckResult("C0", "block", f"Records couldn't be read: {exc}")]
    except Exception as exc:  # noqa: BLE001 - records that can't be read block
        # The type only: a message could echo part of the request, such as an account.
        return [CheckResult("C0", "block", f"Checks couldn't run: {type(exc).__name__}")]
