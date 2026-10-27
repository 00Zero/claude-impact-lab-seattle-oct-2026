// Uploads the calling agent's skill (skills/ringaround/SKILL.md) through the
// Skills API and pins that version on the agent. Production deploys run this;
// previews never do, since they share the one agent.
//
//   node --env-file=.env.local scripts/deploy-skill.mjs            # dry run: show what would change
//   node --env-file=.env.local scripts/deploy-skill.mjs --apply    # make the changes
//
// Needs CLAUDE_API_KEY and CLAUDE_AGENT_ID. Safe to run on every deploy: the
// agent's metadata records the hash of the SKILL.md it runs, and an unchanged
// file uploads nothing. Deploying an older commit uploads its SKILL.md as a new
// version, so a rollback rolls the skill back too.
//
// The agent's other skills, tools, model and system prompt are left as they are.

import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// The SKILL.md frontmatter `name`. The API fixes it when the skill is first
// created, and every later version must keep it.
const SKILL_NAME = "ringaround";
const SKILL_PATH = `skills/${SKILL_NAME}/SKILL.md`;
const HASH_KEY = `${SKILL_NAME}_skill_sha256`;
const apply = process.argv.includes("--apply");

for (const name of ["CLAUDE_API_KEY", "CLAUDE_AGENT_ID"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Add it to .env.local.`);
    process.exit(1);
  }
}

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const agentId = process.env.CLAUDE_AGENT_ID;

const content = await readFile(SKILL_PATH);
const sha = createHash("sha256").update(content).digest("hex");

const agent = await client.beta.agents.retrieve(agentId);
console.log(`Agent ${agent.id} "${agent.name}", version ${agent.version}`);
console.log(`  skills: ${agent.skills.map((s) => `${s.type}:${s.skill_id}@${s.version}`).join(", ") || "none"}`);

if (agent.metadata[HASH_KEY] === sha) {
  console.log(`\n${SKILL_PATH} is unchanged (sha256 ${sha.slice(0, 12)}). Nothing to do.`);
  process.exit(0);
}

// Found by name rather than a stored ID, so a run that uploaded but then failed
// to update the agent is picked up next time instead of creating a second skill.
let skill = null;
for await (const candidate of client.skills.list({ source: "custom" })) {
  if (candidate.display_name === SKILL_NAME) {
    skill = candidate;
    break;
  }
}

console.log(`\nWill upload ${SKILL_PATH} (sha256 ${sha.slice(0, 12)}) as ${skill ? `a new version of ${skill.id}` : `a new skill "${SKILL_NAME}"`}`);
console.log(`Will pin that version on the agent`);
if (!apply) {
  console.log("\nDry run: nothing changed. Re-run with --apply.");
  process.exit(0);
}

// The file name carries the directory: a skill upload must sit in one top-level folder.
const files = [await toFile(content, `${SKILL_NAME}/SKILL.md`, { type: "text/markdown" })];
let versionId;
if (skill) {
  versionId = (await client.skills.versions.create(skill.id, { files })).id;
} else {
  skill = await client.skills.create({ files });
  versionId = skill.latest_version_id;
}
console.log(`Uploaded ${skill.id} version ${versionId}`);

const skills = [
  ...agent.skills.filter((s) => !(s.type === "custom" && s.skill_id === skill.id)),
  { type: "custom", skill_id: skill.id, version: versionId },
];
// `version` makes this fail rather than overwrite if the agent changed since we read it.
const updated = await client.beta.agents.update(agentId, {
  version: agent.version,
  skills,
  metadata: { [HASH_KEY]: sha },
});
console.log(`\nDone. Agent is now version ${updated.version}. New requests use this skill.`);
