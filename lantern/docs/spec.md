# AgenticLantern — Milestone 1 Spec (Hackathon)

## One-liner
When a death occurs, a hospital (or the family directly) starts a case. An AI agent reads
the intake context and recommends funeral homes to the family member who then signs up
through a dedicated link.

## Actors
- **Hospital user** — logs into a hospital portal, uploads a PDF document for a patient
  who has passed away, and the family contact's email for the family member to notify.
- **Family member** — either (a) receives a magic link/invite from a hospital-initiated
  case, or (b) signs up directly without any hospital involvement and answers a short,
  minimal-question wizard themselves.
- **AI agent** — reads the intake context (parsed from the hospital's PDF, or from the
  family's short-form answers) and produces a ranked shortlist of funeral home
  recommendations.

Two entry paths, same downstream pipeline:

```
Hospital flow:
  Hospital login -> upload PDF -> system parses PDF into structured Case fields
    -> creates Case + invite token -> notifies family contact (email) with link
    -> family opens link -> signs up/logs in -> reviews/confirms parsed context
    -> agent recommends funeral homes

Self-serve flow:
  Family signs up directly (no invite token) -> answers a short question wizard
    -> agent recommends funeral homes
```

Both paths converge on the same `Case` record and the same recommendation step. The
hospital path front-loads a document-parsing step; the self-serve path skips straight to
a lightweight structured answer set because there's no document to parse.

## Core entities

- **HospitalAccount** — login for hospital staff. Hackathon: single shared login or a
  couple of seeded hospital accounts, no real hospital integration/SSO.
- **Case** — one deceased person + intake context, regardless of which path produced it.
  Fields:
  - Decedent: legal name (first, middle, last), sex, date of birth, age at death,
    date of death, time of death (optional), place of death (facility name, facility
    city/state/zip), residence (street, city, state, zip, county). Cause of death,
    manner of death, and SSN are intentionally excluded — see Resolved questions.
  - Place of death type: `inpatient` | `emergency` | `dead_on_arrival` | `hospice` |
    `nursing_home` | `decedent_home` | `other` (self-serve: asked only if needed — defaults
    to `unknown`, see Open questions)
  - Disposition preference: burial or cremation, or unsure
  - Family contact: name, email (required — this is the only contact channel; it's used
    for the invite/magic link and for auth), relationship to decedent (e.g. spouse, son,
    daughter, other)
  - Location (zip/county) — drives which funeral homes are eligible
  - `source`: `hospital` | `self_serve`
  - `status`: `pending_review` | `active` | `recommendations_ready`
- **IntakeDocument** — the raw PDF the hospital uploaded (stored as-is) plus the
  structured fields an LLM parse extracted from it, each field tagged with a confidence
  level. Only exists for `source=hospital` cases. If the parse produces no usable fields
  at all (corrupted file, non-text/scanned PDF, a document unrelated to a death), the
  Case is still created with every field blank rather than failing the upload — see
  Flow 1.
- **InviteToken** — one-time use, expires 24 hours after creation, tied to a Case,
  created only on the hospital flow. Besides gating signup/login for that specific Case,
  it pins the signup to the contact email the hospital entered — a family member cannot
  complete signup through the link with a different email address. If it expires before
  use, hospital staff resend it, which mints a fresh token (new 24-hour window) and
  invalidates the old one.
- **FamilyUser** — login for the family member. Created at signup, linked 1:1 to a Case
  (hackathon simplification — real product would allow multiple family members per case).
- **FuneralHome** — an existing, pre-compiled dataset covering all licensed funeral homes
  in Washington State: name, address/county, phone, cremation/burial capability, pricing,
  and rating. No religious/cultural capability tags are tracked (see Resolved questions).
- **Recommendation** — ranked list of FuneralHome records for a Case, with a short
  rationale per match ("12 min away, cremation from $X, highly rated").

## Flows in detail

### 1. Hospital upload (PDF)
- Hospital logs in, selects "New case."
- Uploads a PDF (the actual document a hospital would produce when a death occurs — e.g.
  a discharge/death paperwork packet). Hackathon: a handful of realistic sample PDFs,
  hand-authored or lightly redacted, checked into the repo as test fixtures. Upload is
  validated client-side — must be `application/pdf`, capped at 10MB — and anything else
  is rejected with an inline error before it reaches the parser.
- Hospital enters the family contact's email (required).
- System runs one LLM parse call over the PDF text to extract the Case fields above, each
  tagged with a confidence score; low-confidence fields are left blank rather than
  guessed. Parse targets for Milestone 1 (from the hospital medical certification form):
  - Decedent: legal name, sex, date of birth, age at death, date of death, time of
    death, facility name, ward (stored, not shown to family), county of death if printed
  - Residence: street, city, state, zip, county, if printed
  - Relative/certificate block: "S/W/D of" (parent/spouse named on the certificate),
    date admitted, date expired
  - Not extracted: cause of death (all Part I/Part II entries), manner of death, pregnancy
    fields, certifying physician name and license number. The parser must not return
    these keys even at low confidence. If the parse returns no usable fields at all, the Case is still created with
  everything blank — the family's confirmation screen in Flow 2 becomes the place those
  fields get filled in from scratch, rather than the upload failing outright.
- System creates the Case (`source=hospital`, `status=pending_review`) + an InviteToken
  (one-time use, expires in 24 hours), and sends the contact a link: `/invite/{token}`.

### 2. Family via invite link
- Family member opens `/invite/{token}`.
- If the token is valid, unused, and not expired: show a magic-link email sign-in, with
  the email field pre-filled to the contact email the hospital entered and locked (not
  editable) — this is what ties the signup to the intended family member rather than
  whoever has the link. They click the link sent to that inbox — no password to create or
  remember.
- If the token has expired or was already used: show a message directing them to contact
  the hospital for a new invite.
- On success: FamilyUser is created/linked, Case is attached to this FamilyUser.
- Family sees the parsed context from the hospital's PDF as an editable confirmation
  screen ("Here's what we have — anything to add or correct?"), since PDF parsing can
  miss or misread fields (and, per Flow 1, may be entirely blank if parsing failed).
  Confirming moves `status -> active`.

### 3. Family self-serve (no hospital)
- Family signs up directly from the homepage (no token, no PDF).
- They answer a short wizard instead of a long form. The Case cannot exist without the
  decedent and the family contact, so the wizard asks:
  1. Decedent legal name (first, last; middle optional)
  2. Date of death
  3. Location (zip code)
  4. Burial, cremation, or not sure
  5. Family contact name and relationship to decedent
  6. Email (required — this is also how they sign in, via magic link; no password)
- Not asked in M1 (left blank, filled later on the funeral home worksheet): sex, age,
  residence street, place of death type, facility. See "Template field gaps" below.
- Case is created with `source=self_serve`, `status=active` immediately (no review step,
  since there's no parsed document to double-check).

### 4. AI agent recommendation
- Triggered once a Case reaches `status=active` (post-confirmation for hospital path,
  immediately for self-serve path).
- Agent filters the FuneralHome dataset by location and disposition capability, then asks
  an LLM to rank and write a one-line rationale per match. Since the dataset covers every
  licensed funeral home in WA state rather than a small hand-picked list, the location
  filter narrows to the same/nearby county before ranking, so the LLM is never asked to
  rank more than a manageable candidate set (e.g., capped at ~15–20).
- If the filter returns zero funeral homes for a given location/disposition combination,
  Milestone 1 has no fallback — the recommendation screen may come back empty. Accepted
  as a known limitation for now (see Explicitly out of scope).
- Case `status -> recommendations_ready`; family sees a ranked shortlist with name,
  distance, price, and rationale.

## Tech stack
- **Frontend:** React (Vite), a static SPA — hospital login/dashboard + PDF upload,
  invite landing page, family login/signup, confirmation screen (hospital path), question
  wizard (self-serve path), recommendations view. Hosted on **Azure Static Web Apps**.
- **Backend:** no general-purpose API server. Auth and all Case/FuneralHome DB reads and
  writes go straight from the React app to Supabase via its client SDK and Row-Level
  Security — nothing custom to build there. The only server-side code is two small
  **Supabase Edge Functions** (`supabase/functions/`), for the two steps that need the
  OpenRouter API key kept off the client: PDF parsing and recommendation ranking.
- **DB:** Supabase (Postgres) — free tier. One `role: hospital | family` claim covers
  both login types.
- **Storage:** Supabase Storage, for the uploaded PDFs.
- **Auth:** Supabase Auth, called directly from the React app (magic-link email, no
  custom backend). The invite token is a separate short-lived (24-hour) record stored in
  Postgres, not an auth mechanism itself — it gates which Case a new FamilyUser gets
  attached to and pins the signup to the contact email already on file.
- **PDF parsing:** one LLM call per upload via **OpenRouter** (`google/gemini-3.8-flash`),
  run inside a Supabase Edge Function, with structured output (JSON Schema, derived from the same
  Zod schema as the Case fields) so the model cannot return fields outside the schema —
  no separate OCR pipeline needed for text-based PDFs (OpenRouter falls back to OCR
  automatically for ones that need it).
- **AI agent (recommendation):** a second Supabase Edge Function (via OpenRouter), one LLM call per Case: input =
  confirmed Case JSON + filtered (location + disposition, capped to a manageable
  candidate count) FuneralHome candidates; output = ranked list + rationale strings. No
  multi-agent orchestration needed at Milestone 1.
- **Funeral home data:** an existing, pre-compiled dataset covering all licensed funeral
  homes in Washington State — name, address/county, phone, cremation/burial capability,
  pricing, and rating — checked into the repo as JSON/CSV, loaded into Supabase. Not
  hand-curated for the demo and not live GPL scraping.
- **Secrets:** the OpenRouter API key lives only as a Supabase project secret
  (`supabase secrets set`), never in client code or the Supabase client config.

## Milestone 1 — demo script (what "done" looks like)
1. Hospital logs in, uploads a sample PDF for a demo patient, enters a family email.
2. Parsed fields + confidence are visible somewhere in the hospital or debug view (nice
   proof point for judges that it's really reading the PDF, not hardcoded).
3. Invite link is generated (can just be shown on screen for the demo instead of actually
   sending).
4. Open the invite link in a new session, sign up as the family member with the email
   locked to what the hospital entered, see the hospital-provided context pre-filled on a
   confirmation screen, confirm it.
5. See a ranked list of 3–5 recommended funeral homes with rationale.
6. Separately, demo the self-serve path: sign up with no invite, answer the 6-question
   wizard, get the same kind of recommendation list.

## Explicitly out of scope for Milestone 1
- Real hospital system integration/SSO.
- Live GPL scraping / calling funeral homes (Ntrust's price-discovery agent) — this repo
  uses the existing WA-state dataset instead.
- Multi-agent orchestration (vetting, negotiation, post-funeral checklist agents from
  Ntrust) — only the recommendation step exists here.
- Multiple family members per case, permissions/roles among family members.
- Payment, e-signature, or document generation (death certificates, permits).
- General-purpose document pipeline (scanned/handwritten PDFs, multi-page OCR edge cases)
  — Milestone 1 targets clean, text-based sample PDFs.
- Religious/cultural matching — not collected or matched on in Milestone 1 (see Resolved
  questions).
- Budget-based matching — not collected or matched on in Milestone 1 (see Resolved
  questions).
- Graceful handling when the location + disposition filter returns zero funeral homes —
  the recommendation screen may come back empty in that case; no fallback/widening logic
  for Milestone 1.

## Template field gaps (from the hospital and funeral home forms)
Source forms: the hospital's medical certification of cause of death (`fixtures/sample-pdfs/01-hospital-medical-cert-wa.pdf`) and the Washington State Death Certificate Worksheet (`Context/` image, filled by the funeral home). Each field is marked:
- **M1** — in the Case schema and used in M1 flows.
- **M2** — needed to fill the funeral home worksheet; out of M1 scope but must not be designed out.
- **Never** — not collected by the app.

| Field (form) | Where it comes from | Status |
|---|---|---|
| Legal name (WS 1) | Hospital PDF / self-serve wizard | M1 |
| Sex (MED, WS 3) | Hospital PDF | M1 (parsed); self-serve M2 |
| Age at death (MED, WS 4a) | Hospital PDF (derived from DOB if absent) | M1 |
| Date of death (MED, WS 2) | Hospital PDF / self-serve wizard | M1 |
| Time of death (MED) | Hospital PDF | M1 (optional) |
| Ward (MED) | Hospital PDF | M1 (stored only) |
| Facility name (MED, WS 25) | Hospital PDF | M1 |
| Facility city/state/zip (WS 26–27) | Hospital PDF or zip lookup | M1 (city/state); zip M2 |
| Place of death type (WS 24) | Hospital PDF (inpatient implied) | M1 field, default `unknown` for self-serve |
| Residence street, city, zip, county (WS 13a–13c, 13f) | Hospital PDF; self-serve only zip | M1 (hospital); self-serve county from zip, street M2 |
| Date of birth (WS 7) | Hospital PDF / not asked in self-serve wizard | M1 (hospital); self-serve M2 |
| Birthplace city/state (WS 8a–8b) | Not in hospital form | M2 |
| Marital status, surviving spouse (WS 15–16) | Not in hospital form | M2 |
| Armed forces, education, Hispanic origin, race (WS 9–12) | Not in any source | M2 — ask family only, never inferred |
| Occupation, business (WS 17–18) | Not in any source | M2 |
| Parents' names (WS 19–20) | Not in any source | M2 |
| Informant name, relationship (WS 21–22) | Family contact in Case | M1 (contact name, relationship) |
| Informant mailing address (WS 23) | Not collected | M2 |
| Informant phone (WS bottom) | Conflicts with "email only" | Open question — see below |
| Informant email (WS bottom) | Family email in Case | M1 |
| Disposition method (WS 28) | Wizard: burial / cremation / unsure | M1 (3 options); M2 needs the full list: donation, entombment, removal from state, body not recovered, other |
| Place of disposition, location (WS 29–30) | Selected funeral home | M2 — depends on the chosen funeral home, which M1 does not record |
| Date of disposition (WS 32) | Funeral home | M2 |
| Funeral facility (WS 31) | Selected funeral home, pre-printed on the form | M2 — requires a "selected funeral home" concept that M1 does not have |
| Social Security Number (WS 5) | — | Never |
| Cause of death, manner of death, pregnancy (MED) | Hospital PDF | Never extracted (see Resolved questions) |
| Certifying physician name/license (MED) | Hospital PDF | Never extracted |

Notes:
- The hospital form and the worksheet both use the decedent's full legal name, so the
  M1 name field must hold first/middle/last separately, not one free-text string.
- A funeral home is not chosen in M1, so the worksheet's funeral-facility and disposition
  place fields have no source. M2 needs a "selected funeral home" step after
  recommendations.

## Resolved questions
- **Informant phone:** M1 stays email-only, so the worksheet's phone field is left blank.
  Whether to add phone for the funeral home is deferred to the start of M2.
- **Self-serve place of death:** not asked in the wizard; the Case stores `unknown`.
- **Ward:** stored on the Case, never shown to the family.
- **Age at death:** taken from the PDF when printed; otherwise derived from date of birth
  and date of death.
- **Funeral home selection:** M1 does not record a chosen funeral home. M2 adds a
  "selected funeral home" step after recommendations, which fills the worksheet's
  funeral-facility and disposition-place fields.
- **Self-serve wizard length:** five questions (decedent name, date of death, zip,
  disposition, family contact name and relationship). Originally six, with a required
  email step; the product owner removed the email step so families get recommendations
  without an email or sign-in. The Case is created under an anonymous session with no
  contact email (`family_contact_email` is nullable for self-serve cases).
- **Cause of death:** excluded from the Case schema — not needed for funeral home
  matching, and sensitive. If present in a hospital PDF, the parser should ignore it
  rather than extract it.
- **Invite delivery:** real email, sent via Resend or Supabase's built-in email — not SMS
  or phone at all. Phone numbers aren't collected anywhere in Milestone 1; email is the
  single contact channel end-to-end, for both notification and auth.
- **Invite token identity:** the magic-link email on the invite landing page is pre-filled
  with the contact email the hospital entered and is not editable — a family member can't
  complete signup with a different address, even if the link itself gets forwarded or
  shared beyond the intended recipient.
- **Invite token expiry:** 24 hours from creation, one-time use. If it lapses before the
  family acts, hospital staff resend it, which mints a fresh token (new 24-hour window)
  and invalidates the old one.
- **Family auth:** email magic link, no password — both faster to build (Supabase Auth
  supports this natively, no password-reset flow needed) and the right UX for someone
  signing in once, under stress, shortly after a death. Email is therefore a **required**
  field everywhere a family contact is captured (hospital upload form and self-serve
  signup) — it's the only contact channel and doubles as the auth mechanism.
- **Religious/cultural requirements:** removed entirely from Milestone 1 — not in the Case
  schema, the self-serve wizard, the PDF parse target fields, the FuneralHome dataset's
  capability tags, or the ranking rationale. Funeral homes are matched on location,
  disposition, and price/rating only.
- **Budget range:** removed from the Case schema and the self-serve wizard. Milestone 1
  doesn't collect or filter on budget; price appears in the recommendation as information
  only.
- **Funeral home dataset:** sourced from an existing, pre-compiled list covering all
  licensed funeral homes in Washington State, including pricing and location data — not
  hand-curated for the demo and not scraped live.
