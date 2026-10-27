-- Estimates (B8, B9, C10): a per-workspace price book, built by hand or
-- extracted from the contractor's own pricing documents, and AI-drafted
-- estimates that a contractor approves and releases.
--
-- Money is stored as integer minor units (cents) in the workspace currency.
-- The estimate model never sees or writes prices: it picks price-book items
-- and quantities, and the server copies prices and calculates totals.

alter table public.organizations
  add column estimates_enabled boolean not null default false,
  add column currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$');

grant update (estimates_enabled, currency) on public.organizations to authenticated;

-- ---------- price book ----------

-- Documents the contractor uploaded so the AI can suggest price-book items.
create table public.price_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  status text not null default 'processing' check (status in ('processing', 'succeeded', 'failed')),
  error_code text,
  items_found integer not null default 0,
  -- Pricing policies the AI found (trip fees, after-hours rules, warranty
  -- terms), shown to the contractor. Not used to set prices.
  notes jsonb not null default '[]'::jsonb,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index price_documents_org_idx on public.price_documents (organization_id, created_at desc);

create table public.price_book_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  -- Shown to customers on released estimates.
  description text check (description is null or char_length(description) <= 300),
  category text not null check (category in ('service_fee', 'labor', 'repair', 'part')),
  unit text not null check (unit in ('each', 'hour', 'flat')),
  price_low_minor integer check (price_low_minor is null or price_low_minor >= 0),
  price_high_minor integer check (price_high_minor is null or price_high_minor >= 0),
  -- 'suggested' items (from a document or template) wait for the
  -- contractor's review and are never used in estimates.
  status text not null default 'active' check (status in ('suggested', 'active', 'archived')),
  source_document_id uuid references public.price_documents (id) on delete set null,
  -- A short quote from the document the price came from, for review.
  source_note text check (source_note is null or char_length(source_note) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_low_minor is null or price_high_minor is null or price_low_minor <= price_high_minor),
  -- Only priced items can be used.
  check (status <> 'active' or (price_low_minor is not null and price_high_minor is not null)),
  unique (organization_id, id)
);

create index price_book_items_org_idx on public.price_book_items (organization_id, status, category, name);

create trigger price_documents_set_updated_at
  before update on public.price_documents
  for each row execute function public.set_updated_at();
create trigger price_book_items_set_updated_at
  before update on public.price_book_items
  for each row execute function public.set_updated_at();

-- ---------- estimates ----------

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  version integer not null check (version > 0),
  -- The brief this estimate was drafted from (kept if the brief is deleted
  -- with the request, which cascades anyway).
  brief_id uuid references public.ai_briefs (id) on delete set null,
  brief_version integer,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'released', 'superseded')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Totals over priced lines, recalculated by the server on every change.
  total_low_minor integer not null default 0 check (total_low_minor >= 0),
  total_high_minor integer not null default 0 check (total_high_minor >= 0),
  unpriced_lines integer not null default 0 check (unpriced_lines >= 0),
  assumptions text[] not null default '{}',
  exclusions text[] not null default '{}',
  -- Null for versions a contractor created by hand.
  model text,
  prompt_version text,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  released_by uuid references auth.users (id) on delete set null,
  released_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_request_id, version),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

create index estimates_request_idx on public.estimates (service_request_id, version desc);

create table public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  position integer not null check (position >= 0),
  -- Null for lines no price-book item matched; those need contractor pricing.
  price_book_item_id uuid references public.price_book_items (id) on delete set null,
  -- Customer-facing.
  description text not null check (char_length(trim(description)) between 1 and 300),
  quantity_low numeric(10, 2) not null check (quantity_low > 0),
  quantity_high numeric(10, 2) not null check (quantity_high >= quantity_low),
  unit text not null check (unit in ('each', 'hour', 'flat')),
  -- Copied from the price book when the line is created, so later price-book
  -- changes don't alter existing estimates.
  unit_price_low_minor integer check (unit_price_low_minor is null or unit_price_low_minor >= 0),
  unit_price_high_minor integer check (unit_price_high_minor is null or unit_price_high_minor >= 0),
  -- Why the AI added the line; contractor-only.
  ai_reason text check (ai_reason is null or char_length(ai_reason) <= 500),
  evidence_photo_ids uuid[] not null default '{}',
  evidence_question_ids uuid[] not null default '{}',
  contractor_edited boolean not null default false,
  edited_by uuid references auth.users (id) on delete set null,
  edited_at timestamptz,
  check (unit_price_low_minor is null or unit_price_high_minor is null or unit_price_low_minor <= unit_price_high_minor),
  unique (estimate_id, position)
);

