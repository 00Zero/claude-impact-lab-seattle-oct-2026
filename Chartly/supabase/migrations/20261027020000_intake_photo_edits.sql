-- Free-form photo intake (C2): customers add 1–5 photos of their own
-- choosing instead of answering fixed prompts, and can caption, rotate,
-- replace, or remove each one before submitting.
--
-- Every function checks the link token through lock_active_intake_request.

-- Captions are restored when the customer reopens the link, so the
-- customer's browser gets them back along with the photos.
drop function public.get_intake_photos(text);

create function public.get_intake_photos(p_token_hash text)
returns table (id uuid, thumb_path text, caption text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.thumbnail_path, p.caption
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

create function public.set_intake_photo_caption(
  p_token_hash text,
  p_photo_id uuid,
  p_caption text
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
  set caption = nullif(trim(p_caption), '')
  where p.id = p_photo_id
    and p.service_request_id = v_request.id
    and p.status = 'ready'
    and p.removed_at is null;
  if not found then
    raise exception 'photo_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Rotation rewrites the stored files (so contractors and the AI see the
-- corrected image). This returns the files to rewrite and records the new
-- angle; the app server then replaces both files.
create function public.rotate_intake_photo(p_token_hash text, p_photo_id uuid)
returns table (object_path text, thumb_path text, new_rotation smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests := public.lock_active_intake_request(p_token_hash);
begin
  return query
    update public.intake_photos p
    set rotation = ((p.rotation + 90) % 360)::smallint
    where p.id = p_photo_id
      and p.service_request_id = v_request.id
      and p.status = 'ready'
      and p.removed_at is null
    returning p.storage_path, p.thumbnail_path, p.rotation;
  if not found then
    raise exception 'photo_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Superseded by set_intake_photo_caption and rotate_intake_photo.
drop function public.update_intake_photo(text, uuid, text, smallint);

-- Removing the last photo of a request that has a description brings back
-- the "limited visual information" flag.
create or replace function public.remove_intake_photo(p_token_hash text, p_photo_id uuid)
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

  update public.service_requests r
  set limited_visual_info = r.customer_description is not null and not exists (
    select 1 from public.intake_photos p
    where p.service_request_id = r.id
      and p.status = 'ready'
      and p.removed_at is null
  )
  where r.id = v_request.id;
end;
$$;

revoke execute on function public.get_intake_photos(text) from public;
grant execute on function public.get_intake_photos(text) to anon, authenticated;
revoke execute on function public.set_intake_photo_caption(text, uuid, text) from public;
grant execute on function public.set_intake_photo_caption(text, uuid, text) to anon, authenticated;
revoke execute on function public.rotate_intake_photo(text, uuid) from public;
grant execute on function public.rotate_intake_photo(text, uuid) to anon, authenticated;
