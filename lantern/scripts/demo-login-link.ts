// Prints a one-time sign-in link for a family email WITHOUT sending any email.
// Demo workaround for when Auth email delivery isn't working (the link is a
// working login for that account -- don't paste it anywhere shared).
//
// Usage: npm run demo:link -- family@example.com [origin]
//   1. Open the case's /invite/<token> page first (it stashes the invite token
//      in this browser).
//   2. Run this, open the printed link in the SAME browser.
// origin defaults to the deployed site; use http://localhost:5173 for local dev.
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const DEFAULT_ORIGIN = 'https://nice-smoke-09ad41d1e.6.azurestaticapps.net'

function loadEnv(): void {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')
  let contents: string
  try {
    contents = readFileSync(envPath, 'utf8')
  } catch {
    return
  }
  for (const line of contents.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

async function main() {
  loadEnv()
  const [email, origin = DEFAULT_ORIGIN] = process.argv.slice(2)
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!email || !url || !key) {
    console.error('Usage: npm run demo:link -- <email> [origin]  (needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env)')
    process.exit(1)
  }

  const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'magiclink',
      email,
      data: { role: 'family' },
      redirect_to: `${origin}/case`,
    }),
  })
  const body = (await res.json()) as { action_link?: string; msg?: string }
  if (!res.ok || !body.action_link) {
    console.error('Failed:', res.status, body.msg ?? JSON.stringify(body))
    process.exit(1)
  }
  console.log(`Sign-in link for ${email} (single use, ~1h):\n\n${body.action_link}\n`)
}

main()
