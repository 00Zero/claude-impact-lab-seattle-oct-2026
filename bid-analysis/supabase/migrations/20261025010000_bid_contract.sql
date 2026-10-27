-- Bid contract: everything the front end and matcher read about one solicitation.
-- See docs/bid-data-model.md for field meanings and the JSON shape.

alter table public.bids
  add column solicitation_number   text,                    -- agency's own number, e.g. 'ITB 25-104'
  add column bid_type              text not null default 'other'
    check (bid_type in ('itb','rfp','rfq','rfi','small_works','roster','other')),
  add column status                text not null default 'open'
    check (status in ('open','closed','awarded','cancelled','unknown')),
  add column summary               text,                    -- 1-2 plain-language sentences for the detail view
  add column categories            text[] not null default '{}',  -- plain work types matching intake chips: 'paving','janitorial',...
  add column requirements          text[] not null default '{}',  -- 'licensed','bonded','insured','prevailing_wage',...
  add column set_asides            text[] not null default '{}',  -- 'small_business','women_owned','minority_owned','veteran_owned','dbe'
  add column state                 text check (state in ('WA','OR','ID')),
  add column county                text,
  add column city                  text,
  add column prebid_at             timestamptz,
  add column questions_due_at      timestamptz,
  add column estimated_value_text  text,                    -- only as published by the agency; we never estimate prices
  add column documents             jsonb not null default '[]',   -- [{"name","url","type"}]
  add column extraction_method     text check (extraction_method in ('api','html','pdf','llm','manual')),
  add column updated_at            timestamptz not null default now();

alter table public.bids alter column naics_codes set default '{}';
update public.bids set naics_codes = '{}' where naics_codes is null;
alter table public.bids alter column naics_codes set not null;

create unique index bids_source_solicitation_idx
  on public.bids (source_id, solicitation_number) where solicitation_number is not null;
create index bids_state_county_idx on public.bids (state, county);
create index bids_categories_idx on public.bids using gin (categories);
create index bids_naics_idx on public.bids using gin (naics_codes);

create trigger bids_touch before update on public.bids
  for each row execute function public.touch_updated_at();

-- What the app should query: still-open bids only.
create or replace view public.open_bids with (security_invoker = true) as
  select * from public.bids
  where status = 'open' and (deadline is null or deadline > now());

grant select on public.open_bids to anon, authenticated;

create or replace function public.open_bids_near(p_lat double precision, p_lng double precision, p_miles double precision)
returns setof public.bids
language sql stable set search_path = '' as $$
  select b.* from public.bids b
  where b.status = 'open'
    and b.lat is not null and b.lng is not null
    and (b.deadline is null or b.deadline > now())
    and extensions.st_dwithin(
          extensions.st_makepoint(b.lng, b.lat)::extensions.geography,
          extensions.st_makepoint(p_lng, p_lat)::extensions.geography,
          p_miles * 1609.344)
  order by b.deadline nulls last
$$;
