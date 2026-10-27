-- Ties intake photos to the guided photo prompt they answer (e.g.
-- 'outdoor-unit') and keeps them in the customer's order: a retake takes
-- the place of the photo it replaces instead of moving to the end.

alter table public.intake_photos
  add column prompt_id text check (prompt_id is null or prompt_id ~ '^[a-z0-9-]{1,40}$'),
  add column sort_key timestamptz;
update public.intake_photos set sort_key = created_at;
alter table public.intake_photos
  alter column sort_key set not null,
  alter column sort_key set default now();

drop index public.intake_photos_request_idx;
create index intake_photos_request_idx
  on public.intake_photos (service_request_id, sort_key);

-- Replaces the caption parameter with the prompt the photo answers.
drop function public.reserve_intake_photo(text, text, uuid);

create function public.reserve_intake_photo(
  p_token_hash text,
  p_prompt_id text,
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

  -- Caps storage churn from repeated retakes on one request.
  if (
    select count(*) from public.intake_photos p
    where p.service_request_id = v_request.id
  ) >= 40 then
    raise exception 'upload_limit';
  end if;

  insert into public.intake_photos (
    id, organization_id, service_request_id, storage_path, thumbnail_path,
    prompt_id, intake_revision
  )
  values (
    v_id,
    v_request.organization_id,
    v_request.id,
    v_prefix || '.webp',
    v_prefix || '-thumb.webp',
    p_prompt_id,
    v_request.current_intake_revision
  );

  return query select v_id, v_prefix || '.webp', v_prefix || '-thumb.webp';
end;
$$;

create or replace function public.finalize_intake_photo(
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
    update public.intake_photos p
    set sort_key = old.sort_key
    from public.intake_photos old
    where p.id = p_photo_id
      and old.id = p_replaces_photo_id
      and old.service_request_id = v_request.id;

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

-- Adds the prompt to what the customer's browser gets back.
drop function public.get_intake_photos(text);

create function public.get_intake_photos(p_token_hash text)
returns table (id uuid, prompt_id text, thumb_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.prompt_id, p.thumbnail_path
  from public.intake_links l
  join public.service_requests r on r.id = l.service_request_id
  join public.intake_photos p on p.service_request_id = r.id
  where l.token_hash = p_token_hash
    and l.revoked_at is null
    and l.expires_at > now()
    and r.intake_status <> 'submitted'
    and p.status = 'ready'
    and p.removed_at is null
  order by p.sort_key, p.created_at;
$$;

revoke execute on function public.reserve_intake_photo(text, text, uuid) from public;
grant execute on function public.reserve_intake_photo(text, text, uuid) to anon, authenticated;
revoke execute on function public.get_intake_photos(text) from public;
grant execute on function public.get_intake_photos(text) to anon, authenticated;
