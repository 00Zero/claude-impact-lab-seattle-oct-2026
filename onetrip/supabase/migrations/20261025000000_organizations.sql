-- Workspaces (organizations) and their members.
-- Every business record hangs off organizations.id; RLS limits access to members.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  trade text not null check (trade in ('hvac', 'plumbing')),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  timezone text not null check (char_length(timezone) between 1 and 64),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'technician')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);

-- Membership checks run as definer so policies on organization_members
-- don't recurse into themselves.
create function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = (select auth.uid())
  );
$$;

create function public.has_org_role(org_id uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

-- Customers never use these tables directly; intake goes through scoped
-- server endpoints.
revoke all on public.organizations, public.organization_members from anon;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "Members can read their organization"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

create policy "Owners and admins can update their organization"
  on public.organizations for update
  to authenticated
  using (public.has_org_role(id, array['owner', 'admin']))
  with check (public.has_org_role(id, array['owner', 'admin']));

create policy "Members can read memberships in their organization"
  on public.organization_members for select
  to authenticated
  using (public.is_org_member(organization_id));

-- No insert/delete policies: workspaces are created only through
-- create_organization(), and team management arrives with the pilot.

-- Columns that must not change after creation.
revoke update on public.organizations from authenticated;
grant update (name, trade, contact_email, contact_phone, timezone)
  on public.organizations to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- Creates a workspace and makes the caller its owner in one transaction.
-- Launch supports one workspace per user.
create function public.create_organization(
  p_name text,
  p_trade text,
  p_contact_email text,
  p_contact_phone text,
  p_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Serialize per user so double submits can't create two workspaces.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (select 1 from public.organization_members where user_id = v_user_id) then
    raise exception 'User already belongs to a workspace' using errcode = 'P0001';
  end if;

  insert into public.organizations (name, trade, contact_email, contact_phone, timezone, created_by)
  values (trim(p_name), p_trade, nullif(trim(p_contact_email), ''), nullif(trim(p_contact_phone), ''), p_timezone, v_user_id)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  return v_org_id;
end;
$$;

revoke execute on function public.create_organization(text, text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text) to authenticated;
revoke execute on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
revoke execute on function public.has_org_role(uuid, text[]) from public, anon;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
