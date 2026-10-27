import { getCloudflareContext } from "@opennextjs/cloudflare";

// Server-only: the D1 database bound as `DB` in wrangler.jsonc. Every query
// here is scoped to the user ID the caller got from the session; nothing takes
// a user ID from the browser.

function db() {
  return getCloudflareContext().env.DB;
}

// --- Profile -----------------------------------------------------------------

export async function getProfile(userId) {
  const row = await db()
    .prepare("SELECT name, phone, company, default_address FROM profiles WHERE user_id = ?")
    .bind(userId)
    .first();
  return row ? { name: row.name, phone: row.phone, company: row.company, defaultAddress: row.default_address } : null;
}

export async function saveProfile(userId, profile) {
  await db()
    .prepare(
      `INSERT INTO profiles (user_id, name, phone, company, default_address) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET name = excluded.name, phone = excluded.phone, company = excluded.company,
         default_address = excluded.default_address, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(userId, profile.name, profile.phone, profile.company, profile.defaultAddress)
    .run();
}

// --- Saved locations ---------------------------------------------------------

const toLocation = (row) => ({ id: row.id, label: row.label, address: row.address, timeZone: row.time_zone ?? undefined, isDefault: false });

export async function listLocations(userId) {
  const { results } = await db()
    .prepare("SELECT id, label, address, time_zone FROM saved_locations WHERE user_id = ? ORDER BY created_at")
    .bind(userId)
    .all();
  return results.map(toLocation);
}

// Saves an address the first time it's used; an address the user already has
// (ignoring case) comes back as the existing row.
export async function addLocation(userId, { label, address, timeZone }) {
  const id = `loc_${crypto.randomUUID().replaceAll("-", "")}`;
  await db()
    .prepare(
      `INSERT INTO saved_locations (id, user_id, label, address, time_zone) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
    )
    .bind(id, userId, label, address, timeZone ?? null)
    .run();
  const row = await db()
    .prepare("SELECT id, label, address, time_zone FROM saved_locations WHERE user_id = ? AND address = ? COLLATE NOCASE")
    .bind(userId, address)
    .first();
  return toLocation(row);
}

// --- Account application -----------------------------------------------------

export async function getApplication(userId) {
  const row = await db()
    .prepare("SELECT name, email, company, role, plan, submitted_at FROM account_applications WHERE user_id = ?")
    .bind(userId)
    .first();
  return row
    ? { name: row.name, email: row.email, company: row.company, role: row.role, plan: row.plan, submittedAt: row.submitted_at }
    : null;
}

export async function saveApplication(userId, application) {
  await db()
    .prepare(
      `INSERT INTO account_applications (user_id, name, email, company, role, plan) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET name = excluded.name, email = excluded.email, company = excluded.company,
         role = excluded.role, plan = excluded.plan, submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(userId, application.name, application.email, application.company, application.role, application.plan)
    .run();
}

// --- Requests ----------------------------------------------------------------

export async function recordRequest(userId, { sessionId, ref, title, whereText, whenText, budgetText, callCap }) {
  await db()
    .prepare(
      `INSERT INTO requests (session_id, user_id, title, ref, where_text, when_text, budget_text, call_cap)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (session_id) DO NOTHING`,
    )
    .bind(sessionId, userId, title, ref, whereText, whenText, budgetText, callCap)
    .run();
}

const REQUEST_COLUMNS = `r.session_id, r.title, r.created_at, r.where_text, r.when_text, r.budget_text, r.call_cap,
  (SELECT count(*) FROM provider_calls c WHERE c.session_id = r.session_id AND c.called_at IS NOT NULL) AS calls_placed,
  (SELECT count(*) FROM provider_calls c WHERE c.session_id = r.session_id AND c.status = 'quoted') AS quotes`;

const toRequest = (row) => ({
  sessionId: row.session_id,
  title: row.title,
  createdAt: row.created_at,
  where: row.where_text,
  when: row.when_text,
  budget: row.budget_text,
  callCap: row.call_cap,
  callsPlaced: row.calls_placed,
  quotes: row.quotes,
});

export async function listRequests(userId, limit) {
  const { results } = await db()
    .prepare(`SELECT ${REQUEST_COLUMNS} FROM requests r WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT ?`)
    .bind(userId, limit)
    .all();
  return results.map(toRequest);
}

// The user's request, or null when it isn't theirs (or predates this table).
export async function getRequest(userId, sessionId) {
  const row = await db()
    .prepare(`SELECT ${REQUEST_COLUMNS} FROM requests r WHERE r.user_id = ? AND r.session_id = ?`)
    .bind(userId, sessionId)
    .first();
  return row ? toRequest(row) : null;
}

export async function hasRequests(userId) {
  return Boolean(await db().prepare("SELECT 1 AS found FROM requests WHERE user_id = ? LIMIT 1").bind(userId).first());
}

// --- Provider calls ----------------------------------------------------------

export const CALL_STATUSES = ["queued", "calling", "quoted", "retry", "declined"];

export async function listProviderCalls(sessionId) {
  const { results } = await db()
    .prepare(
      `SELECT id, business, phone, status, detail, called_at, updated_at FROM provider_calls
       WHERE session_id = ? ORDER BY created_at`,
    )
    .bind(sessionId)
    .all();
  return results.map((row) => ({
    id: row.id,
    business: row.business,
    phone: row.phone,
    status: row.status,
    detail: row.detail,
    calledAt: row.called_at,
    updatedAt: row.updated_at,
  }));
}

// Records the agent's latest word on one business for a request. Any status
// other than "queued" means the business has been called, which counts against
// the request's cap: a first call past the cap is refused, so the agent hears
// "stop" from us rather than relying on its own count. Two reports racing for
// the last slot could both pass; the agent reports one call at a time.
// Returns { callsPlaced, callCap } or { error }.
export async function reportProviderCall(ref, { business, phone, status, detail }) {
  const request = await db()
    .prepare("SELECT session_id, call_cap FROM requests WHERE ref = ?")
    .bind(ref)
    .first();
  if (!request) return { error: `No request with reference ${ref}.` };
  const { session_id: sessionId, call_cap: callCap } = request;

  const existing = await db()
    .prepare("SELECT id, called_at FROM provider_calls WHERE session_id = ? AND business = ? COLLATE NOCASE")
    .bind(sessionId, business)
    .first();
  const placesCall = status !== "queued" && !existing?.called_at;
  const placed = await db()
    .prepare("SELECT count(*) AS n FROM provider_calls WHERE session_id = ? AND called_at IS NOT NULL")
    .bind(sessionId)
    .first("n");
  if (placesCall && placed >= callCap) {
    return { error: `Call cap reached: ${placed} of ${callCap} calls placed. Don't call ${business}; report what you have.` };
  }

  const now = new Date().toISOString();
  if (existing) {
    await db()
      .prepare(
        `UPDATE provider_calls SET status = ?, detail = ?, phone = coalesce(?, phone),
           called_at = coalesce(called_at, ?), updated_at = ? WHERE id = ?`,
      )
      .bind(status, detail, phone ?? null, placesCall ? now : null, now, existing.id)
      .run();
  } else {
    await db()
      .prepare(
        `INSERT INTO provider_calls (id, session_id, business, phone, status, detail, called_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(`call_${crypto.randomUUID().replaceAll("-", "")}`, sessionId, business, phone ?? null, status, detail, placesCall ? now : null, now)
      .run();
  }
  return { callsPlaced: placed + (placesCall ? 1 : 0), callCap };
}
