-- Request list support: activity/submission timestamps, analysis status,
-- and a search function with filters, sorting, and pagination.

alter table public.service_requests
  -- Last intake activity (link shared or regenerated, customer progress,
  -- submission). Distinct from updated_at, which covers any edit.
  add column last_activity_at timestamptz not null default now(),
  add column submitted_at timestamptz,
  -- Mirrors the latest AI processing job so the list needn't join jobs.
  -- 'not_started' until the AI pipeline exists.
  add column analysis_status text not null default 'not_started'
    check (analysis_status in ('not_started', 'pending', 'running', 'succeeded', 'failed'));

update public.service_requests set last_activity_at = updated_at;

-- Keep the timestamps correct no matter which code path changes status.
create function public.track_service_request_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.intake_status is distinct from old.intake_status then
    new.last_activity_at = now();
    if new.intake_status = 'submitted' then
      new.submitted_at = now();
    end if;
  end if;
  return new;
end;
$$;

create trigger service_requests_track_activity
  before update on public.service_requests
  for each row execute function public.track_service_request_activity();

-- A new link counts as intake activity.
create function public.touch_request_on_new_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.service_requests
  set last_activity_at = now()
  where id = new.service_request_id;
  return new;
end;
$$;

create trigger intake_links_touch_request
  after insert on public.intake_links
  for each row execute function public.touch_request_on_new_link();

create index service_requests_org_activity_idx
  on public.service_requests (organization_id, last_activity_at desc);
create index service_requests_org_submitted_idx
  on public.service_requests (organization_id, submitted_at desc nulls last);

-- Substring search on name and address.
create extension if not exists pg_trgm with schema extensions;
create index service_requests_customer_name_trgm_idx
  on public.service_requests using gin (customer_name extensions.gin_trgm_ops);
create index service_requests_service_address_trgm_idx
  on public.service_requests using gin (service_address extensions.gin_trgm_ops);

-- Runs as the caller, so RLS still limits rows to the caller's workspaces.
-- Returns one page plus the total match count.
create function public.search_service_requests(
  p_organization_id uuid,
  p_query text default null,
  p_intake_status text default null,
  p_review text default 'active',
  p_sort text default 'created',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  number integer,
  customer_name text,
  service_address text,
  intake_status text,
  review_status text,
  analysis_status text,
  created_at timestamptz,
  updated_at timestamptz,
  last_activity_at timestamptz,
  submitted_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      nullif(trim(p_query), '') as q,
      -- Escape LIKE wildcards so the query is matched literally.
      '%' || replace(replace(replace(nullif(trim(p_query), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      -- "#12" or "12" also matches request number 12.
      case
        when ltrim(trim(p_query), '#') ~ '^[0-9]{1,9}$' then ltrim(trim(p_query), '#')::integer
      end as ref
  )
  select
    r.id, r.number, r.customer_name, r.service_address, r.intake_status,
    r.review_status, r.analysis_status, r.created_at, r.updated_at,
    r.last_activity_at, r.submitted_at,
    count(*) over () as total_count
  from public.service_requests r, params
  where r.organization_id = p_organization_id
    and (
      params.q is null
      or r.customer_name ilike params.pattern
      or r.service_address ilike params.pattern
      or r.number = params.ref
    )
    and (p_intake_status is null or r.intake_status = p_intake_status)
    and case p_review
      when 'unreviewed' then r.review_status = 'unreviewed'
      when 'reviewed' then r.review_status = 'reviewed'
      when 'archived' then r.review_status = 'archived'
      when 'all' then true
      else r.review_status <> 'archived'
    end
  order by
    case when p_sort = 'activity' then r.last_activity_at end desc,
    case when p_sort = 'submitted' then r.submitted_at end desc nulls last,
    r.created_at desc,
    r.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.search_service_requests(uuid, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.search_service_requests(uuid, text, text, text, text, integer, integer) to authenticated;
