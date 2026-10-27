# Threat model

What Receipts protects against, how, and what it doesn't.

## What's being protected

A small business lets Claude pay supplier bills. The risk is money going somewhere it
shouldn't, and nobody being able to tell afterwards what happened.

## Who or what might cause harm

| Threat | Example |
| --- | --- |
| Invoice fraud | An email or a bill asks to pay a "new" bank account, or comes from a look-alike domain |
| Prompt injection | Text in an email or a bill tells Claude to pay someone, or to skip a check |
| Model mistakes | Claude pays the wrong amount, the wrong bill, or the same bill twice |
| Claude loosening its own limits | Claude edits the settings, the payee list or the log |
| Tampering after the fact | Someone edits the log to hide what was paid |

## Defences

| Defence | Where | Covers |
| --- | --- | --- |
| Checks C4–C8 run as plain code before the payment tool, outside the model | `receipts/guard.py`, `receipts/checks.py` | Fraud, injection, mistakes |
| The account to pay must be on the owner's payee list, which only the owner edits, from their own records | `receipts/payees.py` | Bank-change fraud, injection |
| Payments over a threshold need the owner's yes in Claude Code's permission prompt, not in chat | guard "ask" | Large mistakes |
| Fail closed: unreadable records, a crashed check, an unwritable log or a failed hook refuse the payment | guard, `hooks/hooks.json` `onFailure: block` | Errors turning into payments |
| One payment in flight per bill: an approval marks the bill until its payment call is logged (up to 2 minutes), under a lock with a time limit | guard, `receipts/pending.py`, C7 | Double payment from parallel calls |
| Claude may not edit `receipts.json`, `logs/`, a SQLite records file, `.mcp.json` or `.claude/settings*.json` (which decide which hooks and tools exist); the payee list and stored sign-ins live outside the project, and Claude may not read or search them; and Claude may not run Receipts' commands | guard `protects()` | Claude loosening its own limits |
| Claude's final message is read for payment claims (plain code), which are logged and compared with the records; a contradicted claim makes the bill ISSUES_FOUND (C11) | `receipts/claims.py`, `receipts/stop.py`, `receipts/verify.py` | Hallucinated or false "done" reports |
| Every tool call and every guard decision in a hash chain; the verifier marks everything UNTRUSTED if a line changes, a line is removed, or the log is deleted | `receipts/chain.py`, `receipts/verify.py` | Tampering after the fact |
| Claude may not edit Receipts' own code (the plugin folder and Claude Code's installed plugins), or run shell commands that delete, move or rewrite the logs folder | guard `protects()` | Claude switching the guard off or wiping the evidence |
| The verifier compares decisions with the records: paid despite a refusal, paid without the guard, a payment that doesn't match, or an extra payment nobody approved | `receipts/verify.py` | Payments that bypassed the guard |
| Account numbers masked to the last 4 digits in the log, receipts and messages; stored as salted hashes in the payee list | `receipts/pii.py`, `receipts/payees.py` | Leaking numbers |
| QuickBooks secrets in the Keychain or a private file outside the project; every QuickBooks lookup for one payment must finish within 20 seconds, so the guard decides before the hook's 30-second limit | `receipts/quickbooks.py`, `receipts/paths.py` | Leaking credentials; a slow lookup letting a payment through |

## Limits

- **Only Claude Code sessions with the plugin enabled.** Payments made elsewhere (a person in the
  bank's website, another agent, a session without the plugin) aren't checked. The verifier
  can flag a payment it finds in the records without a guard decision, but only for bills the
  log mentions. Use the bank's own payee and approval rules as well.
- **Only listed payment tools.** A money-moving tool missing from `payment_tools` isn't checked.
- **Bash is covered best-effort.** The guard refuses shell commands that name protected files,
  but a determined command can avoid naming them. File tools are covered reliably.
- **Approval in bypass-permissions mode** can't be asked, so it's refused instead.
- **The log lives on the machine.** Someone with write access to both the log and its head
  file can forge a shorter log. Copy the log off the machine regularly.
- **The payee list's hashes can be brute-forced** (account numbers are short). The list keeps
  numbers out of sight; it isn't a vault. The guard stops Claude reading it.
- **The records are trusted.** If someone changes a bill in QuickBooks itself, the checks judge
  against the changed bill. The payee list is the independent source for where money may go.
- **The owner's machine is trusted.** Malware with the owner's privileges can do anything the
  owner can.
- **Claude's summary is checked only where it's clear.** Plain-text rules read sentences that
  name one bill and say it was paid or not; anything vaguer isn't checked.
- **Not checked yet:** budgets, minimum balances, a second different bill for an order that's
  already paid, and currencies other than the company's.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository; please don't open a public
issue.