create trigger estimates_set_updated_at
  before update on public.estimates
  for each row execute function public.set_updated_at();

-- Background estimate drafting reuses the job table and usage log.
alter table public.processing_jobs drop constraint processing_jobs_kind_check;
alter table public.processing_jobs
  add constraint processing_jobs_kind_check check (kind in ('brief', 'estimate'));
alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage
  add constraint ai_usage_kind_check check (kind in ('analysis', 'brief', 'price_extraction', 'estimate'));

-- ---------- access ----------

revoke all on public.price_documents, public.price_book_items, public.estimates, public.estimate_line_items from anon;
revoke insert, update, delete on public.price_documents, public.estimates, public.estimate_line_items from authenticated;

alter table public.price_documents enable row level security;
alter table public.price_book_items enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_line_items enable row level security;

create policy "Members can read their price documents"
  on public.price_documents for select to authenticated
  using (public.is_org_member(organization_id));

create policy "Members can read their price book"
  on public.price_book_items for select to authenticated
  using (public.is_org_member(organization_id));
-- The price book is managed by owners and admins (spec §3).
create policy "Owners and admins can add price-book items"
  on public.price_book_items for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy "Owners and admins can edit price-book items"
  on public.price_book_items for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy "Owners and admins can delete suggested price-book items"
  on public.price_book_items for delete to authenticated
  using (status = 'suggested' and public.has_org_role(organization_id, array['owner', 'admin']));

create policy "Members can read their estimates"
  on public.estimates for select to authenticated
  using (public.is_org_member(organization_id));
create policy "Members can read their estimate lines"
  on public.estimate_line_items for select to authenticated
  using (public.is_org_member(organization_id));

-- Approval: owners and admins only, a draft with every line priced.
create function public.approve_estimate(p_estimate_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estimate public.estimates;
begin
  select * into v_estimate from public.estimates where id = p_estimate_id for update;
  if v_estimate.id is null
    or not public.has_org_role(v_estimate.organization_id, array['owner', 'admin']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_estimate.status <> 'draft' then
    raise exception 'not_draft';
  end if;
  if exists (
    select 1 from public.estimate_line_items
    where estimate_id = p_estimate_id
      and (unit_price_low_minor is null or unit_price_high_minor is null)
  ) then
    raise exception 'unpriced_lines';
  end if;
  if not exists (select 1 from public.estimate_line_items where estimate_id = p_estimate_id) then
    raise exception 'no_lines';
  end if;

  update public.estimates
  set status = 'approved', approved_by = (select auth.uid()), approved_at = now()
  where id = p_estimate_id;
end;
$$;

-- Release: owners and admins only, an approved estimate, and the request
-- must have an active intake link so the customer can see it. Any earlier
-- released version is superseded in the same transaction.
create function public.release_estimate(p_estimate_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estimate public.estimates;
begin
  select * into v_estimate from public.estimates where id = p_estimate_id for update;
  if v_estimate.id is null
    or not public.has_org_role(v_estimate.organization_id, array['owner', 'admin']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_estimate.status <> 'approved' then
    raise exception 'not_approved';
  end if;
  if not exists (
    select 1 from public.intake_links
    where service_request_id = v_estimate.service_request_id
      and revoked_at is null
      and expires_at > now()
  ) then
    raise exception 'no_active_link';
  end if;

  update public.estimates
  set status = 'superseded'
  where service_request_id = v_estimate.service_request_id
    and status = 'released';

  update public.estimates
  set status = 'released', released_by = (select auth.uid()), released_at = now()
  where id = p_estimate_id;
end;
$$;

revoke execute on function public.approve_estimate(uuid) from public, anon;
grant execute on function public.approve_estimate(uuid) to authenticated;
revoke execute on function public.release_estimate(uuid) from public, anon;
grant execute on function public.release_estimate(uuid) to authenticated;

-- Private bucket for pricing documents; only the app server reads/writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'price-documents', 'price-documents', false, 10485760,
  array['application/pdf', 'text/plain', 'text/csv', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
