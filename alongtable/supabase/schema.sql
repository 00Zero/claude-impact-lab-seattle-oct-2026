-- ALongTable V0 schema. Implements data-model/README.md; change that document first.
-- Run in the Supabase SQL editor on an empty project.
--
-- Access: all reads and writes go through Next.js server code with the service
-- role key. RLS is enabled with no policies so the public anon/publishable key
-- can't read or write anything; the service role bypasses RLS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text not null,
  photo_url   text,
  lat         double precision,
  lng         double precision,
  house_rules text check (char_length(house_rules) <= 600),
  created_at  timestamptz not null default now(),
  check ((lat is null and lng is null) or (lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180))
);

create unique index restaurants_name_location_key
  on restaurants (lower(trim(name)), lower(trim(location)));

create table spaces (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants (id) on delete cascade,
  label          text not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  capacity       int not null check (capacity > 0),
  description    text,
  price_info     text,
  status         text not null default 'available' check (status in ('available', 'booked')),
  check (ends_at > starts_at)
);

create table events (
  id               uuid primary key default gen_random_uuid(),
  space_id         uuid not null unique references spaces (id) on delete cascade,
  title            text not null,
  description      text,
  capacity         int not null check (capacity > 0),
  organizer_name   text not null,
  organizer_email  text not null,
  photo_url        text,
  created_at       timestamptz not null default now()
);

create table reservations (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references events (id) on delete cascade,
  name               text not null,
  email              text not null,
  confirmation_code  text not null unique,
  created_at         timestamptz not null default now(),
  unique (event_id, email)
);

create index reservations_event_id_idx on reservations (event_id);

alter table restaurants  enable row level security;
alter table spaces       enable row level security;
alter table events       enable row level security;
alter table reservations enable row level security;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- /spaces
create view available_spaces with (security_invoker = true) as
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

-- /events and the landing page. Sold-out rows stay; callers filter to upcoming.
create view events_with_availability with (security_invoker = true) as
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

-- /restaurant. Every space, including past ones.
create view spaces_with_booking with (security_invoker = true) as
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

-- ---------------------------------------------------------------------------
-- Functions. Errors are raised with the code as the message, so
-- supabase.rpc(...) returns error.message === 'SPACE_NOT_AVAILABLE' etc.
-- ---------------------------------------------------------------------------

-- Errors: SPACE_NOT_FOUND, SPACE_NOT_AVAILABLE, CAPACITY_INVALID
create function create_event_for_space(
  p_space_id         uuid,
  p_title            text,
  p_description      text,
  p_capacity         int,
  p_organizer_name   text,
  p_organizer_email  text
) returns events
language plpgsql
set search_path = public
as $$
declare
  v_space spaces;
  v_event events;
begin
  select * into v_space from spaces where id = p_space_id for update;
  if not found then
    raise exception 'SPACE_NOT_FOUND';
  end if;
  if v_space.status <> 'available' then
    raise exception 'SPACE_NOT_AVAILABLE';
  end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > v_space.capacity then
    raise exception 'CAPACITY_INVALID';
  end if;

  insert into events (space_id, title, description, capacity, organizer_name, organizer_email)
  values (p_space_id, p_title, p_description, p_capacity, p_organizer_name,
          lower(trim(p_organizer_email)))
  returning * into v_event;

  update spaces set status = 'booked' where id = p_space_id;

  return v_event;
end;
$$;

-- Errors: EVENT_NOT_FOUND, EVENT_FULL, ALREADY_RESERVED
create function reserve_seat(
  p_event_id  uuid,
  p_name      text,
  p_email     text
) returns reservations
language plpgsql
set search_path = public
as $$
declare
  v_event  events;
  v_email  text := lower(trim(p_email));
  v_res    reservations;
begin
  select * into v_event from events where id = p_event_id for update;
  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if (select count(*) from reservations where event_id = p_event_id) >= v_event.capacity then
    raise exception 'EVENT_FULL';
  end if;

  begin
    insert into reservations (event_id, name, email, confirmation_code)
    values (p_event_id, p_name, v_email,
            substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    returning * into v_res;
  exception when unique_violation then
    if exists (select 1 from reservations where event_id = p_event_id and email = v_email) then
      raise exception 'ALREADY_RESERVED';
    end if;
    raise; -- confirmation_code collision: surface it rather than hide it
  end;

  return v_res;
end;
$$;

-- Only the server (service role) may call the functions.
revoke execute on function create_event_for_space(uuid, text, text, int, text, text) from public;
revoke execute on function reserve_seat(uuid, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function create_event_for_space(uuid, text, text, int, text, text) from anon, authenticated;
    revoke execute on function reserve_seat(uuid, text, text) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function create_event_for_space(uuid, text, text, int, text, text) to service_role;
    grant execute on function reserve_seat(uuid, text, text) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Restaurant and event photos. One public bucket (folders restaurants/<id>/ and events/<id>/); the server uploads with the service role
-- key and stores the public URL in restaurants.photo_url or events.photo_url. Public buckets serve
-- objects by URL, so no storage policies are needed for reading.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
