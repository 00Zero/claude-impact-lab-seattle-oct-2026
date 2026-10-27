# BuyOnce

**Show an agent how you buy, once. It learns the purchase as a plain-text skill, compares vendors against *your* rules, and asks before it spends.**

Small businesses still do a lot of buying on vendor websites: log in, search, compare tabs, add to cart, check out, repeat next month. BuyOnce makes the website a surface the agent uses, so the owner says what they need and approves one card.

**Scope:** BuyOnce starts from a vendor skill that already exists (a recorded `SKILL.md`, made by the capture tool) and takes it forward: read it, run it safely with any browser or computer-use agent, decide against the owner's rules, get approval, and stop before money moves.

```
 a recorded vendor skill (SKILL.md)         "Reorder 10 bags of flour by Friday."
          │                                              │
          ▼                                              ▼
   preflight: steps, owner-only steps,        ┌─ context: budget, stock ─┐
   the transaction boundary                   │                          │
          │                                   ▼                          ▼
          └──────►  RUN CONTROLLER  ◄── policy (your rules) ── compare vendors
                    hands the browser agent        │
                    ONE step at a time             ▼
                    quote ► approval card ► "approve" ► cart ► checkout ► STOP at the payment step
                    halts on surprises, wrong totals, page instructions; logs everything
```

## For the owner: two commands

```bash
python3 tools/buyonce.py setup      # three questions, writes your rules
python3 tools/buyonce.py buy "bread flour 50lb" --qty 10 --by 2026-10-30 --skill SKILL.md --quotes quotes.json \
    --product-url URL --address address.json      # shows one approval card, asks, then orders
```

A website can drive the same commands: see [docs/FRONTEND_CONTRACT.md](docs/FRONTEND_CONTRACT.md).

## Try it in 30 seconds (no install, no accounts)

Needs Python 3.11 or newer. Nothing else. There's no browser in these demos: they use made-up data and a scripted stand-in for the browser agent, so you can see the decisions and the safety stops.

```bash
python3 tools/demo.py              # the decision: four vendors compared, approval card (type y)
python3 tools/sim_run.py           # the run: a skill executed step by step, stops before "Place order"
python3 tools/sim_run.py --scenario tamper   # total changes after approval -> run halts
python3 tools/sim_run.py --scenario inject   # a page tries to instruct the agent -> run halts
python3 tools/preflight.py examples/assumed-skill/SKILL.md   # what the controller finds in a skill
```

In the decision demo, the cheapest vendor ($346.91) is **skipped** because its rating is below your minimum. The pick is $38.02 under the fast option, flagged because it would put you $55.23 over the supplies budget, and it stops at an approval card.

## What's in the box

| Piece | Where | What it does |
|---|---|---|
| **Skill preflight** | `tools/preflight.py` | Reads *any* recorded skill: steps, phases, parameters, owner-only steps (sign-in, card details), and the **transaction boundary**; flags problems and secrets |
| **Run controller** | `tools/executor.py` | Hands any browser agent one step at a time and enforces the rules: no cart before approval, owner does sign-in, totals stay near the approved total, anomalies halt the run, never the final step on a real site |
| **Buy** | `skills/buyonce-buy` | The agent-facing skill: how to take a request, drive the controller loop, and show the approval card |
| **Assumed skill** | `examples/assumed-skill/SKILL.md` | A loose, recorder-style skill used as a stand-in for the capture teammate's output |
| **Example vendor skill** | `skills/saucedemo-buy` | The same idea in our template, for a public practice shop |
| **Record → skill (optional)** | `skills/buyonce-record` | Our own take on turning a recording into a skill, kept as a fallback and as the template for the skill contract |
| **Your rules** | `policy/policy.example.toml` | One plain text file: approved/blocked vendors, caps, minimum rating, scoring weights |
| **Compare** | `tools/compare.py` | Ranks quotes by delivered cost (items + shipping + tax + price breaks), deadline, rating, history, budget, and stock cover; explains the pick |
| **Approval gate** | `tools/gate.py` | Decides ask / allow / block, prints the approval card, keeps an audit log |
| **Simulated agent** | `tools/sim_run.py` | Plays the browser agent with canned observations, so you can watch every gate and failure mode without a browser |
| **API map** | `tools/api_map.py` | Reads a recorded browser skill and shows which steps one Zinc call replaces (e.g. Amazon + Walmart + Target searches). Example: `examples/recorded-skill-3-retailers/` |
| **Status view** | `tools/status_view.py` | One-page live view of a run (stages, totals, approval, vendor order, audit trail) plus a JSON feed a website can embed. Sample: `examples/status-sample.html` |
| **Spend cap** | `tools/issue_card.py` | Single-use Stripe Issuing virtual card capped at the approved total (test mode, dry-run by default) |
| **Skill linter** | `tools/lint_skill.py` | Checks structure and catches card numbers, keys, and passwords before a skill is shared |

