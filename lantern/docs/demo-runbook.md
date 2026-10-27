# Milestone 1 demo runbook

Covers the six-step demo script from `docs/spec.md`'s "Milestone 1 — demo script"
section. Hospital staff sign in at `/hospital/login` with an email + password (demo accounts are
created in the Supabase dashboard; family sign-in still uses magic links).

**Demo hospital login:** `demo.hospital@agenticlantern.test` / `Lantern-Demo-2026!` — also
shown directly on the `/hospital/login` page itself so judges can log in without asking. Not
a secret (it's displayed on a public page by design); if it ever needs rotating, set a new
password via the Supabase dashboard → Authentication → Users, then update both this file and
`src/pages/HospitalLogin.tsx`'s demo-credentials box.

## Before the demo

- `OPENROUTER_API_KEY` is already set as a Supabase secret (verify with `npx supabase
  secrets list`; set with `npx supabase secrets set OPENROUTER_API_KEY=...` if lost).
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` need no setup, they're auto-injected into
  every Edge Function. Without the OpenRouter key, steps 2 and 5 below will not produce
  real data — `parse-intake`/`recommend` deploy fine but every invocation throws
  immediately.
- **Fallback if the secret isn't set in time:** `/demo` on the deployed site
  (`src/pages/Demo.tsx`) is a fully static walkthrough using canned sample data
  (`src/lib/demoData.ts`) — no sign-in, no Functions, nothing can fail live. Narrates
  the same flow and shows the same kind of ranked-recommendations-with-rationale
  output. Use this as the whole demo, or as a backup to cut to if a live step stalls.

## Live walkthrough (steps 1–5, hospital path)

1. **Hospital uploads a PDF.** Go to `/hospital/login`, sign in with the demo hospital
   email and password. From the dashboard, click "New
   case," enter a family email you also control (so you can act as the family in
   step 4), and upload `fixtures/sample-pdfs/01-hospital-medical-cert-wa.pdf` — a
   clean, filled WA-style medical certificate for the fictional decedent Eleanor
   Marie Whitfield.

2. **Show the parsed fields.** `parse-intake` fires automatically after the upload
   (fire-and-forget — give it a few seconds). On the new case's detail page
   (`/hospital/cases/:id`), the "Parsed fields" table shows each extracted field with
   its confidence score — the proof point that this is a real model call, not
   hardcoded data. If it's still showing "PDF not parsed yet" after ~10 seconds, use
   the "Re-check / retry parsing" button rather than re-uploading.

3. **Show the invite link.** Same page, "Invite link" card — the link is just
   displayed on screen (per spec, email sending is descoped for M1). Use "Copy link".

4. **Switch to the family view.** Open the invite link in a new private/incognito
   window (so it doesn't reuse the hospital session), sign in with the same family
   email from step 1, and confirm the magic link locks to that email. Land on the
   confirmation screen — the hospital-provided fields should be pre-filled, with
   anything below 0.7 confidence flagged "please check." Pick a disposition
   (burial/cremation/unsure) and confirm.

5. **Show the recommendations.** This triggers `recommend` (same fire-and-forget
   pattern) and lands on the waiting screen, which polls every 6s. Once
   `cases.status` flips to `recommendations_ready`, a ranked list of 3–5 funeral
   homes appears with name, county, price, rating, and a rationale sentence per pick.
   If it's stuck past ~60s, the waiting screen itself surfaces a "try again" option —
   narrate that as the built-in failure handling (T7.1) rather than treating it as a
   demo failure.

## Self-serve path (step 6, separate from the hospital flow above)

6. Go to `/start` directly (no invite). Walk through the five-step wizard —
   name, date of death, home zip, disposition, your relationship. It starts an
   anonymous session and lands straight on `/case` showing the same waiting →
   recommendations flow as step 5, with no password or email.

## Fixtures reference

- `01-hospital-medical-cert-wa.pdf` — clean parse, use for step 1.
- `03-non-death-lab-report.pdf` — unrelated document; use this instead of
  `01-...` if you want to show the graceful-degradation path (every field comes back
  null, case still proceeds to the confirmation screen with blank fields instead of
  failing). There's no scanned/non-text PDF fixture to demo an actual OCR failure —
  OCR for scanned PDFs is explicitly out of scope for M1 (see spec's "Explicitly out
  of scope"), so there's nothing to show there.
- `01b-hospital-medical-cert-indian-form-no4.pdf` / `02-wa-death-certificate-worksheet.pdf`
  — not used in this script; see `docs/milestone-1-tasks.md`'s fixtures section for
  what they're for.
