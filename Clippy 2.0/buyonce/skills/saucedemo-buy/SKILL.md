---
name: saucedemo-buy
description: Get a quote from, and prepare an order with, Swag Labs on SauceDemo (https://www.saucedemo.com), a public practice shop. Use to demo or test BuyOnce end to end, when the owner asks to price or buy a Sauce Labs item, or when buyonce-buy asks for a SauceDemo quote. Stops at the order overview until the owner approves.
---

<!-- buyonce:purchasing-skill -->

# SauceDemo purchasing skill (reference example)

Source: hand-written reference for what `buyonce-record` produces from one recorded purchase. **Status: run live once through the run controller with Claude in Chrome on 2026-10-25 (see `examples/live-run-2026-10-25.md`); every step worked as written.** Last verified: 2026-10-25.

SauceDemo is a public practice shop built for automation testing. It takes no real payment, which makes it a safe place to rehearse the whole BuyOnce flow.

## Goal
Buy one or more items from the Swag Labs demo shop and finish at the order confirmation, so the team can show the record, quote, approve, and execute loop with no real money.

## Parameters
| Name | Example | Notes |
|---|---|---|
| items | "Sauce Labs Backpack" | exact product names as shown on the inventory page |
| first_name | Alex | checkout info form |
| last_name | Rivera | checkout info form |
| postal_code | 94105 | checkout info form |

The shop sells one of each item per add-to-cart, so quantity per line is 1. For `qty` > 1 of the same item, tell the owner and ask how to proceed.

## Before you start
- Start URL: https://www.saucedemo.com
- Sign-in: the login page publicly lists the demo usernames and the shared demo password. Use the standard demo user shown there. These are practice-site credentials, not the owner's.
- Rules (caps, ratings, approval) live in `policy/policy.toml`.

## Steps

### Quote phase (safe: reads only)
1. Open the start URL and sign in as the standard demo user shown on the login page.
2. On the inventory page, find each requested item by its exact name and read its listed price. Sorting by price (low to high) helps when comparing.
3. Return one quote per item: vendor "Swag Labs (SauceDemo)", unit price from the listing, shipping 0 unless the overview says otherwise, tax_rate 0.08 as an estimate (the exact tax appears on the Overview page), delivery_date today plus 3 days as an estimate, vendor_rating omitted, past_orders 0.

### Cart phase (only after the owner approves)
4. Click "Add to cart" on each approved item.
5. Open the cart (the cart icon at the top right) and check that the items match the approved list.

### Checkout phase (only after the owner approves)
6. Click "Checkout".
7. Fill first name, last name, and postal code from the parameters, then click "Continue".
8. On the **Overview** page, read the item total, tax, and total. Compare with the approved total.
9. If the total is within the approved total plus buffer, click "Finish". The shop takes no payment.

## Stop points and approval
- **Stop after the quote phase** and return the quotes to `buyonce-buy`. Add nothing to the cart before approval.
- **Stop at the Overview page** if the total is higher than approved by more than the card buffer. Show the owner the difference.
- This site has no payment step. On a real vendor, the skill would stop at the payment page instead.

## Verification
- Quote phase: each item's name and price match the inventory page.
- Cart phase: cart lists exactly the approved items.
- Checkout phase: the Overview total is within the approved total plus buffer.
- Final: a thank-you / order-complete message is visible. Report it.

## Site quirks and recovery
- The practice site offers several demo users, and some are deliberately broken (locked out, slow, glitchy). If sign-in fails or a page misbehaves, try the standard demo user again once, then stop and report which user and step failed.
- Selectors and labels on the site may change. Find controls by their visible label ("Add to cart", "Checkout", "Continue", "Finish"), not by position.
- The inventory page scrolls, so screen coordinates shift. In the live run a click by coordinate landed on a product description instead of a button. Click by element reference or label, and check the cart badge and the button text ("Remove") after adding an item.
- The checkout form has First Name, Last Name, and Zip/Postal Code. The Overview page shows "SauceCard #31337" as payment information and free delivery; the total on that page is the number to verify. The confirmation page says "Thank you for your order!".
