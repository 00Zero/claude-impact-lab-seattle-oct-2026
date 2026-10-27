"""Shared helpers for BuyOnce tools.

Standard library only (Python 3.11+, because policies are TOML). No installs needed.
Money is handled with Decimal so totals never drift by a cent.
"""
from __future__ import annotations

import json
import math
import tomllib
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

CENT = Decimal("0.01")

DEFAULT_POLICY: dict = {
    "business": {"name": "My Business", "currency": "USD"},
    "spending": {
        # Safe default: always ask the owner. Flip to true to let small orders through.
        "allow_auto_approve": False,
        "auto_approve_under": 100.00,
        "hard_cap": 2000.00,
        "card_buffer_pct": 5.0,
    },
    "vendors": {"approved": [], "blocked": [], "prefer_past_vendors": True},
    "quality": {"min_rating": 4.0},
    "delivery": {"max_days": 7},
    "scoring": {"price": 0.55, "speed": 0.20, "reliability": 0.25},
    # Practice sites that take no real payment. Only on these may the agent do the final step.
    "sandbox": {"hosts": []},
}


def money(value) -> Decimal:
    """Round any number-ish value to cents."""
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def fmt(value) -> str:
    return f"${money(value):,.2f}"


def load_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def _merge(base: dict, override: dict) -> dict:
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in base.items()}
    for key, val in override.items():
        if isinstance(val, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], val)
        else:
            out[key] = val
    return out


def with_defaults(policy: dict | None) -> dict:
    return _merge(DEFAULT_POLICY, policy or {})


def load_policy(path) -> dict:
    with open(path, "rb") as handle:
        return with_defaults(tomllib.load(handle))


def unit_price_for(quote: dict) -> Decimal:
    """Best unit price after applying any quantity price breaks."""
    qty = int(quote["qty"])
    best = Decimal(str(quote["unit_price"]))
    for brk in quote.get("price_breaks", []):
        if qty >= int(brk["min_qty"]):
            best = min(best, Decimal(str(brk["unit_price"])))
    return best


def landed_cost(quote: dict) -> dict:
    """What it really costs: items + shipping + tax."""
    qty = int(quote["qty"])
    unit = unit_price_for(quote)
    subtotal = money(unit * qty)
    shipping = money(quote.get("shipping", 0))
    tax = money(subtotal * Decimal(str(quote.get("tax_rate", 0))))
    return {
        "unit_price": unit,
        "subtotal": subtotal,
        "shipping": shipping,
        "tax": tax,
        "total": money(subtotal + shipping + tax),
    }


def card_limit(total, buffer_pct) -> Decimal:
    """Single-use card cap: the approved total plus a small buffer (rounded up to a cent)."""
    cents = math.ceil(Decimal(str(total)) * (1 + Decimal(str(buffer_pct)) / 100) * 100)
    return (Decimal(cents) / 100).quantize(CENT)


def parse_date(value) -> date:
    return value if isinstance(value, date) else date.fromisoformat(value)


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent
