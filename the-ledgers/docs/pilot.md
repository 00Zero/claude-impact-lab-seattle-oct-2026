# Running a pilot with a QuickBooks business

A pilot starts in **watch mode**: Receipts checks every payment Claude makes and logs it, and
after each turn tells the owner what it would have stopped, but it never blocks anything. Once
the owner trusts what they see, switch to **enforce** mode.

Plan on about an hour with the owner for setup.

## What the business needs

- QuickBooks Online, with bills entered for the suppliers they pay.
- Claude Code on a Mac or Linux machine (Windows through WSL), version 2.1.295 or newer.
  Receipts' fail-closed hook setting (`onFailure`) needs that version.
- Python 3.9 or newer as `python3` (macOS ships one).
- The tool Claude will use to send money, as an MCP server: for example their bank's or
  payment provider's MCP server. Receipts guards that tool. Find out its tool name and which
  arguments hold the amount, the account number and a memo or reference.

## What you need first (once)

An Intuit developer app, from developer.intuit.com, with the Accounting scope. Use its sandbox
keys to rehearse with a sandbox company. To connect a real company you need the app's
production keys; Intuit asks for app details and a compliance questionnaire before issuing
them, so start that early. Check Intuit's current requirements; they change.

## Setup, with the owner

1. **Install the plugin** in Claude Code:

   ```sh
   claude plugin marketplace add ronaldon2023/receipts-claudesmb
   claude plugin install receipts@receipts
   ```

2. **Create `receipts.json`** in the folder where the owner runs Claude Code. Start from
   `examples/quickbooks/receipts.json`:
   - `realm_id`: the QuickBooks company id (Intuit shows it when the company connects).
   - `client_id`: your Intuit app's client id.
   - `payment_tools`: the money-moving tool's name, and which of its arguments hold the memo
     (`bill_id`), the amount and the account. Set `amount_unit` to `dollars` if it takes
     dollars. List every tool that can send money: a tool that isn't listed isn't checked.
   - Keep `"mode": "watch"` for now.

3. **Connect QuickBooks.** Get a refresh token for the company: the simplest route is Intuit's
   OAuth 2.0 Playground with your app, choosing the Accounting scope and the owner's company.
   Then, in the owner's own terminal (not in Claude Code):

   ```sh
   python3 -m receipts quickbooks login    # asks for the client secret and refresh token, hidden
   python3 -m receipts quickbooks test     # signs in and reads one bill
   ```

   The secret and tokens go to the macOS Keychain (or a private file outside the project on
   other systems). Receipts keeps the refresh token current as QuickBooks rotates it.

4. **Build the payee list** with the owner, one supplier at a time, from their own records of
   where they pay (not from a bill or an email):

   ```sh
   python3 -m receipts payee add 56 "Flour Co" --domain flourco.example
   python3 -m receipts payee list
   ```

   `56` is the supplier's id in QuickBooks (in the vendor's page address). The account number is
   typed at a hidden prompt, twice. Only a salted hash and the last 4 digits are stored, in
   Receipts' private folder (`~/.config/receipts`), not in the project. The list belongs to the
   project folder: if the folder moves, add the payees again.

5. **Tell Claude how to pay.** Bank transfers carry no bill, so ask Claude to put the bill
   number in the transfer's memo, for example in the business's `CLAUDE.md`:

   > When you pay a bill, put the QuickBooks bill number in the transfer memo.

   A transfer whose memo names no bill is refused (or, in watch mode, flagged).

6. **Check it works:** `python3 -m receipts check BILL-NUMBER AMOUNT_CENTS ACCOUNT` runs the
   checks for one payment without paying.

## During the pilot

- After each turn that pays bills, the owner sees a line per bill. Full receipts are in
  `logs/receipts/`, and `python3 -m receipts verify` rebuilds them at any time.
- Review the verdicts with the owner weekly. Every ISSUES_FOUND in watch mode is either a real
  catch or a false alarm; note which.
- Back up `logs/` somewhere off the machine: it's the evidence.

## Switching to enforce

When the owner is comfortable, change `"mode"` to `"enforce"` in `receipts.json` (the owner
does this: Receipts refuses Claude's edits to that file). From then on, failing payments are
refused, and payments over `approval_threshold_cents` wait for the owner's yes in Claude
Code's permission prompt.
