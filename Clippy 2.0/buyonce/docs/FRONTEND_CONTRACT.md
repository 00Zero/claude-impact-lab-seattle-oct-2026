# Front-end contract

What a website or app needs from BuyOnce. Everything is a command that prints JSON with `--json`, or a file to read. No server needed yet.

## Commands (all in `tools/buyonce.py`)

| Action | Command | Exit code |
|---|---|---|
| First-run questions | `buyonce.py setup --name N --cap 2000 --block "A,B" --auto-under 0` | 0 |
| Start a purchase | `buyonce.py buy "ITEM" --qty 10 --by 2026-10-30 --skill S --quotes Q --product-url U --address A` | 10 = waiting for owner, 20 = stopped |
| Owner taps **Approve** | `buyonce.py approve "approve" --product-url U --address A` | 0 done, 20 stopped |
| Owner taps **Cancel** | `buyonce.py decline "no"` | 20 |
| Poll state | `buyonce.py status --json` | 0 |

Only `approve` places an order, and only if the owner's words read as a yes. Anything unclear counts as "no". The front end should call `approve` only from an owner tap, never from an agent.

## Files to read (rewritten after every command)

- `data/status.json`: facts for one run. Fields: `state`, `stopped`, `halt`, `item`, `qty`, `vendor`, `approved_total`, `card_limit`, `order_id`, `approval`, `vendor_order {order_id, merchant_order_id, status, total}`, `stages[] {key, label, reached, current}`, `events[] {ts, event, note}`, `why` (the approval card text).
- `data/status.html`: the same facts as a finished page (auto-refreshes while a run is live). Embed it in an iframe or restyle from the JSON.
- `data/audit.jsonl`: one JSON line per event, append-only.

## States a UI should show

`quote` / `needs_quotes` (getting prices) -> `awaiting_approval` (show `why`, offer Approve / Cancel) -> `executing` -> `done`, or `halted` (show `halt`, plain words) / `declined`.

## Not built yet (waiting on the front end)
- Quotes still come from a file (`--quotes`). Live Zinc search is next.
- Approval-by-phone: the tap must be the only thing that can call `approve`.
- Voice, PDF and photo intake feed `buy` as ITEM and `--qty`.
