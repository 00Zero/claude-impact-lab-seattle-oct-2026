-- AgenticLantern Milestone 1 schema + RLS, per docs/spec.md.
-- Design note: there is no custom CRUD backend (see spec "Tech stack"). The
-- React app talks to Postgres directly via the Supabase client SDK and these
-- RLS policies. The two Azure Functions (PDF parse, recommendation ranking)
-- use the service-role key and therefore bypass RLS entirely when they write
-- parsed fields / recommendations back.

-- ---------------------------------------------------------------------------
-- profiles: carries the role: hospital | family claim referenced in the spec
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('hospital', 'family')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own"
  on profiles for select
  to authenticated
  using (id = auth.uid());

-- Populates profiles.role from signup metadata, e.g.
-- supabase.auth.signUp({ options: { data: { role: 'hospital' } } })
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'role', 'family'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------
create table cases (
  id uuid primary key default gen_random_uuid(),
  decedent_name text,
  decedent_dob date,
  date_of_death date,
  place_of_death text,
  hospital_facility_name text,
  disposition_preference text check (disposition_preference in ('burial', 'cremation', 'unsure')),
  family_contact_name text,
  family_contact_email text not null,
  location_zip text,
  location_county text,
  source text not null check (source in ('hospital', 'self_serve')),
  status text not null default 'pending_review' check (status in ('pending_review', 'active', 'recommendations_ready')),
  hospital_id uuid references profiles (id),
  family_user_id uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cases enable row level security;

create policy "cases_select_own"
  on cases for select
  to authenticated
  using (hospital_id = auth.uid() or family_user_id = auth.uid());

-- Hospital creates a case it owns; self-serve family creates a case it owns.
create policy "cases_insert_own"
  on cases for insert
  to authenticated
  with check (
    (source = 'hospital' and hospital_id = auth.uid() and family_user_id is null)
    or (source = 'self_serve' and family_user_id = auth.uid() and hospital_id is null)
  );

create policy "cases_update_own"
  on cases for update
  to authenticated
  using (hospital_id = auth.uid() or family_user_id = auth.uid());

create function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cases_set_updated_at
  before update on cases
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- intake_documents: raw PDF + LLM-parsed fields. Written only by the parsing
-- Azure Function via the service-role key, so there are deliberately no
-- client-facing insert/update policies here -- select only.
-- ---------------------------------------------------------------------------
create table intake_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases (id) on delete cascade,
  storage_path text not null,
  parsed_fields jsonb,
  created_at timestamptz not null default now()
);

alter table intake_documents enable row level security;

create policy "intake_documents_select_own"
  on intake_documents for select
  to authenticated
  using (
    exists (
      select 1 from cases c
      where c.id = intake_documents.case_id
        and (c.hospital_id = auth.uid() or c.family_user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- invite_tokens: no client select/delete policy on purpose -- a bare SELECT
-- policy would let any authenticated user enumerate tokens by scanning rows.
-- The invite-landing-page lookup and the sign-up-time redemption instead go
-- through the SECURITY DEFINER functions below, which check the token value
-- server-side before returning or mutating anything.
-- ---------------------------------------------------------------------------
create table invite_tokens (
  id uuid primary key default gen_random_uuid(),
  -- 2x gen_random_uuid() (core PG, no extension needed) hyphens stripped,
  -- concatenated for a 256-bit unguessable token.
  token text not null unique default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  case_id uuid not null references cases (id) on delete cascade,
  contact_email text not null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table invite_tokens enable row level security;

-- Hospital mints/resends invites for its own cases.
create policy "invite_tokens_insert_own_case"
  on invite_tokens for insert
  to authenticated
  with check (
    exists (select 1 from cases c where c.id = invite_tokens.case_id and c.hospital_id = auth.uid())
  );

-- Hospital invalidates an old token when resending (sets used_at).
create policy "invite_tokens_update_own_case"
  on invite_tokens for update
  to authenticated
  using (
    exists (select 1 from cases c where c.id = invite_tokens.case_id and c.hospital_id = auth.uid())
  );

-- Called from the invite landing page before the family signs in: returns
-- just enough to render the page (validity + the email to lock the field
-- to), never the underlying case contents.
create function invite_token_lookup(p_token text)
returns table (valid boolean, contact_email text, case_id uuid)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select
    (it.used_at is null and it.expires_at > now()),
    it.contact_email,
    it.case_id
  from invite_tokens it
  where it.token = p_token;
end;
$$;

grant execute on function invite_token_lookup(text) to anon, authenticated;

-- Called right after the family member completes the magic-link sign-in:
-- links the case to this auth user and burns the token. Rejects if the
-- token is invalid/expired/used, or if it's already linked to someone else,
-- or if the signed-in email doesn't match the contact email on file.
create function redeem_invite_token(p_token text)
returns cases
language plpgsql
security definer set search_path = public
as $$
declare
  v_token invite_tokens;
  v_case cases;
begin
  select * into v_token from invite_tokens where token = p_token for update;

  if v_token is null or v_token.used_at is not null or v_token.expires_at <= now() then
    raise exception 'invite token is invalid, used, or expired';
  end if;

  if lower(v_token.contact_email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'signed-in email does not match the invite contact email';
  end if;

  update cases
  set family_user_id = auth.uid()
  where id = v_token.case_id and family_user_id is null
  returning * into v_case;

  if v_case is null then
    raise exception 'case not found or already linked to a family member';
  end if;

  update invite_tokens set used_at = now() where id = v_token.id;

  return v_case;
end;
$$;

grant execute on function redeem_invite_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- funeral_homes: pre-compiled WA-state dataset, public read-only.
-- ---------------------------------------------------------------------------
create table funeral_homes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  county text,
  zip text,
  phone text,
  cremation_capable boolean not null default false,
  burial_capable boolean not null default false,
  price_cremation numeric,
  price_burial numeric,
  rating numeric
);

alter table funeral_homes enable row level security;

create policy "funeral_homes_public_read"
  on funeral_homes for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- recommendations: written only by the ranking Azure Function (service
-- role), so client policies are select-only, same pattern as intake_documents.
-- ---------------------------------------------------------------------------
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases (id) on delete cascade,
  funeral_home_id uuid not null references funeral_homes (id),
  rank int not null,
  rationale text,
  created_at timestamptz not null default now()
);

alter table recommendations enable row level security;

create policy "recommendations_select_own"
  on recommendations for select
  to authenticated
  using (
    exists (
      select 1 from cases c
      where c.id = recommendations.case_id
        and (c.hospital_id = auth.uid() or c.family_user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- storage: private bucket for uploaded PDFs, objects keyed as "{case_id}/..."
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('intake-documents', 'intake-documents', false);

create policy "intake_documents_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'intake-documents'
    and exists (
      select 1 from cases c
      where c.id::text = (storage.foldername(name))[1]
        and c.hospital_id = auth.uid()
    )
  );

create policy "intake_documents_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'intake-documents'
    and exists (
      select 1 from cases c
      where c.id::text = (storage.foldername(name))[1]
        and (c.hospital_id = auth.uid() or c.family_user_id = auth.uid())
    )
  );
