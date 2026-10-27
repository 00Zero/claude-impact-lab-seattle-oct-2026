---
name: zinc-buy
description: Buy a product from Amazon, Walmart, Target and other retailers through the Zinc order API (https://api.zinc.com) instead of a website. Use when the owner asks to reorder a product by link, or when buyonce-buy needs a Zinc quote. Test keys place sandbox orders that move no money.
---

<!-- buyonce:purchasing-skill -->

# Zinc purchasing skill (API execution)

Source: hand-written. Execution is an API call, not clicks. Run by the controller: quote and approval first, then the order call with the approved limit as the price ceiling.

## Goal
Place one order for a product URL through the Zinc API at or below the approved total, then report the Zinc order id and status.

## Parameters
| Name | Example | Notes |
|---|---|---|
| item | "test product" | what the owner asked for |
| qty | 1 | integer |
| product_url | https://zinc.com/shop/products/test-success | retailer product page URL |

## Before you start
- Credentials: the Zinc key lives in data/zinc.key or ZINC_API_KEY. Never print it.
- Rules (caps, ratings, approval) live in `policy/policy.toml`.

## Steps

### Quote phase (safe: reads only)
1. Read the unit price, shipping and delivery estimate for the product URL from Zinc (product offers).
2. Return one quote with vendor "Zinc", unit price, shipping, tax estimate and delivery date.

### Cart phase (only after the owner approves)
3. Build the order: product URL, quantity, the owner's saved shipping address, and a price ceiling equal to the approved card limit.

### Checkout phase (only after the owner approves)
4. Send the order to the Zinc orders endpoint with the order id as idempotency key.
5. Poll the order until it shows placed, then report its id and status.

## Stop points and approval
- Place nothing before the owner approves the exact total.
- Never raise the price ceiling above the approved card limit.
- A response that charges more than the limit is a stop: report it.

## Verification
- The order id returned by Zinc matches a lookup of that order.
- Status is order_placed or later.

## Site quirks and recovery
- Test keys (zn_test_) run in a sandbox that advances order_placed, tracking, in_transit, delivered within about 5 seconds.
- A rejected price ceiling means the real total is above what was approved: stop and ask the owner.
- Keys expire after 7 days without use.
