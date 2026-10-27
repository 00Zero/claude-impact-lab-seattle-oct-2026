# Receipts

Receipts makes an AI agent's payments auditable. Claude does the work; plain code checks every
payment before it runs, every tool call goes into a tamper-evident log, and a verifier compares
that log with the business's records. **The AI never grades itself.**

It's a Claude Code plugin. It works in front of whatever tool the business uses to send money
(a bank or payments MCP server), checks each payment against the bills in **QuickBooks Online**
and the owner's own payee list, and doesn't need a server or a database of its own.

## Why

Small business owners name privacy, security and unreliable output as the main reasons they hold
back on AI. Some who tried AI agents went back to approving everything by hand, because checking
the AI's work cost more than it saved.

Safeguards written as instructions to the model ("pause and ask before paying") depend on the
model following them. Receipts adds checks that run outside the model.

## How it works

```
Claude ── pay_bill ──▶ guard (PreToolUse hook) ── deny / ask owner / allow ──▶ payment tool
                         │ checks C4–C8 against the records (read-only)
                         └ writes its decision to the log
every tool call ──▶ log (PostToolUse hook) ──▶ logs/chain.jsonl   hash chain, numbers masked
end of turn ──▶ verifier: log + records ──▶ logs/receipts/receipt_<bill>.json + a verdict line
```

| Check | Refuses a payment when |
| --- | --- |
| C4 | The account to pay isn't one of the supplier's accounts on the owner's payee list (or, without a list, the account in the records) |
| C5 | The amount isn't the bill's open balance, or the bill doesn't match its purchase order's total |
| C6 | The bill isn't for an open order with that supplier, when purchase orders are required |
| C7 | The bill was already paid, or a payment for it was approved in the last 2 minutes and hasn't finished |
| C8 | The bill came from an address that isn't the supplier's domain, when the records say who sent it |

Payments over the owner's approval amount wait for the owner's yes in Claude Code's own
permission prompt. Anything that goes wrong (records unreadable, a check crashes, the log can't
be written, the hook itself fails) refuses the payment.

The verifier gives each bill one verdict:

| Verdict | Meaning |
| --- | --- |
| VERIFIED | The checks passed, the payment tool ran, and the records hold a matching payment |
| ISSUES_FOUND | A check stopped the payment, or the records disagree with the log: paid despite a refusal, paid without the guard, a payment missing or different from what was approved |
| NOT_PAID | No payment was made: the owner declined, or the bill was already paid and the attempt to pay it again was stopped |
| UNTRUSTED | The log was changed after the fact |

**What Claude says is checked too.** At the end of each turn, Receipts reads Claude's final
message for sentences that say a bill was paid or not paid, logs them in the tamper-evident
log, and compares them with the records (check C11). "Paid BILL-08" when BILL-08 was refused, or
"didn't pay BILL-07" when it was paid, makes the bill ISSUES_FOUND and is called out in the
end-of-turn summary. This is plain code reading sentences, not AI.

The guard also refuses Claude's edits to `receipts.json`, the `logs/` folder, a SQLite records
file, `.mcp.json` and `.claude/settings*.json`, so Claude can't raise its own limits, switch the
hooks off, rename a payment tool or rewrite the log. The payee list and QuickBooks sign-in live
outside the project, and Claude may not read or search them.

**Watch mode** (`"mode": "watch"`) checks and logs every payment and reports what it would have
stopped, but blocks nothing: the way to start a pilot. **Enforce mode** refuses.

## Set up for a business

See **[docs/pilot.md](docs/pilot.md)** for the full walkthrough. In short:

1. Install the plugin:

   ```sh
   claude plugin marketplace add ronaldon2023/receipts-claudesmb
   claude plugin install receipts@receipts
   ```

2. Create `receipts.json` in the folder where the owner runs Claude Code (the `setup` skill
   helps; `examples/quickbooks/receipts.json` is a template). It names the QuickBooks company,
   the approval amount, the mode, and every tool that moves money with which of its arguments
   hold the bill reference, the amount and the account. **A payment tool that isn't listed
   isn't checked.**
