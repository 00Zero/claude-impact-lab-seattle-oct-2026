-- Customer photos for photo-first intake (C2).
--
-- Customers aren't signed in. Every customer operation goes through the
-- functions below, which check the link token hash and lock the request.
-- The app server then writes the processed images to a private bucket with
-- the secret key; customers never get storage or table privileges.
-- Objects live at intake-photos/<org id>/<request id>/<photo id>[-thumb].webp.

-- A customer who can't provide a usable photo describes the problem instead.
alter table public.service_requests
  add column customer_description text
    check (customer_description is null or char_length(customer_description) <= 2000),
  add column limited_visual_info boolean not null default false;

create table public.intake_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  storage_path text not null unique,
  thumbnail_path text not null unique,
  caption text check (caption is null or char_length(caption) <= 300),
  -- Clockwise rotation the customer applied on top of EXIF orientation.
  rotation smallint not null default 0 check (rotation in (0, 90, 180, 270)),
  width integer check (width > 0),
  height integer check (height > 0),
  -- 'uploading' until both files are stored.
  status text not null default 'uploading' check (status in ('uploading', 'ready')),
  intake_revision integer not null check (intake_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Removed or replaced by the customer; the stored files are deleted.
  removed_at timestamptz,
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

create index intake_photos_request_idx
  on public.intake_photos (service_request_id, created_at);

create trigger intake_photos_set_updated_at
  before update on public.intake_photos
  for each row execute function public.set_updated_at();

revoke all on public.intake_photos from anon;
revoke insert, update, delete on public.intake_photos from authenticated;

alter table public.intake_photos enable row level security;

create policy "Members can read their workspace's intake photos"
  on public.intake_photos for select
  to authenticated
  using (public.is_org_member(organization_id));

-- Locks and returns the request behind an active link, or raises. Only
-- called from the definer functions below.
create function public.lock_active_intake_request(p_token_hash text)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests;
begin
  select r.* into v_request
  from public.intake_links l
  join public.service_requests r on r.id = l.service_request_id
  where l.token_hash = p_token_hash
    and l.revoked_at is null
    and l.expires_at > now()
  for update of r;

  if v_request.id is null or v_request.intake_status = 'submitted' then
    raise exception 'link_inactive' using errcode = '42501';
  end if;
  return v_request;
end;
$$;

-- Starts an upload: checks limits and records a pending photo. Pending
-- photos count toward the limit for 15 minutes so parallel uploads can't
-- exceed it. When replacing, the old photo doesn't count.
create function public.reserve_intake_photo(
  p_token_hash text,
  p_caption text,
  p_replaces_photo_id uuid
)
returns table (photo_id uuid, object_path text, thumb_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests := public.lock_active_intake_request(p_token_hash);
  v_id uuid := gen_random_uuid();
  v_prefix text := v_request.organization_id::text || '/' || v_request.id::text || '/' || v_id::text;
begin
  if p_replaces_photo_id is not null and not exists (
    select 1 from public.intake_photos p
    where p.id = p_replaces_photo_id
      and p.service_request_id = v_request.id
      and p.status = 'ready'
      and p.removed_at is null
  ) then
    raise exception 'photo_not_found' using errcode = 'P0002';
  end if;

  if (
    select count(*) from public.intake_photos p
    where p.service_request_id = v_request.id
      and p.removed_at is null
      and p.id is distinct from p_replaces_photo_id
      and (p.status = 'ready' or p.created_at > now() - interval '15 minutes')
  ) >= 5 then
    raise exception 'photo_limit';
  end if;

  -- Caps storage churn from repeated replace/remove on one request.
  if (
    select count(*) from public.intake_photos p
    where p.service_request_id = v_request.id
  ) >= 40 then
    raise exception 'upload_limit';
  end if;

  insert into public.intake_photos (
    id, organization_id, service_request_id, storage_path, thumbnail_path,
    caption, intake_revision
  )
  values (
    v_id,
    v_request.organization_id,
    v_request.id,
    v_prefix || '.webp',
    v_prefix || '-thumb.webp',
    nullif(trim(p_caption), ''),
    v_request.current_intake_revision
  );

  return query select v_id, v_prefix || '.webp', v_prefix || '-thumb.webp';
end;
$$;

-- Marks an upload complete. Returns the files of the photo it replaced so
-- the caller can delete them.
create function public.finalize_intake_photo(
  p_token_hash text,
  p_photo_id uuid,
  p_width integer,
  p_height integer,
  p_replaces_photo_id uuid
)
returns table (object_path text, thumb_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests := public.lock_active_intake_request(p_token_hash);
begin
  update public.intake_photos p
  set status = 'ready', width = p_width, height = p_height
  where p.id = p_photo_id
    and p.service_request_id = v_request.id
    and p.status = 'uploading'
    and p.removed_at is null;
  if not found then
    raise exception 'photo_not_found' using errcode = 'P0002';
  end if;

  update public.service_requests r
  set
    intake_status = case when r.intake_status in ('draft', 'shared') then 'in_progress' else r.intake_status end,
    limited_visual_info = false
  where r.id = v_request.id;

  if p_replaces_photo_id is not null then
    return query
      update public.intake_photos p
      set removed_at = now()
      where p.id = p_replaces_photo_id
        and p.service_request_id = v_request.id
        and p.removed_at is null
      returning p.storage_path, p.thumbnail_path;
  end if;
end;
$$;

-- Removes a photo (or abandons a failed upload). Returns its files so the
-- caller can delete them.
create function public.remove_intake_photo(p_token_hash text, p_photo_id uuid)
returns table (object_path text, thumb_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests := public.lock_active_intake_request(p_token_hash);
begin
  return query
    update public.intake_photos p
    set removed_at = now()
    where p.id = p_photo_id
      and p.service_request_id = v_request.id
      and p.removed_at is null
    returning p.storage_path, p.thumbnail_path;
end;
$$;

create function public.update_intake_photo(
  p_token_hash text,
  p_photo_id uuid,
  p_caption text,
  p_rotation smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests := public.lock_active_intake_request(p_token_hash);
begin
  update public.intake_photos p
  set caption = nullif(trim(p_caption), ''), rotation = p_rotation
  where p.id = p_photo_id
    and p.service_request_id = v_request.id
    and p.status = 'ready'
    and p.removed_at is null;
  if not found then
    raise exception 'photo_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Saves the customer's own description. With no photos, the request is
-- flagged as having limited visual information.
create function public.save_intake_description(p_token_hash text, p_description text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests := public.lock_active_intake_request(p_token_hash);
  v_description text := nullif(trim(p_description), '');
begin
  update public.service_requests r
  set
    customer_description = v_description,
    limited_visual_info = v_description is not null and not exists (
      select 1 from public.intake_photos p
      where p.service_request_id = r.id
        and p.status = 'ready'
        and p.removed_at is null
    ),
    intake_status = case when r.intake_status in ('draft', 'shared') then 'in_progress' else r.intake_status end
  where r.id = v_request.id;
end;
$$;

-- The customer's saved photos, for an active link only.
create function public.get_intake_photos(p_token_hash text)
returns table (id uuid, thumb_path text, caption text, rotation smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.thumbnail_path, p.caption, p.rotation
  from public.intake_links l
  join public.service_requests r on r.id = l.service_request_id
  join public.intake_photos p on p.service_request_id = r.id
  where l.token_hash = p_token_hash
    and l.revoked_at is null
    and l.expires_at > now()
    and r.intake_status <> 'submitted'
    and p.status = 'ready'
    and p.removed_at is null
  order by p.created_at;
$$;

-- Adds the customer's saved description to what a link holder may see.
drop function public.get_intake_link(text);

create function public.get_intake_link(p_token_hash text)
returns table (
  status text,
  business_name text,
  business_email text,
  business_phone text,
  customer_name text,
  customer_description text,
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
    r.customer_description,
    l.expires_at
  from public.intake_links l
  join public.service_requests r on r.id = l.service_request_id
  join public.organizations o on o.id = l.organization_id
  where l.token_hash = p_token_hash;
$$;

revoke execute on function public.lock_active_intake_request(text) from public, anon, authenticated;
revoke execute on function public.reserve_intake_photo(text, text, uuid) from public;
grant execute on function public.reserve_intake_photo(text, text, uuid) to anon, authenticated;
revoke execute on function public.finalize_intake_photo(text, uuid, integer, integer, uuid) from public;
grant execute on function public.finalize_intake_photo(text, uuid, integer, integer, uuid) to anon, authenticated;
revoke execute on function public.remove_intake_photo(text, uuid) from public;
grant execute on function public.remove_intake_photo(text, uuid) to anon, authenticated;
revoke execute on function public.update_intake_photo(text, uuid, text, smallint) from public;
grant execute on function public.update_intake_photo(text, uuid, text, smallint) to anon, authenticated;
revoke execute on function public.save_intake_description(text, text) from public;
grant execute on function public.save_intake_description(text, text) to anon, authenticated;
revoke execute on function public.get_intake_photos(text) from public;
grant execute on function public.get_intake_photos(text) to anon, authenticated;
revoke execute on function public.get_intake_link(text) from public;
grant execute on function public.get_intake_link(text) to anon, authenticated;

-- Private bucket: only the app server writes (with the secret key) and
-- images are served through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('intake-photos', 'intake-photos', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- Takes the folder name as text so a malformed path can't fail a uuid cast.
create function public.is_org_member_folder(folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id::text = folder and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_org_member_folder(text) from public, anon;
grant execute on function public.is_org_member_folder(text) to authenticated;

create policy "Members can view their workspace's intake photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'intake-photos'
    and public.is_org_member_folder((storage.foldername(name))[1])
  );
