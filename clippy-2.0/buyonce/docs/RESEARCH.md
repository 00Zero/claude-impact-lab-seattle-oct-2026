# Research notes (October 2026)

What exists, so we build on it instead of rebuilding it. Gathered from web and GitHub searches on 2026-10-25; check each link for current status.

## Record a human workflow → reusable skill

| Project | What it does | Why it matters to us |
|---|---|---|
| Claude Cowork **Record a skill** (shipped July 21, 2026) | Screen-record a task with narration; Claude turns it into a rerunnable skill | Our recording input. Narration captures the *why* |
| Claude in Chrome **Teach Claude** | Record a browser workflow; save it as a shortcut | Browser-only alternative; also the browser the agent drives |
| OpenAI Codex **Record & Replay** (June 2026) | Demonstration → standard `SKILL.md` | Shows the output format is an open standard, so skills are portable |
| [Browser-BC](https://github.com/einsia/browser-bc) | Records browser tasks per website; distills each into a skill; installs into Claude Code and Desktop | Closest open-source match for recording → skill |
| [record-replay](https://github.com/minybear/record-replay) | Screen video plus input events → vision model → `SKILL.md` | Video plus event timeline gives better skills than clicks alone |
| [workflow-use](https://github.com/browser-use/workflow-use) | Record once, replay deterministically, agent repairs failing steps | The self-healing idea for our "later" list |
| [Understudy](https://github.com/Neuron-Lab-Automation/understudy) | Learns intent rather than coordinates | Design principle for our vendor skills |
| [Anchor Replicate](https://anchorbrowser.io/blog/anchor-replicate---record-human-demonstration-of-a-browser-task) | Agent learns from a demonstration of legacy and internal sites with no API | Validates the "sites that aren't AI-forward" thesis |
| [Galdr](https://docs.rs/crate/galdr/latest/source/README.md) | Record, distill, replay, with a reliability bench | Idea: a reliability score per skill |

## Procurement with agents
- Enterprise procurement agents exist (a vendor-ordering agent from phData maps login, cart, checkout, and payment per vendor as stored "golden paths"). They are built per customer and take weeks.
- Analysts expect agents to sit in the middle of most B2B buying within a few years. The first agent-eligible spend is the long tail: small, routine, rule-based purchases. That's a small business's whole procurement budget.
- Commentary on small and mid-size companies notes they could never justify a procurement stack or a dedicated buyer. Agents change that from a software sale into a labor replacement.

## Connectors and payments
- Official MCP servers exist for Stripe (hosted, plus the open-source `stripe/agent-toolkit`), QuickBooks Online (Intuit), and Xero (hosted and local). Unified layers (Apideck, Composio, One) cover many apps with one setup.
- Stripe's agent toolkit supports single-use virtual cards via Issuing, spending controls, and real-time authorization of purchases. This is the basis for our spend cap.
- Open-source and startup projects (for example Sardis) offer agent wallets with spending policies. Useful as reference; none is a dependency.

## Practice sites for rehearsal
SauceDemo (Swag Labs), Demoblaze, and the lists in [awesome-sites-to-test-on](https://github.com/BMayhew/awesome-sites-to-test-on) are stable e-commerce sandboxes with cart and checkout flows. Real sites change and can carry legal limits on automation.

## Our angle
Recording → skill is table stakes. The gap is the **buying judgment** layer: one rules file shared by all vendors, comparison on delivered cost and fit rather than sticker price, budget and stock context from the owner's systems, a human approval card, and a spend cap that bounds the worst case.
