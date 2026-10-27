# Roadmap

The four steps, mapped to what exists in this repo.

| # | Step | Owner | Status | Where |
|---|---|---|---|---|
| 1 | **Intake and price comparison**: request by text, voice, or PDF → ranked results | S | Comparison engine done and tested. Voice/PDF/photo intake is handled by Claude itself and described in the skill | `tools/compare.py`, `skills/buyonce-buy` |
| 2 | **Record a purchasing workflow** (human doing it) | S | Skill and template done. Needs a first real recording | `skills/buyonce-record`, `templates/` |
| 2.1 | → Create a skill file, text-forward | S | Template, linter, and a reference example done. **Next: record SauceDemo and replace the draft** | `skills/saucedemo-buy` |
| 3 | **Make it more user-friendly** | JK | Not started. See ideas below | n/a |
| 4 | **Execute the purchase** (agent doing it) | PK | Orchestration written; gate and card cap tested. **Not yet run against a live site** | `skills/buyonce-buy`, `tools/gate.py`, `tools/issue_card.py` |

## Scope note (2026-10-25)
Capture (recording → skill) is owned by another teammate. This repo **assumes a skill exists** (`examples/assumed-skill/` stands in for it) and covers everything after: preflight, the run controller, comparison, approval, spend cap, and the stop before payment. `docs/SKILL_CONTRACT.md` is the interface between the two efforts.

## Next up (in order)
1. Agree the skill format with the capture teammate against `docs/SKILL_CONTRACT.md`, then run `tools/preflight.py` on their first real output. (S + PK)
2. ~~Run the controller with a live browser agent on SauceDemo~~ Done 2026-10-25, see `examples/live-run-2026-10-25.md`. Next: run the **quote phase only** on one real vendor site (the controller stops before payment there). (PK)
3. Record a **second** vendor so the comparison is across two real sites. (S)
4. Create a Stripe test account with Issuing and run `issue_card.py --execute` once. (PK)
5. Wire one real connector for budget (accounting) and one for stock. (PK)
6. Make the approval card pretty: a one-screen view the owner can approve from a phone. (JK) This is also the hardening step for `approve`: the owner's tap should be the only way to call it (see `docs/EXECUTOR.md`).

## API path (added 2026-10-25)
Execution can go through a vendor API instead of a browser. First adapter: Zinc sandbox. Next: run it live from a laptop, wire Zinc/Shopify search for the quote phase. See `docs/API_EXECUTION.md`.

## Ideas for step 3 (user-friendliness)
- Approval as a single card with Approve / Change / Cancel, readable on a phone.
- "Why" lines in the owner's own words (tone setting in the policy).
- A weekly digest: what was bought, what it saved against the cheapest option, and what's about to run out.
- A guided first-run: three questions that write `policy.toml`, so nobody edits TOML by hand.
- Show the skill as a readable checklist with an "edit this step" button.

## Later
- A skill reliability score (how many runs worked) and self-repair when a vendor changes its site.
- Reorder prediction from stock and sales.
- Hand payment to the owner's password manager instead of a manual step.
- Live Stripe Issuing, behind a clearly separate switch from test mode.
