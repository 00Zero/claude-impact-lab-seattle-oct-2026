---
name: setup
description: Set up Receipts for a business by creating receipts.json in the project folder, and walk the owner through connecting QuickBooks and building their payee list. Use when the owner asks to set up Receipts, or asks which payments Receipts checks.
---

# Set up Receipts

Receipts checks payments only in a folder with a `receipts.json`. Help the owner create it.
The full guide is `docs/pilot.md` in the Receipts repository.

## If receipts.json already exists

Show the owner, in plain words, what it says: the mode (watch or enforce), the business name,
which tools are checked as payment tools, where the records come from, and the approval amount.
Don't change it: Receipts refuses edits to it from Claude, so that Claude can't loosen its own
limits. Tell the owner to edit it themselves if something should change.

## Otherwise, ask (one AskUserQuestion call)

| Header | Question | Options |
|---|---|---|
| Business | What's the name of your business? | (free text through "Other") |
| Records | Where do you keep your bills? | QuickBooks Online (Recommended) · Something else |
| Approval | Payments above what amount should wait for your yes? | $500 (Recommended) · $1,000 · $2,500 |

If the records are kept somewhere other than QuickBooks Online, say plainly that Receipts can't
read them yet, and stop: don't create a file that points at records Receipts can't read.

## Find the payment tools

Look through the MCP tools in this session for ones that send money or pay bills. For each,
note which arguments hold the bill (for a bank transfer: its memo or reference), the amount,
and the account paid, and whether the amount is in dollars or cents. Show the owner the list
and ask them to confirm it's complete: **a payment tool that isn't listed isn't checked.**

## Write the file

Show the owner the file and wait for their yes, then write `receipts.json` with the Write tool.
Start in watch mode: Receipts checks and logs every payment and reports what it would have
stopped, but blocks nothing until the owner switches to enforce. Money is integer cents.

```json
{
  "business": "Sweet Rose Bakery",
  "mode": "watch",
  "source": {
    "type": "quickbooks",
    "environment": "production",
    "realm_id": "COMPANY_ID",
    "client_id": "INTUIT_APP_CLIENT_ID"
  },
  "approval_threshold_cents": 50000,
  "require_purchase_order": false,
  "payment_tools": {
    "mcp__bank__send_transfer": {
      "bill_id": "memo", "amount_cents": "amount", "to_account": "account_number",
      "amount_unit": "dollars"
    }
  }
}
```

## What the owner does next, in their own terminal

Claude can't do these: Receipts refuses Claude running its commands or reading secrets, so
that account numbers and QuickBooks credentials never pass through this session. Give the owner
these commands to run outside Claude Code:

1. `python3 -m receipts quickbooks login`, then `python3 -m receipts quickbooks test`.
2. For each supplier they pay, from their own records (not from a bill or an email):
   `python3 -m receipts payee add VENDOR_ID "Supplier Name" --domain supplier.example`.

Never ask for, repeat or save a full account number. If the owner types one here, tell them
it's now in this chat's history and that the payee list should be filled in from their
terminal instead.

End by saying exactly what happens now: before any listed payment tool runs, Receipts checks
the payment against QuickBooks and the payee list (an account on the list, the bill's open
amount, an open bill not already paid, the order if required) and records the result; in
watch mode it only reports, in enforce mode it refuses failing payments and asks the owner
before payments over the approval amount. Every tool call is logged. Nothing else is checked.
