-- Map pins for restaurants: migration for an existing database. Safe to run more than once.
-- Run in the Supabase SQL Editor AFTER supabase/add-photos.sql. It does not delete or change any existing data.
-- Don't re-run add-photos.sql afterwards: its older view definition would drop the map columns (the editor rejects it).
-- (schema.sql already includes all of this, so a fresh rebuild does not need this file.)

-- 1. Optional coordinates per restaurant. Null means "not on the map yet"; the list view is unaffected.
alter table restaurants add column if not exists lat double precision;
alter table restaurants add column if not exists lng double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurants_coordinates_check') then
    alter table restaurants add constraint restaurants_coordinates_check check (
      (lat is null and lng is null)
      or (lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180)
    );
  end if;
end $$;

-- 2. /events exposes them as restaurant_lat / restaurant_lng. New columns go last, so
--    CREATE OR REPLACE VIEW is allowed and existing queries keep working.
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
  e.photo_url as event_photo_url,
  r.lat       as restaurant_lat,
  r.lng       as restaurant_lng
from events e
join spaces s      on s.id = e.space_id
join restaurants r on r.id = s.restaurant_id;

-- 3. /spaces (Host an event) shows available spaces on a map too.
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
  r.photo_url as restaurant_photo_url,
  r.lat       as restaurant_lat,
  r.lng       as restaurant_lng
from spaces s
join restaurants r on r.id = s.restaurant_id
where s.status = 'available'
  and s.starts_at > now();

-- 4. Pins for the seeded restaurants (only where none is set yet).
update restaurants set lat = 47.5784969, lng = -122.4111083 where lower(name) = 'il nido'       and lat is null; -- Alki Homestead
update restaurants set lat = 47.6672,    lng = -122.3847    where lower(name) = 'harbor & pine' and lat is null; -- Ballard Ave NW (sample)
update restaurants set lat = 47.6145,    lng = -122.3197    where lower(name) = 'saffron table' and lat is null; -- Pike/Pine (sample)
