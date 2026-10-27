-- Workspace settings (B7): photo retention preference, revoking intake
-- links, and permanently deleting requests with their photos.

-- How long customer photos are kept. Stored now; automatic deletion arrives
-- with the pilot's retention cleanup job.
alter table public.organizations
  add column photo_retention_days integer not null default 90
    check (photo_retention_days in (30, 90, 180, 365));

grant update (photo_retention_days) on public.organizations to authenticated;

-- Storage objects waiting to be deleted. Deleting rows and storage objects
-- can't share a transaction, so the database records what to delete in the
-- same transaction as the rows, and the app server (with the secret key)
-- removes the objects and clears these entries. Failures stay here and are
-- retried on the next cleanup.
create table public.storage_deletions (
  id bigint generated always as identity primary key,
  bucket_id text not null,
  object_path text not null,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

revoke all on public.storage_deletions from anon, authenticated;
alter table public.storage_deletions enable row level security;

-- Revokes a request's active link. Any member can do this.
create function public.revoke_intake_link(p_service_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select r.organization_id into v_org_id
  from public.service_requests r
  where r.id = p_service_request_id;

  if v_org_id is null or not public.is_org_member(v_org_id) then
    raise exception 'Request not found' using errcode = '42501';
  end if;

  update public.intake_links
  set revoked_at = now()
  where service_request_id = p_service_request_id and revoked_at is null;
end;
$$;

-- Revokes every active link in the workspace, e.g. after links were shared
-- by mistake. Returns how many links were revoked. Owners and admins only.
create function public.revoke_all_intake_links(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.intake_links
  set revoked_at = now()
  where organization_id = p_organization_id
    and revoked_at is null
    and expires_at > now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Permanently deletes a request, its links, and its photo records, and
-- queues the photo files for deletion. Owners and admins only. Returns the
-- number of photo files queued.
create function public.delete_service_request(p_service_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_count integer;
begin
  select r.organization_id into v_org_id
  from public.service_requests r
  where r.id = p_service_request_id
  for update;

  if v_org_id is null or not public.has_org_role(v_org_id, array['owner', 'admin']) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- Includes removed photos, in case deleting their files failed earlier.
  insert into public.storage_deletions (bucket_id, object_path)
  select 'intake-photos', path
  from public.intake_photos p
  cross join lateral (values (p.storage_path), (p.thumbnail_path)) as files (path)
  where p.service_request_id = p_service_request_id
  on conflict do nothing;
  get diagnostics v_count = row_count;

  -- Cascades to intake links and photo records.
  delete from public.service_requests where id = p_service_request_id;
  return v_count;
end;
$$;

revoke execute on function public.revoke_intake_link(uuid) from public, anon;
grant execute on function public.revoke_intake_link(uuid) to authenticated;
revoke execute on function public.revoke_all_intake_links(uuid) from public, anon;
grant execute on function public.revoke_all_intake_links(uuid) to authenticated;
revoke execute on function public.delete_service_request(uuid) from public, anon;
grant execute on function public.delete_service_request(uuid) to authenticated;
