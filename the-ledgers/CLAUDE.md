# Receipts — guide for Claude

Receipts is a Claude Code plugin that guards an AI agent's payments. A PreToolUse hook (the
guard) runs payment checks against the business's records before any payment tool runs, a
PostToolUse hook logs every tool call to a hash chain, and the verifier compares the log with
the records. The AI never grades itself. See `README.md` for how it fits together.

Follow `CONTRIBUTING.md`. In particular:

- `receipts/` and `hooks/` are standard library only and must run on Python 3.9.
- Run `make test` before every commit. Never skip or delete a test to get green.
- Ask before adding a dependency or changing the receipt format (`receipts/verify.py`).
- Receipts never writes to the business's records; a Source is read-only.
- `examples/bakery/` is a stand-in for a real business's systems. It must stay free of checks,
  so it shows the guard working in front of a server that knows nothing about Receipts.
- Never use `git commit --no-verify` or `git push --force`.

## Commands

- `make setup`: create `.venv` and install pinned dependencies
- `make test`: lint and run tests
- `make reset`: fresh example data, empty log, no receipts
- `make demo`: start Claude Code in the example with this plugin loaded
- `make receipt`: verify the example's log and write receipts