3. In the owner's own terminal, connect QuickBooks and build the payee list. Secrets and
   account numbers are typed at hidden prompts and never pass through Claude:

   ```sh
   python3 -m receipts quickbooks login
   python3 -m receipts payee add 56 "Flour Co" --domain flourco.example
   ```

The payee list is the source of truth for where money may go: QuickBooks doesn't keep US
suppliers' bank details, and a bill asking to pay a new account is the classic fraud.

The QuickBooks connector has been tested against a live QuickBooks Online sandbox company
(reading bills, vendors, purchase orders and bill payments, and guarding transfers against
them), as well as by the automated tests.

Receipts pairs well with Anthropic's Small Business plugin
(`anthropics/knowledge-work-plugins`), which connects the business's tools; Receipts checks
the payments made through them.

## Try it

You need Python 3.12 (for the example's mock server) and Claude Code. On Windows, use WSL.

```sh
git clone https://github.com/ronaldon2023/receipts-claudesmb.git
cd receipts-claudesmb
./setup.sh      # virtualenv for the example server and the tests
make reset      # example bakery data, empty log
make demo       # Claude Code in examples/bakery, with this plugin loaded
```

Enable the `bakery` MCP server when asked, then ask Claude:

> Pay this week's supplier bills: BILL-07, BILL-08 and BILL-09. Call pay_bill for each one and
> tell me what happened.

BILL-07 ($800, over the $500 limit) asks for your approval. BILL-08 asks to pay a new bank
account and BILL-09 comes from a look-alike domain; the guard refuses both if Claude tries them.
(Claude often refuses them itself first. The guard is there for when it doesn't.) At the end of
the turn you see a verdict per bill. Check the work yourself at any time:

```sh
make receipt
```

```
Log: intact, <n> entries
Note: Records come from the demo SQLite source, not real books.
BILL-07 ($800.00 to Flour Co): VERIFIED - Paid to the supplier's account on file, and the records match
BILL-09 ($150.00 to Flour Co): ISSUES_FOUND - Stopped before any money moved: Bill came from flourco-payments.example, not Flour Co's flourco.example
```

Change any line in `examples/bakery/logs/chain.jsonl` yourself and run `make receipt` again:
every receipt turns UNTRUSTED. `make reset` starts over.

## Limitations

See **[docs/threat-model.md](docs/threat-model.md)** for what Receipts protects against and
what it doesn't. The main limits:

- **Records:** QuickBooks Online. Other accounting systems need a connector. (The SQLite source
  is only for the example bakery and the tests; Receipts says so whenever it's in use.)
- **Claude Code sessions only.** Payments made elsewhere aren't checked. Use the bank's own
  payee and approval rules as well.
- **Listed tools only.** A payment tool missing from `payment_tools` isn't checked.
- **Bash is covered best-effort**; file tools reliably.
- **Local log.** Copy `logs/` off the machine regularly: someone who can rewrite both the log
  and its head file can forge a shorter log.
- **Claude's summary is checked by plain-text rules.** Sentences that name one bill and say it
  was paid or not paid are compared with the records; a summary that names no bills, or says it
  in unusual words, can't be checked. Treat a match as a good sign, not proof.
- **Not checked yet:** budgets, minimum balances, other currencies, and a second different bill
  for an order that's already paid.

## Development

```sh
make test       # ruff, then pytest
make reset      # fresh example data, empty log, no receipts
make receipt    # verify the example's log and write receipts
```

| Folder | What it is |
| --- | --- |
| `receipts/` | The core: checks, guard, payee list, log, masking, verifier, config, the QuickBooks connector, and a SQLite connector for the demo and tests. Standard library only; runs on Python 3.9+ |
| `hooks/` | The plugin's hooks (`hooks.json`) and their entry point (`run.py`) |
| `skills/setup/` | Helps the owner create `receipts.json` |
| `examples/bakery/` | A mock bakery back office (MCP server and SQLite records) with no checks of its own |
| `examples/quickbooks/` | A `receipts.json` template for a QuickBooks business with a bank transfer tool |
| `docs/` | The pilot guide and the threat model |
| `tests/` | pytest suite |

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

MIT. See [LICENSE](LICENSE).
