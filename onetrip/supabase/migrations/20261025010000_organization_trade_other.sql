-- Broaden trades beyond HVAC/plumbing and allow a free-text "other" trade.
-- The list of known trades lives in src/lib/trades.ts; the database only
-- enforces the slug format so adding a trade doesn't need a migration.

alter table public.organizations
  drop constraint organizations_trade_check;

alter table public.organizations
  add column trade_other text,
  add constraint organizations_trade_check
    check (trade ~ '^[a-z_]{1,40}$'),
  add constraint organizations_trade_other_check
    check (
      (trade = 'other' and trade_other is not null and char_length(trim(trade_other)) between 1 and 60)
      or (trade <> 'other' and trade_other is null)
    );

grant update (trade_other) on public.organizations to authenticated;

drop function public.create_organization(text, text, text, text, text);

create function public.create_organization(
  p_name text,
  p_trade text,
  p_trade_other text,
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

  insert into public.organizations (name, trade, trade_other, contact_email, contact_phone, timezone, created_by)
  values (
    trim(p_name),
    p_trade,
    case when p_trade = 'other' then nullif(trim(p_trade_other), '') end,
    nullif(trim(p_contact_email), ''),
    nullif(trim(p_contact_phone), ''),
    p_timezone,
    v_user_id
  )
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  return v_org_id;
end;
$$;

revoke execute on function public.create_organization(text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text) to authenticated;
