// RLS regression tests (T0.3's outstanding acceptance criterion). Creates
// throwaway auth users via the admin API, exercises them against the real
// RLS policies with their own sessions (not the service-role client), and
// deletes everything it created afterward.
//
// Usage: npm run test:rls
// Requires SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY and
// VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY in .env.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env')
  let contents: string
  try {
    contents = readFileSync(envPath, 'utf8')
  } catch {
    return
  }
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env) && value) process.env[key] = value
  }
}

loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PUBLISHABLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY in .env')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

let failures = 0
function check(label: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${label}`)
  if (!condition) failures++
}

const RUN_ID = Math.random().toString(36).slice(2, 10)
const createdUserIds: string[] = []
const createdCaseIds: string[] = []

// Supabase's email-OTP flow has no password to grant a session with
// directly in a script -- generateLink + verifyOtp with the anon client is
// the standard way to mint a real, RLS-bound session for a throwaway test user.
async function sessionClientFor(email: string, role: 'hospital' | 'family'): Promise<SupabaseClient> {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role },
  })
  if (createErr || !created.user) throw createErr ?? new Error('createUser returned no user')
  createdUserIds.push(created.user.id)

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr) throw linkErr

  const client = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!)
  const { error: verifyErr } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyErr) throw verifyErr

  return client
}

async function main() {
  console.log(`Run id: ${RUN_ID}\n`)

  const hospitalA = await sessionClientFor(`rls-test-hospital-a-${RUN_ID}@example.com`, 'hospital')
  const hospitalB = await sessionClientFor(`rls-test-hospital-b-${RUN_ID}@example.com`, 'hospital')
  const familyA = await sessionClientFor(`rls-test-family-a-${RUN_ID}@example.com`, 'family')
  const familyC = await sessionClientFor(`rls-test-family-c-${RUN_ID}@example.com`, 'family') // unrelated to any case

  const { data: hospitalAUser } = await hospitalA.auth.getUser()
  const { data: familyAUser } = await familyA.auth.getUser()

  // --- cases: ownership-scoped insert/select ---------------------------------
  const { data: caseA, error: caseAErr } = await hospitalA
    .from('cases')
    .insert({ source: 'hospital', status: 'pending_review', hospital_id: hospitalAUser.user!.id, family_contact_email: 'family-a@example.com' })
    .select()
    .single()
  check('hospital A can create its own case', !caseAErr && !!caseA)
  if (caseA) createdCaseIds.push(caseA.id)

  const { error: wrongOwnerErr } = await hospitalA
    .from('cases')
    .insert({ source: 'hospital', status: 'pending_review', hospital_id: hospitalAUser.user!.id, family_user_id: familyAUser.user!.id, family_contact_email: 'x@example.com' })
  check('hospital cannot insert a case with family_user_id already set (insert policy check)', !!wrongOwnerErr)

  const { data: hospitalBSeesA } = await hospitalB.from('cases').select('*').eq('id', caseA!.id)
  check("hospital B cannot see hospital A's case", (hospitalBSeesA ?? []).length === 0)

  const { data: familyCSeesA } = await familyC.from('cases').select('*').eq('id', caseA!.id)
  check("an unrelated family user cannot see hospital A's case", (familyCSeesA ?? []).length === 0)

  // Link case A to family A (normally done via redeem_invite_token; doing the
  // column update directly here since we're testing cases/recommendations
  // policies, not the invite-redemption function itself).
  await admin.from('cases').update({ family_user_id: familyAUser.user!.id }).eq('id', caseA!.id)

  const { data: familyASeesOwnCase } = await familyA.from('cases').select('*').eq('id', caseA!.id)
  check('family A can see its own linked case', (familyASeesOwnCase ?? []).length === 1)

  // --- recommendations: select-only, case-ownership-scoped --------------------
  const { data: home } = await admin.from('funeral_homes').select('id').limit(1).single()
  const { data: rec } = await admin
    .from('recommendations')
    .insert({ case_id: caseA!.id, funeral_home_id: home!.id, rank: 1, rationale: 'rls test fixture' })
    .select()
    .single()

  const { error: clientInsertRecErr } = await hospitalA
    .from('recommendations')
    .insert({ case_id: caseA!.id, funeral_home_id: home!.id, rank: 2, rationale: 'should be blocked' })
  check('hospital cannot insert recommendations directly (service-role only)', !!clientInsertRecErr)

  const { data: hospitalBSeesRec } = await hospitalB.from('recommendations').select('*').eq('case_id', caseA!.id)
  check("hospital B cannot read family A's case recommendations", (hospitalBSeesRec ?? []).length === 0)

  const { data: familyASeesRec } = await familyA.from('recommendations').select('*').eq('case_id', caseA!.id)
  check('family A can read its own case recommendations', (familyASeesRec ?? []).length === 1)

  // --- invite_tokens: scoped SELECT for the owning hospital only (added by
  // the T1.5 migration so CaseDetail.tsx can show the link it just minted),
  // never a bare/unscoped policy that would let any user enumerate tokens --
  const { data: inviteToken } = await admin
    .from('invite_tokens')
    .insert({ case_id: caseA!.id, contact_email: 'family-a@example.com' })
    .select()
    .single()

  const { data: hospitalASeesToken } = await hospitalA.from('invite_tokens').select('*').eq('case_id', caseA!.id)
  check("hospital A can SELECT its own case's invite_tokens (scoped policy, T1.5)", (hospitalASeesToken ?? []).length === 1)

  const { data: hospitalBSeesToken } = await hospitalB.from('invite_tokens').select('*').eq('case_id', caseA!.id)
  check("hospital B cannot SELECT hospital A's invite_tokens (scope, not enumerable)", (hospitalBSeesToken ?? []).length === 0)

  const { data: familyASeesToken } = await familyA.from('invite_tokens').select('*').eq('case_id', caseA!.id)
  check('family role has no SELECT access to invite_tokens at all (policy only covers hospital_id)', (familyASeesToken ?? []).length === 0)

  const { data: lookupValid } = await hospitalA.rpc('invite_token_lookup', { p_token: inviteToken!.token }).maybeSingle()
  check(
    'invite_token_lookup RPC still works for a valid token (the sanctioned anon-callable read path)',
    (lookupValid as { valid: boolean } | null)?.valid === true,
  )

  // A garbage token matches zero rows in the underlying query, so the RPC
  // returns no rows at all rather than a {valid: false} row -- InvitePage.tsx
  // already treats "error or no data" as invalid for exactly this reason.
  const { data: lookupInvalid, error: lookupInvalidErr } = await hospitalA
    .rpc('invite_token_lookup', { p_token: 'not-a-real-token' })
    .maybeSingle()
  check(
    'invite_token_lookup returns no usable row for a garbage token (no existence leak)',
    !!lookupInvalidErr || !lookupInvalid || (lookupInvalid as { valid: boolean }).valid === false,
  )

  // --- funeral_homes: public read ----------------------------------------------
  const anonClient = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!)
  const { data: anonHomes, error: anonHomesErr } = await anonClient.from('funeral_homes').select('id').limit(1)
  check('funeral_homes is readable by a signed-out (anon) client', !anonHomesErr && (anonHomes ?? []).length === 1)

  // --- cleanup ------------------------------------------------------------------
  if (rec) await admin.from('recommendations').delete().eq('id', rec.id)
  for (const id of createdCaseIds) await admin.from('cases').delete().eq('id', id)
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id)

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error('Test run crashed:', err)
  // Best-effort cleanup even on a thrown error, so a failed run doesn't leave fixtures behind.
  for (const id of createdCaseIds) await admin.from('cases').delete().eq('id', id)
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id)
  process.exit(1)
})
