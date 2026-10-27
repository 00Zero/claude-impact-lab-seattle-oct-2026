-- Source registry, bid cache, and vendor leads.
-- Apply once via `supabase db push` or by pasting into the SQL editor.

create extension if not exists postgis with schema extensions;

-- Places in WA/OR/ID (plus federal) that post bids. One row per agency or shared platform.
create table public.sources (
  id              text primary key,              -- stable slug, e.g. 'wa-city-tacoma'
  name            text not null,
  state           text not null check (state in ('WA','OR','ID','US')),
  agency_type     text not null check (agency_type in (
                    'federal','state','county','city','school','higher_ed','utility','port',
                    'hospital','fire','transit','water','parks','emergency_comms',
                    'special_district','platform')),
  county          text,
  city            text,
  lat             double precision,
  lng             double precision,
  homepage_url    text,
  procurement_url text,                          -- page that lists open bids; null = not found yet
  platform        text,                          -- bonfire, bidnet, opengov, questcdn, civicplus, webs, ... or 'custom'
  fetch_method    text check (fetch_method in ('html','pdf','browser','api')),
  status          text not null default 'candidate'
                    check (status in ('verified','candidate','missing','dead')),
  last_verified   timestamptz,
  discovered_via  text,                          -- 'spreadsheet', 'path_probe', 'web_search', 'manual'
  notes           text,
  raw             jsonb,                         -- original spreadsheet row / discovery evidence
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index sources_state_type_idx on public.sources (state, agency_type);
create index sources_county_idx on public.sources (state, county);

-- Open bids extracted at runtime (or by a scheduled crawl), keyed by source URL.
-- "Why this matched" is per vendor, so it is computed by the matcher and not stored here.
create table public.bids (
  id             uuid primary key default gen_random_uuid(),
  source_id      text references public.sources(id) on delete set null,
  agency         text not null,
  title          text not null,
  description    text,
  location_text  text,
  lat            double precision,
  lng            double precision,
  posted_date    date,
  deadline       timestamptz,
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  source_url     text not null unique,
  naics_codes    text[],
  last_checked   timestamptz not null default now(),
  raw            jsonb,
  created_at     timestamptz not null default now()
);

create index bids_deadline_idx on public.bids (deadline);
create index bids_source_idx on public.bids (source_id);

-- "Get help winning this" handoffs. Holds phone numbers: no public access.
create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null,
  email           text,
  vendor_profile  jsonb not null,
  bid_id          uuid references public.bids(id) on delete set null,
  bid_snapshot    jsonb,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger sources_touch before update on public.sources
  for each row execute function public.touch_updated_at();

-- RLS: anyone may read sources and bids; all writes go through the secret key (bypasses RLS).
alter table public.sources enable row level security;
alter table public.bids    enable row level security;
alter table public.leads   enable row level security;

create policy "public read sources" on public.sources for select to anon, authenticated using (true);
create policy "public read bids"    on public.bids    for select to anon, authenticated using (true);

grant select on public.sources, public.bids to anon, authenticated;
revoke all on public.leads from anon, authenticated;

-- Open bids within `miles` of a point, soonest deadline first.
create or replace function public.open_bids_near(p_lat double precision, p_lng double precision, p_miles double precision)
returns setof public.bids
language sql stable set search_path = '' as $$
  select b.* from public.bids b
  where b.lat is not null and b.lng is not null
    and (b.deadline is null or b.deadline > now())
    and extensions.st_dwithin(
          extensions.st_makepoint(b.lng, b.lat)::extensions.geography,
          extensions.st_makepoint(p_lng, p_lat)::extensions.geography,
          p_miles * 1609.344)
  order by b.deadline nulls last
$$;