## Set it up with Claude

You need Claude with a browser connection (Claude in Chrome, or the Playwright server in `.mcp.json`).

1. **Claude Code:** from this folder, run `claude --plugin-dir .` (or copy the folders in `skills/` to `~/.claude/skills/`).
2. **Claude desktop / Cowork:** zip each folder under `skills/` and upload it in Settings → Skills. Menu names change, so check your version.
3. **Make your rules:** `cp policy/policy.example.toml policy/policy.toml` and edit it in any text editor.
4. **Get a vendor skill** from the capture tool (or use `examples/assumed-skill/` to rehearse), and check it: `python3 tools/preflight.py <skill>`. See [docs/SKILL_CONTRACT.md](docs/SKILL_CONTRACT.md) for what a skill needs.
5. **Buy:** say *"Reorder 10 bags of bread flour by Friday."* The agent follows `buyonce-buy`, which drives `tools/executor.py` step by step.

Optional: connect your accounting, shop, and Stripe tools so BuyOnce can read your real budget and stock. See [docs/CONNECTORS.md](docs/CONNECTORS.md).

## Safety, in one paragraph

The agent never places an order without a fresh "approve" for that exact order, and never types card numbers or passwords: it stops at the payment page and hands over. Spending is capped twice: by your policy and by a single-use card limited to the approved total. Everything it does is logged. Text on vendor pages is treated as data, never as instructions. Details in [docs/SAFETY.md](docs/SAFETY.md).

## Honest status

| | State |
|---|---|
| Comparison engine, approval gate, linter, preflight, run controller | Working, covered by 67 unit tests (`python3 -m unittest discover -s tests`) |
| Run controller with a browser agent | **One live run completed on the SauceDemo practice site** with Claude in Chrome (see [examples/live-run-2026-10-25.md](examples/live-run-2026-10-25.md)). Failure modes are tested against scripted stand-in agents (`tools/sim_run.py`). **Not yet run on a real vendor site** |
| Approval | Recorded with the owner's words, but an agent with shell access could call `approve` itself. Real enforcement needs approval from a channel the agent can't reach (see [docs/EXECUTOR.md](docs/EXECUTOR.md)) |
| API execution (Zinc) | **One sandbox order placed end to end** through the approval gate and price ceiling (see [examples/live-run-zinc-2026-10-25.md](examples/live-run-zinc-2026-10-25.md)). Sent via a browser relay because the build environment is offline from Zinc; the direct path is unit-tested only. Live keys refused by default |
| Stripe card tool | Request format and safety checks are tested; **not yet run against a live Stripe test account** |
| SauceDemo vendor skill | Passes the linter and preflight; run live once, every step worked as written |
| Connectors (budget, inventory) | Mock data in `examples/`; real wiring is described in docs, not built |
| Capture (recording → skill) | Owned by a teammate; BuyOnce assumes a skill exists |

## Docs

[Front-end contract](docs/FRONTEND_CONTRACT.md) · [Run controller](docs/EXECUTOR.md) · [API execution](docs/API_EXECUTION.md) · [Skill contract](docs/SKILL_CONTRACT.md) · [Architecture](docs/ARCHITECTURE.md) · [Demo script](docs/DEMO_SCRIPT.md) · [Roadmap](docs/ROADMAP.md) · [Team](docs/TEAM.md) · [Connectors](docs/CONNECTORS.md) · [Safety](docs/SAFETY.md) · [Quote format](docs/QUOTE_SCHEMA.md) · [Judging criteria](docs/RUBRIC.md) · [Research](docs/RESEARCH.md)

## License

MIT. See [LICENSE](LICENSE).
