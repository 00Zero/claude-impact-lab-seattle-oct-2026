-- Service requests and their private customer intake links.
--
-- Link tokens are never stored. The app derives each token from a server
-- secret and the link id, and the database keeps only a SHA-256 hash for
-- lookup. A database leak alone can't produce working links.

alter table public.organizations
  add column intake_link_expiry_days integer not null default 7
    check (intake_link_expiry_days between 1 and 30);

grant update (intake_link_expiry_days) on public.organizations to authenticated;

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Per-workspace reference shown to contractors, e.g. #12.
  number integer not null check (number > 0),
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 120),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 40),
  customer_email text check (customer_email is null or char_length(customer_email) <= 254),
  service_address text check (service_address is null or char_length(service_address) <= 300),
  trade text not null check (trade ~ '^[a-z_]{1,40}$'),
  trade_other text,
  issue_description text check (issue_description is null or char_length(issue_description) <= 2000),
  intake_status text not null default 'draft'
    check (intake_status in ('draft', 'shared', 'in_progress', 'submitted')),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'reviewed', 'archived')),
  current_intake_revision integer not null default 1 check (current_intake_revision > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number),
  -- Lets intake_links reference (organization_id, id) so a link can't
  -- point at another workspace's request.
  unique (organization_id, id),
  check (
    (trade = 'other' and trade_other is not null and char_length(trim(trade_other)) between 1 and 60)
    or (trade <> 'other' and trade_other is null)
  )
);

create index service_requests_org_created_idx
  on public.service_requests (organization_id, created_at desc);

create table public.intake_links (
  id uuid primary key,
  organization_id uuid not null,
  service_request_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

-- At most one active (unrevoked) link per request.
create unique index intake_links_one_active_idx
  on public.intake_links (service_request_id)
  where revoked_at is null;

create trigger service_requests_set_updated_at
  before update on public.service_requests
  for each row execute function public.set_updated_at();

revoke all on public.service_requests, public.intake_links from anon;

alter table public.service_requests enable row level security;
alter table public.intake_links enable row level security;

create policy "Members can read their workspace's requests"
  on public.service_requests for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "Members can update their workspace's requests"
  on public.service_requests for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can read their workspace's intake links"
  on public.intake_links for select
  to authenticated
  using (public.is_org_member(organization_id));

-- Requests and links are created only through the functions below. Only
-- these columns are editable directly.
revoke insert, update, delete on public.service_requests, public.intake_links from authenticated;
grant update (customer_name, customer_phone, customer_email, service_address, trade, trade_other, issue_description, intake_status, review_status)
  on public.service_requests to authenticated;

-- Creates a request with the next per-workspace number and its first
-- intake link. The caller supplies the link id and token hash.
create function public.create_service_request(
  p_organization_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_service_address text,
  p_trade text,
  p_trade_other text,
  p_issue_description text,
  p_link_id uuid,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request_id uuid;
  v_number integer;
  v_expiry_days integer;
begin
  if v_user_id is null or not public.is_org_member(p_organization_id) then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;

  -- Serialize numbering within the workspace.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 1));

  select coalesce(max(number), 0) + 1 into v_number
  from public.service_requests
  where organization_id = p_organization_id;

  select intake_link_expiry_days into v_expiry_days
  from public.organizations
  where id = p_organization_id;

  insert into public.service_requests (
    organization_id, number, customer_name, customer_phone, customer_email,
    service_address, trade, trade_other, issue_description, created_by
  )
  values (
    p_organization_id,
    v_number,
    trim(p_customer_name),
    nullif(trim(p_customer_phone), ''),
    nullif(trim(p_customer_email), ''),
    nullif(trim(p_service_address), ''),
    p_trade,
    case when p_trade = 'other' then nullif(trim(p_trade_other), '') end,
    nullif(trim(p_issue_description), ''),
    v_user_id
  )
  returning id into v_request_id;

  insert into public.intake_links (id, organization_id, service_request_id, token_hash, expires_at, created_by)
  values (p_link_id, p_organization_id, v_request_id, p_token_hash, now() + make_interval(days => v_expiry_days), v_user_id);

  return v_request_id;
end;
$$;

-- Revokes the request's active link and issues a new one.
create function public.regenerate_intake_link(
  p_service_request_id uuid,
  p_link_id uuid,
  p_token_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
  v_expiry_days integer;
begin
  select r.organization_id, o.intake_link_expiry_days
  into v_org_id, v_expiry_days
  from public.service_requests r
  join public.organizations o on o.id = r.organization_id
  where r.id = p_service_request_id
  for update of r;

  if v_user_id is null or v_org_id is null or not public.is_org_member(v_org_id) then
    raise exception 'Request not found' using errcode = '42501';
  end if;

  update public.intake_links
  set revoked_at = now()
  where service_request_id = p_service_request_id and revoked_at is null;

  insert into public.intake_links (id, organization_id, service_request_id, token_hash, expires_at, created_by)
  values (p_link_id, v_org_id, p_service_request_id, p_token_hash, now() + make_interval(days => v_expiry_days), v_user_id);
end;
$$;

-- What a customer holding a link may see. Callable without signing in;
-- returns only customer-visible fields and never consumes the link, so
-- messaging previews and prefetches are harmless.
create function public.get_intake_link(p_token_hash text)
returns table (
  status text,
  business_name text,
  business_email text,
  business_phone text,
  customer_name text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when l.revoked_at is not null then 'revoked'
      when l.expires_at <= now() then 'expired'
      when r.intake_status = 'submitted' then 'submitted'
      else 'active'
    end,
    o.name,
    o.contact_email,
    o.contact_phone,
    r.customer_name,
    l.expires_at
  from public.intake_links l
  join public.service_requests r on r.id = l.service_request_id
  join public.organizations o on o.id = l.organization_id
  where l.token_hash = p_token_hash;
$$;

revoke execute on function public.create_service_request(uuid, text, text, text, text, text, text, text, uuid, text) from public, anon;
grant execute on function public.create_service_request(uuid, text, text, text, text, text, text, text, uuid, text) to authenticated;
revoke execute on function public.regenerate_intake_link(uuid, uuid, text) from public, anon;
grant execute on function public.regenerate_intake_link(uuid, uuid, text) to authenticated;
revoke execute on function public.get_intake_link(text) from public;
grant execute on function public.get_intake_link(text) to anon, authenticated;
