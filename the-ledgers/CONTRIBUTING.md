# Contributing

Thanks for helping. Receipts checks money movements, so changes are held to a few rules.

## Setup

```sh
./setup.sh
make reset
make test
```

## Rules

- **Plain code decides every status.** No LLM call may decide whether a payment passes, or what
  a receipt says.
- **Fail closed.** If a check can't run, the payment is refused.
- **Money is integer cents.**
- **Receipts never writes to the business's records.** Sources are read-only connectors.
- **`receipts/` and `hooks/` use the Python standard library only** and must run on Python 3.9:
  the hooks run on the owner's system `python3`. Use `from __future__ import annotations`.
- **Never write raw account, card or ID numbers** to the log, a receipt or a message. Use
  `receipts.pii.mask`.
- **Escape anything you display.** Bills and emails contain attacker-written text.
- **Example data only:** `*.example` domains, no real people, businesses or account numbers.
- **No secrets in the repo.** API keys come from the environment.

## Code style

- Type hints on public functions, `ruff` for lint and format (100 columns). Development uses
  Python 3.12; the core must also run on 3.9.
- Logic lives in importable functions in `receipts/`; `hooks/run.py` and
  `receipts/__main__.py` only read input and print.
- Tests in pytest under `tests/`. Every bug fix comes with a test that fails without it.

## Pull requests

- Keep each pull request small and focused, with a short description of what changed and why.
- `make test` must pass. CI runs the same checks on every pull request.
- Don't skip or delete a test to get green.

## Reporting a security issue

Please don't open a public issue. Use GitHub's private vulnerability reporting on this
repository instead.
