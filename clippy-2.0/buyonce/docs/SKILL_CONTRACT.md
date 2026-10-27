# Skill contract: what BuyOnce needs from a recorded skill

BuyOnce starts where capture ends. The capture teammate's recorder produces a `SKILL.md`; BuyOnce takes it from there. We do not require our own template, but the skill has to give the executor enough to run it safely. `tools/preflight.py` reads any skill and tells you what it found and what it had to guess.

```bash
python3 tools/preflight.py path/to/SKILL.md
```

## Minimum a skill must contain

| Need | Why | How preflight finds it |
|---|---|---|
| **Numbered steps** | The run controller hands out one step at a time | Lines like `1. Click ...` anywhere outside notes/rules sections |
| **A start URL** | The agent has to know where to go | First `https://` URL in the file |
| **Steps that read the price** | Without them there is nothing to compare, so quotes must come from somewhere else | Steps mentioning price, shipping, delivery date, stock, quantity |
| **The step where money changes hands** | The agent must stop before it | Wording like "Place order", "Pay", "Submit order", "Finish", "card is charged" |

## What preflight infers when a skill is loose

- **Phases.** If the skill has no `Quote / Cart / Checkout` headings, steps are sorted by wording and only ever move forward: reading and searching steps are `quote`, "add to cart" and "open cart" are `cart`, "checkout / saved address / continue" are `checkout`.
- **The transaction boundary.** The first matching step once the cart phase has begun. If none matches, the **last step** is treated as the boundary and preflight warns.
- **Owner-only steps.** Sign-in, passwords, 2FA, CAPTCHAs, and anything about card or bank details. These are never handed to the agent.
- **Steps after the boundary** (like "owner screenshots the confirmation") are ignored with a warning.
- **Parameters.** `{placeholders}` in the steps, plus any table under a "Parameters" heading.

## What makes a skill NOT READY

- No numbered steps.
- A card number, a Stripe key, or a `password:` line anywhere in the file. Remove it and re-record or edit.

## Writing skills that run well (for the capture side)

1. One action per numbered step, written as intent ("Add {item} to the cart"), with the visible label in quotes.
2. Say where the price, shipping, and delivery date are shown.
3. Put the money step on its own line, with plain words ("Click "Place order"").
4. Use `{item}` and `{qty}` for things that change between runs.
5. Keep the owner's rules ("never the 25 lb bag", "call if shipping is over $20") as short notes; BuyOnce moves shared rules into `policy.toml`.
6. No credentials, ever.

## Examples
- `examples/assumed-skill/SKILL.md`: a loose, recorder-style skill with no section names.
- `skills/saucedemo-buy/SKILL.md`: the same idea in our template, for a practice site.
- `templates/purchasing-skill.template.md`: our own format, if you prefer one.
