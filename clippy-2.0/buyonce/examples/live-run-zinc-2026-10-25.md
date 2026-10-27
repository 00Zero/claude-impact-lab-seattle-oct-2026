# Live run: Zinc API sandbox, 2026-10-25

First BuyOnce order placed through a real vendor API (Zinc sandbox, test key, no money moves). Skill: `skills/zinc-buy`. Status page: `examples/status-sample.html`.

The cloud build environment cannot reach api.zinc.com, so the HTTP call was sent from the owner's Chrome (a relay) while the controller did everything else: `api_order.py plan` produced the exact request, the relay sent it, `api_order.py record` checked it matched the approved order and logged the result. On a laptop, `api_order.py place` does all of it in one command.

| Step | Result |
|---|---|
| Mint sandbox key (`POST /sandbox/keys`) | 201, key prefix `zn_test_`, no account |
| Quote, compare, approval card | Total $15.00, price ceiling $15.75, asked (new vendor, policy asks every time) |
| Approval | Recorded as pre-authorized in chat for this sandbox order (the owner's words are in the audit log; it was not a typed "approve") |
| `POST /orders` | 201, `max_price` 1575 cents, idempotency key = BuyOnce order id |
| Order status | `pending` after 6.5 s, `order_placed` by about 20 s (Zinc docs say about 1 s) |
| Zinc's real price | $14.75 (items $8.06, shipping $5.99, tax $0.70) vs our $15.00 estimate; under the ceiling |
| Controller | state `done`, vendor order W72110681 |

Audit trail (UTC): run_started 21:13:47, quotes_submitted, approved 21:14:04, api_order_requested 21:16:51, completed 21:16:51.

## What this shows
Approval gate, vendor-side price ceiling, idempotency, and a real API order working together, with a one-page status view.

## What it does not show
- Live (real-money) keys: refused by default.
- Zinc search and offers endpoints: the quote here was written by hand.
- The relay is a workaround; the direct path (`place`) is unit-tested but was not run against the network.
- Sandbox status moved slower than documented; poll up to about 30 s.
