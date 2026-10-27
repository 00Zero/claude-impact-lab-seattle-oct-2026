# Quote format

Vendor skills (and quote-reading from PDFs or emails) produce a JSON list. `tools/compare.py` reads it.

```json
[
  {
    "vendor": "Harvest Wholesale",
    "item": "bread flour 50lb",
    "qty": 10,
    "unit_price": 34.20,
    "price_breaks": [{"min_qty": 10, "unit_price": 33.40}],
    "shipping": 12.00,
    "tax_rate": 0.0875,
    "delivery_date": "2026-10-29",
    "vendor_rating": 4.7,
    "past_orders": 14,
    "in_stock": true,
    "url": "https://vendor.example/item"
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `vendor` | yes | Matches names in the policy's `approved` / `blocked` lists (case-insensitive) |
| `item` | no | Used for display |
| `qty` | yes | Whole number |
| `unit_price` | yes | Before price breaks |
| `price_breaks` | no | Best price whose `min_qty` is met is used |
| `shipping` | no | Default 0 |
| `tax_rate` | no | Fraction (0.0875 = 8.75%). Estimate if the site shows tax only at checkout, and say so |
| `delivery_date` | yes | ISO date (YYYY-MM-DD) |
| `vendor_rating` | no | Out of 5. Omitted ratings are never excluded by `min_rating` |
| `past_orders` | no | How many times the owner has ordered here. Feeds vendor history and the "new vendor" flag |
| `in_stock` | no | `false` excludes the quote |
| `url` | no | Where it was found |

## Context format (budget and stock)

```json
{
  "budget": {"supplies": {"monthly": 1500.00, "spent": 1180.00}},
  "inventory": {"bread flour 50lb": {"on_hand": 6, "weekly_usage": 8}}
}
```

See `examples/` for working files.
