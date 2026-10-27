#!/usr/bin/env python3
"""Zinc API actuator: place an approved order through an API instead of clicking a website.

Zinc (https://www.zinc.com/docs) sells one order API over Amazon, Walmart, Target and others.
Test keys (prefix zn_test_) go to a sandbox: no money moves. Documented endpoints used here:
  POST /sandbox/keys   mint a test key, no auth       POST /orders       place an order
  GET  /orders/{id}    read an order                  max_price (cents, includes tax+shipping) is required

Safety:
  * The key is read from the ZINC_API_KEY env var or data/zinc.key (gitignored, chmod 600). Never printed.
  * A live key (anything that is not zn_test_) is refused unless the policy sets [api] allow_live = true.
  * max_price is the run's card limit, so the vendor can never charge more than the owner approved.
  * The idempotency key is the BuyOnce order id, so running twice cannot buy twice.
Stdlib only. The transport is injectable so tests never touch the network.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://api.zinc.com"
TEST_PREFIX = "zn_test_"


class ZincError(Exception):
    pass


def _http(method, url, headers, body):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode() or "{}")
        except ValueError:
            payload = {}
        return e.code, payload


def load_key(root: Path) -> str:
    key = os.environ.get("ZINC_API_KEY", "").strip()
    if not key:
        f = Path(root) / "data" / "zinc.key"
        key = f.read_text().strip() if f.exists() else ""
    if not key:
        raise ZincError("no Zinc key: run `python3 tools/api_order.py mint` or set ZINC_API_KEY")
    return key


class Zinc:
    def __init__(self, key: str, allow_live: bool = False, transport=_http, base: str = BASE):
        if not key.startswith(TEST_PREFIX) and not allow_live:
            raise ZincError("this is not a Zinc test key; live keys are refused unless the policy sets "
                            "[api] allow_live = true")
        self.key, self.transport, self.base = key, transport, base
        self.live = not key.startswith(TEST_PREFIX)

    def _call(self, method, path, body=None):
        headers = {"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}
        status, payload = self.transport(method, self.base + path, headers, body)
        if status >= 400:
            raise ZincError(f"Zinc {method} {path} -> {status}: {payload.get('message') or payload}")
        return payload

    def create_order(self, product_url, quantity, address, max_price_cents, idempotency_key):
        if int(max_price_cents) <= 0:
            raise ZincError("max_price must be positive")
        return self._call("POST", "/orders", {
            "products": [{"url": product_url, "quantity": int(quantity)}],
            "shipping_address": address,
            "max_price": int(max_price_cents),
            "idempotency_key": idempotency_key,
        })

    def get_order(self, order_id):
        return self._call("GET", f"/orders/{order_id}")


def mint_key(name="buyonce sandbox", email=None, transport=_http, base: str = BASE):
    """No auth needed. Returns the response; the caller must store the key and claim_url."""
    body = {"name": name, **({"email": email} if email else {})}
    status, payload = transport("POST", base + "/sandbox/keys", {"Content-Type": "application/json"}, body)
    if status >= 400:
        raise ZincError(f"mint failed ({status}): {payload}")
    return payload


def save_key(root: Path, key: str) -> Path:
    f = Path(root) / "data" / "zinc.key"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(key)
    f.chmod(0o600)
    return f
