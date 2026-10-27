# API execution (no browser)

Capture stays screen-based (a recorded skill says *what* the owner buys and from whom). Execution can skip the clicking: once the owner approves, the run controller places the order through a vendor API. Same gate, same spend cap, same audit log.

```
skill + request -> quotes -> compare -> approval card -> "approve" -> execute_via_api -> done
                                                            (max_price = card limit, idempotency key = order id)
```

## What exists for real purchasing (researched 2026-10-25)

| Route | Can it place a real order? | Notes |
|---|---|---|
| **Zinc** (api.zinc.com, MCP at mcp.zinc.com) | Yes: Amazon, Walmart, Target and others via one API | Free keyless **sandbox** (`POST /sandbox/keys`), `max_price` ceiling per order, idempotency key. Live needs a human to claim the account. **Built here: `tools/zinc.py`** |
| **Shopify** Catalog + Checkout MCP (UCP) | Yes, on Shopify merchants | Global Catalog searches all merchants with no key. Checkout: general access hands the buyer a `continue_url` to pay; direct `complete_checkout` needs a higher access tier. Good next adapter for the quote phase |
| **Stripe** MCP / Issuing | Pays, does not shop | Single-use capped card: `tools/issue_card.py` |
| **Amazon Business** | Ordering API exists, but its MCP server is a **docs-search tool only** (no ordering tool) and needs Amazon Business onboarding | Not a quick win |
| Walmart / Amazon retail | No public buyer API; use Zinc | |
| Sysco, US Foods, Restaurant Depot | EDI / customer portals; no open agent API found | Browser skill remains the fallback, which is the reason to keep both paths |

Sources: shopify.dev/docs/agents (catalog, checkout-mcp), zinc.com/docs (agent-sandbox, llms.txt), docs.business.amazon.com (MCP server page).

## Try it (about 2 minutes, no money, no account)

The cloud sandbox this was built in cannot reach api.zinc.com, so run this on your own machine:

```bash
python3 tools/api_order.py mint                      # saves a test key to data/zinc.key; keep the claim_url it prints
python3 tools/executor.py start --skill examples/assumed-skill/SKILL.md --policy policy/policy.toml \
    --item "test product" --qty 1 --category supplies --quotes examples/quotes.flour.json
python3 tools/executor.py approve --order-id <id shown> --owner-said "approve"
python3 tools/api_order.py place --product-url https://zinc.com/shop/products/test-success \
    --address examples/address.sandbox.json
python3 tools/api_order.py status <zinc order id>   # sandbox goes order_placed -> delivered in ~5 s
```

## Guards
- Test keys only unless the policy has `[api] allow_live = true`.
- `max_price` (cents) is the run's card limit; the vendor refuses anything above it.
- Idempotency key = BuyOnce order id, so a retry cannot double-buy.
- Refused unless the run is `executing` with an approval for that exact order.
- A reported total above the limit halts the run and says an order **was** placed.

## Proven so far
One sandbox order placed end to end on 2026-10-25 via a browser relay (`plan` then `record`): see `examples/live-run-zinc-2026-10-25.md`.

## Not proven yet
The direct `place` path against the network (unit-tested with a fake transport only). Zinc's product search and offers endpoints are not wired, so quotes still come from the skill or a file.
