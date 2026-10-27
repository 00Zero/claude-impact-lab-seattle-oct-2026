-- PROPOSED, NOT APPLIED. Run in the Supabase SQL editor (or hand to whoever owns migrations).
-- Safe to re-run: every statement is idempotent.

-- 1) Store the structured profile on the user's row, next to info/embed.
--    The matching rules need services, exclusions, service area, bonding, etc.; info/embed alone can't provide them.
alter table public.users
  add column if not exists profile           jsonb,     -- the VendorProfile as the frontend sends it (camelCase keys, each field {value, provenance})
  add column if not exists profile_revision  integer not null default 0,   -- 0 = no profile saved yet; +1 on every save; used for the 409 conflict check
  add column if not exists embedding_model   text,      -- model that produced `embed`, e.g. 'all-MiniLM-L6-v2'
  add column if not exists embedding_version text;      -- our version label for it, e.g. '1'

-- 2) Saved opportunities (frontend: GET / PUT / DELETE /me/saved-opportunities).
create table if not exists public.saved_opportunities (
  user_id    bigint      not null references public.users(id) on delete cascade,   -- same whole-number type as users.id
  bid_id     uuid        not null references public.bids(id)  on delete cascade,   -- bids.id is a uuid
  created_at timestamptz not null default now(),
  primary key (user_id, bid_id)
);

-- 3) Lock both tables to the server. The backend uses the secret key (which bypasses these rules); nobody else,
--    including the public key in the browser, should be able to read password hashes or other users' profiles.
alter table public.users               enable row level security;
alter table public.saved_opportunities enable row level security;
revoke all on public.users               from anon, authenticated;
revoke all on public.saved_opportunities from anon, authenticated;
