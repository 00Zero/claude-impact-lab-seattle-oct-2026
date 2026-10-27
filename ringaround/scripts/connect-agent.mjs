// One-time setup: lets the calling agent report progress to RingAround.
//
//   node --env-file=.env.local scripts/connect-agent.mjs            # dry run: show what would change
//   node --env-file=.env.local scripts/connect-agent.mjs --apply    # make the changes
//
// Needs CLAUDE_API_KEY, CLAUDE_AGENT_ID, CLAUDE_VAULT_ID and MCP_TOKEN (the same
// value as the MCP_TOKEN secret on the GitHub `prod` environment). Production
// deploys run it with --apply. Safe to run again: it updates what's already
// there instead of adding duplicates, and leaves the agent alone (no new
// version) when it already matches.
//
// It does four things, and nothing else:
//   1. stores MCP_TOKEN in the vault as a bearer credential for the endpoint URL;
//   2. adds the endpoint to the agent's MCP servers;
//   3. adds its toolset to the agent with `always_allow`, so reporting a call
//      never pauses the agent for approval (it's our own server, and the tool
//      only records status);
//   4. sets the agent's system prompt to agent/system-prompt.md, the reviewed
//      copy kept in this repo. Edit that file, not the prompt in the Console.
// The agent's model and existing tools are left as they are.

import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

const SERVER_NAME = "ringaround";
const SERVER_URL = process.env.RINGAROUND_MCP_URL ?? "https://ringaround.me/api/mcp";
const apply = process.argv.includes("--apply");
const systemPrompt = (await readFile(new URL("../agent/system-prompt.md", import.meta.url), "utf8")).trim();

for (const name of ["CLAUDE_API_KEY", "CLAUDE_AGENT_ID", "CLAUDE_VAULT_ID", "MCP_TOKEN"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Add it to .env.local.`);
    process.exit(1);
  }
}

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const agentId = process.env.CLAUDE_AGENT_ID;
const vaultId = process.env.CLAUDE_VAULT_ID;

const agent = await client.beta.agents.retrieve(agentId);
console.log(`Agent ${agent.id} "${agent.name}", version ${agent.version}`);
console.log(`  model: ${typeof agent.model === "string" ? agent.model : agent.model?.id}`);
console.log(`  MCP servers: ${agent.mcp_servers.map((s) => `${s.name} (${s.url})`).join(", ") || "none"}`);
console.log(`  tools: ${agent.tools.map((t) => (t.type === "mcp_toolset" ? `mcp_toolset:${t.mcp_server_name}` : t.type === "custom" ? `custom:${t.name}` : t.type)).join(", ") || "none"}`);
console.log(`  system prompt: ${agent.system ? `${agent.system.length} characters` : "none"}`);

// Progress used to be reported by webhook; reporting now goes through the
// report_call tool, and the prompt in agent/system-prompt.md says so. Show any
// webhook instructions the live prompt still has, which --apply replaces.
const webhookLines = (agent.system ?? "").split("\n").map((line, i) => [i + 1, line]).filter(([, line]) => /webhook/i.test(line));
if (webhookLines.length > 0) {
  // CI logs are readable by anyone with access to the repo's Actions, so
  // prompt text is only printed when run by hand.
  if (process.env.CI) {
    console.log(`\n  Live system prompt mentions webhooks on line(s) ${webhookLines.map(([n]) => n).join(", ")} (replaced by --apply)`);
  } else {
    console.log("\n  Live system prompt lines about webhooks (replaced by --apply):");
    for (const [n, line] of webhookLines) console.log(`    ${n}: ${line.trim()}`);
  }
}
const promptChanges = (agent.system ?? "").trim() !== systemPrompt;

// Existing tools and servers are sent back as they are; ours is added or replaced.
const mcpServers = [
  ...agent.mcp_servers.filter((server) => server.name !== SERVER_NAME).map(({ type, name, url }) => ({ type, name, url })),
  { type: "url", name: SERVER_NAME, url: SERVER_URL },
];
const tools = [
  ...agent.tools.filter((tool) => !(tool.type === "mcp_toolset" && tool.mcp_server_name === SERVER_NAME)),
  { type: "mcp_toolset", mcp_server_name: SERVER_NAME, default_config: { enabled: true, permission_policy: { type: "always_allow" } } },
];

const credentials = [];
for await (const credential of client.beta.vaults.credentials.list(vaultId)) credentials.push(credential);
const existing = credentials.find((c) => c.auth?.mcp_server_url?.replace(/\/$/, "") === SERVER_URL.replace(/\/$/, ""));

// Whether the agent already has our server and toolset exactly as we'd set them.
const ourServer = agent.mcp_servers.find((server) => server.name === SERVER_NAME);
const ourToolset = agent.tools.find((tool) => tool.type === "mcp_toolset" && tool.mcp_server_name === SERVER_NAME);
const toolsetChanges =
  ourServer?.url !== SERVER_URL ||
  !ourToolset ||
  ourToolset.default_config?.enabled === false ||
  ourToolset.default_config?.permission_policy?.type !== "always_allow" ||
  (ourToolset.configs ?? []).length > 0;

console.log(`\nWill ${existing ? `update the token on credential ${existing.id}` : "create a bearer credential"} in vault ${vaultId} for ${SERVER_URL}`);
console.log(
  toolsetChanges
    ? `Will set MCP server "${SERVER_NAME}" -> ${SERVER_URL} and its toolset (always_allow) on the agent`
    : `MCP server "${SERVER_NAME}" and its toolset are already set up on the agent`,
);
console.log(
  promptChanges
    ? `Will replace the system prompt (${agent.system?.length ?? 0} characters) with agent/system-prompt.md (${systemPrompt.length} characters)`
    : "System prompt already matches agent/system-prompt.md",
);
if (!apply) {
  console.log("\nDry run: nothing changed. Re-run with --apply.");
  process.exit(0);
}

if (existing) {
  await client.beta.vaults.credentials.update(existing.id, {
    vault_id: vaultId,
    auth: { type: "static_bearer", token: process.env.MCP_TOKEN },
  });
} else {
  await client.beta.vaults.credentials.create(vaultId, {
    display_name: "RingAround call reporting",
    auth: { type: "static_bearer", mcp_server_url: SERVER_URL, token: process.env.MCP_TOKEN },
  });
}

if (!toolsetChanges && !promptChanges) {
  console.log(`\nDone. Vault token refreshed; agent already up to date at version ${agent.version}.`);
  process.exit(0);
}

// `version` makes this fail rather than overwrite if the agent changed since we read it.
const updated = await client.beta.agents.update(agentId, {
  version: agent.version,
  mcp_servers: mcpServers,
  tools,
  ...(promptChanges ? { system: systemPrompt } : {}),
});
console.log(`\nDone. Agent is now version ${updated.version}. New requests can report calls.`);
