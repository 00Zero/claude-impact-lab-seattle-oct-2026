-- Photos for restaurants and events: migration for an existing database. Safe to run more than once.
-- Run in the Supabase SQL Editor. It does not delete or change any existing data.
-- (schema.sql already includes all of this, so a fresh rebuild does not need this file.)

-- 1. A photo URL per restaurant and per event.
alter table restaurants add column if not exists photo_url text;
alter table events      add column if not exists photo_url text;

-- 2. The three views expose it as restaurant_photo_url. New columns go last, so
--    CREATE OR REPLACE VIEW is allowed and existing queries keep working.
--    restaurant_photo_url is the restaurant's photo; event_photo_url is the event's own.
create or replace view available_spaces with (security_invoker = true) as
select
  s.id,
  s.restaurant_id,
  r.name      as restaurant_name,
  r.location  as restaurant_location,
  s.label,
  s.starts_at,
  s.ends_at,
  s.capacity,
  s.description,
  s.price_info,
  r.photo_url as restaurant_photo_url
from spaces s
join restaurants r on r.id = s.restaurant_id
where s.status = 'available'
  and s.starts_at > now();

create or replace view events_with_availability with (security_invoker = true) as
select
  e.id,
  e.space_id,
  e.title,
  e.description,
  e.capacity,
  e.organizer_name,
  e.created_at,
  s.label,
  s.starts_at,
  s.ends_at,
  s.price_info,
  r.name      as restaurant_name,
  r.location  as restaurant_location,
  (e.capacity - (select count(*) from reservations x where x.event_id = e.id))::int as seats_left,
  r.photo_url as restaurant_photo_url,
  e.photo_url as event_photo_url
from events e
join spaces s      on s.id = e.space_id
join restaurants r on r.id = s.restaurant_id;

create or replace view spaces_with_booking with (security_invoker = true) as
select
  s.id,
  s.restaurant_id,
  r.name      as restaurant_name,
  r.location  as restaurant_location,
  s.label,
  s.starts_at,
  s.ends_at,
  s.capacity,
  s.description,
  s.price_info,
  s.status,
  e.id              as event_id,
  e.title           as event_title,
  e.organizer_name,
  e.capacity        as event_capacity,
  (select count(*) from reservations x where x.event_id = e.id)::int as seats_taken,
  r.photo_url as restaurant_photo_url,
  e.photo_url as event_photo_url
from spaces s
join restaurants r     on r.id = s.restaurant_id
left join events e     on e.space_id = s.id;

-- 3. One public bucket for all photos, in folders restaurants/<id>/ and events/<id>/ (5 MB,
--    JPEG/PNG/WebP). The server uploads with the service role key; public buckets serve
--    objects by URL, so no read policy is needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
