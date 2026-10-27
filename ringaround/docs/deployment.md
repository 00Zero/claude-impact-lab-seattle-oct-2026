# Deployment

The site runs on Cloudflare Workers at https://ringaround.me, built with [OpenNext for Cloudflare](https://opennext.js.org/cloudflare). `.github/workflows/deploy.yml` deploys it:

- **Push to `main`** deploys production (Worker `ringaround`, custom domain `ringaround.me`).
- **Open or update a PR** deploys a preview Worker `ringaround-preview-pr-<number>` on workers.dev and comments the URL on the PR.
- **Close or merge the PR** deletes that preview.

Worker names, the custom domain, and the R2 cache buckets are configured in `wrangler.jsonc`.

## One-time CI setup

Everything lives on the `prod` GitHub Environment (Settings → Environments → prod):

| Name | Kind | Purpose |
| --- | --- | --- |
| `CF_API_TOKEN` | secret | Cloudflare API token with Workers Scripts edit, Workers R2 Storage edit and D1 edit on the account, plus Workers Routes edit and DNS edit on the `ringaround.me` zone (for the custom domain) |
| `CF_ACCOUNT_ID` | variable | Cloudflare account ID |
| `CF_S3_ACCESS_KEY_ID` | variable | R2 S3 API access key, used to upload the incremental cache |
| `CF_S3_SECRET_ACCESS_KEY` | secret | Its secret key |
| `AUTH_SECRET` | secret | Session encryption key, from `openssl rand -base64 32`. Keep it stable: changing it signs everyone out |
| `GOOGLE_AUTH_ID` | variable | Google OAuth client ID |
| `GOOGLE_AUTH_SECRET` | secret | Google OAuth client secret |
| `CLAUDE_API_KEY` | secret | Anthropic API key used to start agent sessions |
| `CLAUDE_AGENT_ID` | variable | Managed Agents agent that runs each request |
| `CLAUDE_ENVIRONMENT_ID` | variable | Environment its sessions run in |
| `CLAUDE_VAULT_ID` | variable | Vault holding the credentials the agent's tools need |
| `ALLOWED_EMAILS` | variable | Google accounts allowed to start calls, comma separated |
| `MCP_TOKEN` | secret | Bearer token the agent presents to `/api/mcp` to report calls. The same value is stored in the agent's vault |

When all four `CLAUDE_*` values and `ALLOWED_EMAILS` are set, each production deploy uploads them to the Worker. Only signed-in accounts on the list get **Find providers**, which starts the agent; everyone else gets **Send request**, which goes to checkout or account review as before, and the server rejects their sessions regardless. An empty or missing list lets nobody call. To change the list, edit the variable and redeploy. Previews never get them, so a preview can't place real calls. Each request's session is capped at $2 of list-price spend (`SESSION_BUDGET_CENTS` in `lib/agent.js`); a session that hits the cap pauses.

### The agent's skill

`skills/ringaround/SKILL.md` is the skill the calling agent works from. Each production deploy runs `scripts/deploy-skill.mjs`, which uploads it as a new version through the Skills API and pins that version on the agent named by `CLAUDE_AGENT_ID`, so requests started after the deploy use the skill from that commit. The agent's metadata records the file's hash, so a deploy that doesn't change the file uploads nothing. Redeploying an older commit uploads its copy, which rolls the skill back with the code. Previews never touch the agent. To check what a deploy would do, run `node --env-file=.env.local scripts/deploy-skill.mjs`; add `--apply` to make the change from your machine.

When `AUTH_SECRET`, `GOOGLE_AUTH_ID` and `GOOGLE_AUTH_SECRET` are all set, each production deploy uploads them to the Worker as `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, the names `auth.js` reads.

The `ringaround.me` zone must be in the same Cloudflare account. The workflow creates the R2 buckets `ringaround-opennext-cache` and `ringaround-preview-opennext-cache` on first deploy if they don't exist yet.

### Google sign-in in production

`AUTH_URL` is set to `https://ringaround.me` in `wrangler.jsonc`. The three credentials can either go on the `prod` environment (above) or straight onto the Worker under the names `auth.js` reads:

```sh
npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_GOOGLE_ID
npx wrangler secret put AUTH_GOOGLE_SECRET
```

In Google Cloud Console, add `https://ringaround.me` as an authorized JavaScript origin and `https://ringaround.me/api/auth/callback/google` as a redirect URI. Previews have no OAuth credentials, so sign-in shows as unavailable there.

## User data (D1)

Profiles, saved addresses, account applications and the list of sent requests live in Cloudflare D1, bound as `DB`:

- `ringaround`: production
- `ringaround-preview`: shared by every PR preview, so PR code never touches real user data

The schema is in `migrations/`, and each deploy applies pending migrations before publishing the Worker. Because the old Worker keeps serving while a migration runs, migrations must be additive: add columns and tables, and don't rename or drop ones the current code still uses. To add one, run `npx wrangler d1 migrations create DB <name>`.

Unsent form drafts and the theme choice stay in the browser, since they belong to one device. Profiles, addresses and applications that older versions kept in the browser are moved to D1 the first time a user visits after this change.

For `npm run dev`, create the local tables once with `npm run db:migrate:local`.

## Call tracking

The calling agent reports each business it contacts to `https://ringaround.me/api/mcp`, an MCP server with one tool, `report_call`. Each request's brief includes its reference (`req_…`), and the tool records the business, status (queued, calling, quoted, retry, declined) and a one-line detail in the `provider_calls` table. The request pages show those rows. The tool also enforces each request's call cap (5): the first call past it is refused, and the agent is told not to dial.

Only the agent can call the endpoint: it presents `MCP_TOKEN`, which lives in its vault as a bearer credential. Each production deploy runs `scripts/connect-agent.mjs --apply` with the `prod` secrets, so the agent's MCP server, vault token and system prompt follow the repo. To preview or run it by hand, fill in `.env.local` and run:

```sh
node --env-file=.env.local scripts/connect-agent.mjs          # shows what would change
node --env-file=.env.local scripts/connect-agent.mjs --apply
```

The script adds the MCP server and its toolset (set to `always_allow`, so reports never pause the agent), stores the token in the vault, and sets the agent's system prompt to `agent/system-prompt.md`. Change the prompt by editing that file and re-running the script, not in the Console, or the next run will overwrite the Console edit. The agent's other tools are left unchanged.

## Running the Workers build locally

```sh
npm run preview   # opennextjs-cloudflare build, then serve it in workerd
npm run deploy    # build and deploy production from your machine (needs `wrangler login`)
```

`npm run dev` is still plain `next dev`.

## Cache Components are off

`cacheComponents` (and `partialPrefetching`, which depends on it) are disabled in `next.config.mjs`. With them on, every page hangs in the Workers runtime under OpenNext 1.20 and returns a 500. Nothing in the app uses `"use cache"` yet. Before turning them back on, run `npm run preview` and confirm that pages load.
