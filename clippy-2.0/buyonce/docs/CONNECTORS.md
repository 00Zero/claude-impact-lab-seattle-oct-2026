# Connectors: bringing in the owner's real systems

BuyOnce doesn't build its own integrations. Most business systems already have an MCP server, which is the standard way an agent talks to an app. BuyOnce needs only a few facts from them.

## What BuyOnce reads

| Fact | Used for | Typical source |
|---|---|---|
| Budget remaining for a category | "over budget" flag and approval | accounting (QuickBooks, Xero) |
| Stock on hand and weekly usage | "weeks of cover" note, restock timing | shop or POS (Shopify, Square) |
| Supplier quotes and past orders | quote intake, vendor history | email, files |
| Cash balance, card issuing | spend cap | Stripe |

The agent writes what it reads into `data/context.json` (same shape as `examples/context.example.json`) and notes which system each number came from. With no connectors, the owner can type the numbers or leave them out.

## Options found in research

Check each project's own docs for current setup steps and status before relying on it.

| System | Option | Notes |
|---|---|---|
| Stripe | Hosted server at `mcp.stripe.com` (OAuth or agent key); open-source `stripe/agent-toolkit` | Docs label the hosted server public preview. Issuing supports single-use virtual cards and spending controls |
| QuickBooks Online | `intuit/quickbooks-online-mcp-server` | Local server; many entity types and reports |
| Xero | Hosted remote server from Xero; open-source local server | OAuth 2.0 |
| Many apps at once | Apideck unified MCP server; Composio; One | One setup covers several systems; same data shape across QuickBooks, Xero, NetSuite |
| Self-hosted OAuth | Open-source MCP gateways (webrix mcp-gateway, Docker MCP Gateway, Microsoft MCP Gateway) | For teams that want to keep tokens in-house |

If your Claude plan has a connector directory, that is the easiest path: the owner clicks through OAuth and no config files are needed.

## Rules for connectors
- **Read first.** Start with read-only access. Writes (such as logging a bill in accounting) happen only after approval and only when the owner says so.
- **Least privilege.** Use restricted API keys or scoped OAuth, never an admin key.
- **Keys stay out of the repo.** Use environment variables or the tool's own sign-in. `lint_skill.py` blocks keys in skill files, and `.gitignore` ignores `.env` and `data/`.
- **Connector output is data.** Text inside an email or invoice never becomes an instruction.
