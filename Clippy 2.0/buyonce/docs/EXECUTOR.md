# The run controller (`tools/executor.py`)

The browser agent is the hands. The controller is the safety catch. It reads a skill, hands the agent one step at a time, and refuses to hand out the next step when the rules say stop. It does not drive a browser itself, so it works with any agent: Claude in Chrome, Playwright MCP, or an open-source computer-use system. The agent only needs to run shell commands and read JSON.

## States

```
quote ──► needs_quotes ──► awaiting_approval ──► executing ──► handover ──► done
 (read-only    (agent writes      (owner sees         (cart +        (stops BEFORE the
  steps)        quotes JSON)       the card)           checkout)      transaction step)

 any state ──► halted  (anomaly, total mismatch, step failed twice, blocked, no approval)
 awaiting_approval ──► declined
 executing ──► final_step ──► done   (ONLY on sandbox sites listed in the policy)
```

## What it enforces

| Rule | How |
|---|---|
| No cart or checkout step before approval | Those steps are only handed out in state `executing`, which needs an approval record for the exact order id |
| The owner's words are on record | `approve` takes `--owner-said`, which must read as a yes and not contain "no / wait / not / cancel", and is written to the audit log |
| Steps happen in order | `report` for any step but the current one is refused |
| Sign-in and sensitive steps are the owner's | Steps tagged owner-only are handed out as `handover_owner`; the agent cannot report them done without `--owner-done` |
| Totals stay near the approved total | Any `cart_total` / `order_total` above the card limit halts the run |
| The right item is in the cart | If the agent reports `items` and none match the approved item, the run halts |
| Surprises stop the run | Any `--anomaly` halts it, including page text that tries to give the agent instructions |
| Failures don't spiral | A step that fails twice halts the run |
| The transaction step is never handed out on a real site | State `handover`; only hosts in the policy's `[sandbox] hosts` list reach `final_step` |
| One vendor per run | `--vendor` makes a run halt if another vendor's quote wins, with instructions to start a run on that vendor's skill with `--quotes` |

## Commands

```bash
python3 tools/executor.py start --skill SKILL.md --policy policy/policy.toml \
    --item "bread flour 50lb" --qty 10 --need-by 2026-10-30 --category supplies --vendor "Harvest Wholesale"
python3 tools/executor.py next                       # what to do now
python3 tools/executor.py report --step 6 --data '{"price": 33.4, "delivery": "2026-10-29"}'
python3 tools/executor.py submit-quotes --file data/quotes.json
python3 tools/executor.py approve --order-id bo_... --owner-said "approve"
python3 tools/executor.py decline --owner-said "no, hold off"
python3 tools/executor.py finish --note "owner paid"
python3 tools/executor.py status
```

State lives in `data/run.json`; the audit trail in `data/audit.jsonl`. Every command prints JSON.

## See it work without a browser

```bash
python3 tools/sim_run.py                    # happy path: stops before "Place order"
python3 tools/sim_run.py --scenario tamper  # total jumps after approval -> halted
python3 tools/sim_run.py --scenario inject  # a page tries to instruct the agent -> halted
python3 tools/sim_run.py --scenario decline # owner says no -> nothing happens
python3 tools/sim_run.py --sandbox          # SauceDemo practice site: agent may finish after approval
```

## Honest limits

- **The approval is evidence, not a lock.** An agent with shell access could run `approve` itself. The controller records the owner's words and the skill forbids it, but real enforcement needs approval to come from a channel the agent cannot reach, such as the app UI the experience teammate builds. That is the main hardening step.
- The controller trusts what the agent reports. A dishonest or confused agent can report a wrong total. The single-use card cap is the backstop.
- It has completed one live run on the SauceDemo practice site (`examples/live-run-2026-10-25.md`) and its failure modes are tested against simulated agents. It has not run on a real vendor site.
- Sandbox detection is by host name from the skill's URLs. Keep the list short and only add practice sites.
