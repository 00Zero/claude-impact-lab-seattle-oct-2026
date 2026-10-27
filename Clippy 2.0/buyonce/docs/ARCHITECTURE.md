# Architecture

BuyOnce is mostly text. The "code" a small business touches is a skill file and a policy file. The few scripts are small, dependency-free, and do the parts that must be exact (money, rules, caps).

```
Owner (text / voice / PDF / photo)
        │
        ▼
  buyonce-buy  (skill: the workflow and the ground rules)
        │
        ├── context ───────── MCP connectors: accounting (budget), shop (inventory), email (quotes)
        │                      → data/context.json
        │
        ├── quotes ────────── vendor skills (skills/<vendor>-buy) run in a browser
        │                      (Claude in Chrome or Playwright MCP) → data/quotes.json
        │
        ├── tools/compare.py ─ policy/policy.toml + quotes + context → ranked result + plain-English why
        │
        ├── tools/gate.py ──── ask / allow / block → approval card → audit log
        │          ▲
        │          └── owner replies "approve"   (the only way past this point)
        │
        ├── tools/issue_card.py ─ single-use spend cap (Stripe Issuing, test mode)
        │
        └── vendor skill, cart + checkout phases → stops at the payment page → owner pays
```

## Where we start

Capture (recording a purchase and parsing it into a skill) belongs to another teammate. BuyOnce **assumes a skill exists** and takes it forward:

```
vendor skill (SKILL.md from the recorder)
   │  tools/preflight.py   steps, phases, owner-only steps, the transaction boundary, secrets check
   ▼
tools/executor.py  (run controller, holds the rules)
   │   ▲
   │   └── reports from the browser / computer-use agent (any agent; it only needs a shell and JSON)
   ▼
one step at a time ─► quotes ─► compare.py + gate.py ─► approval card ─► owner "approve"
                  ─► cart ─► checkout ─► STOP at the transaction boundary (owner pays)
```

The controller is deliberately separate from the agent. The agent is replaceable (Claude in Chrome, Playwright MCP, an open-source computer-use system); the rules are not. See [EXECUTOR.md](EXECUTOR.md) and [SKILL_CONTRACT.md](SKILL_CONTRACT.md).

## Why split it this way

- **Skills hold judgment and site knowledge.** They are text the owner can read and fix. A new vendor is a new folder, not a code change.
- **Scripts hold anything that must be exact.** Prices use `Decimal`. Rules are deterministic, so the same inputs give the same answer and the tests can pin it down. The model never does the arithmetic.
- **The policy is separate from vendor skills.** Rules are written once and apply to every vendor. Record a second vendor and BuyOnce can compare without anyone rewriting rules.
- **The gate is a hard stop, not a suggestion.** The orchestrator skill makes "wait for approve" a ground rule, and `gate.py` leaves an audit trail of what was presented and what was approved.

## Record → skill

`buyonce-record` takes whatever the owner has (a Cowork screen recording with narration, a Claude in Chrome shortcut, a transcript, screenshots) and writes `skills/<vendor>-buy/SKILL.md` from `templates/purchasing-skill.template.md`. It records **intent** ("add {item} to the cart") rather than coordinates, so the skill survives small site changes. The narration's *why* becomes the decision rules. See [RESEARCH.md](RESEARCH.md) for how other tools approach this.

## Scoring

Among quotes that pass every rule (not blocked, rating, deadline, hard cap, in stock), each gets three scores from 0 to 1:

- **price** = cheapest eligible total ÷ this total
- **speed** = (fastest eligible days + 1) ÷ (this days + 1)
- **reliability** = rating ÷ 5, blended with order history when `prefer_past_vendors` is on

The weights come from `[scoring]` in the policy. Ties go to the lower total. Soft problems (new vendor, over budget) don't exclude a quote; they become reasons the gate asks for approval.

## Extending

| To add | Do this |
|---|---|
| A vendor | Record it with `buyonce-record`; commit `skills/<vendor>-buy/` |
| A rule | Add a field to `policy/policy.example.toml`, a check in `compare.evaluate`, and a test |
| A connector | Add its MCP server to `.mcp.json`; have `buyonce-buy` write what it reads into `data/context.json` |
| A real payment hand-off | Replace the "owner pays" step with the owner's credential manager; keep the agent out of the card details |
