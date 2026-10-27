-- Demo seed: three Seattle restaurants. Run after schema.sql, or after reset.sql
-- to restore the sample data.
--
-- Il Nido gets no spaces: PRD §8 step 1 is the restaurant publishing its two
-- spaces live. The other two get sample spaces, events and reservations so the
-- browse, discover and restaurant pages aren't empty. Times are relative to
-- today in Seattle, so the sample data never goes stale.
--
-- Safe to re-run: restaurants are skipped if they exist, and sample spaces are
-- only added when those restaurants have none.

insert into restaurants (name, location)
values
  ('Il Nido',        'West Seattle, Seattle, WA'),
  ('Harbor & Pine',  'Ballard, Seattle, WA'),
  ('Saffron Table',  'Capitol Hill, Seattle, WA')
on conflict ((lower(trim(name))), (lower(trim(location)))) do nothing;

-- Map pins (needs supabase/add-coordinates.sql on an existing database). Harbor & Pine
-- and Saffron Table are sample restaurants, pinned on a street in their neighborhood.
update restaurants set lat = 47.5784969, lng = -122.4111083 where lower(name) = 'il nido'       and lat is null;
update restaurants set lat = 47.6672,    lng = -122.3847    where lower(name) = 'harbor & pine' and lat is null;
update restaurants set lat = 47.6145,    lng = -122.3197    where lower(name) = 'saffron table' and lat is null;

do $$
declare
  v_harbor   uuid;
  v_saffron  uuid;
  v_space    uuid;
  v_event    events;
  v_guest    text;
begin
  -- Times below are "midnight today in Seattle + interval", converted back to timestamptz.
  select id into v_harbor  from restaurants where lower(name) = 'harbor & pine';
  select id into v_saffron from restaurants where lower(name) = 'saffron table';

  if exists (select 1 from spaces where restaurant_id in (v_harbor, v_saffron)) then
    raise notice 'Sample spaces already exist; skipping.';
    return;
  end if;

  -- Harbor & Pine ----------------------------------------------------------

  insert into spaces (restaurant_id, label, starts_at, ends_at, capacity, description, price_info)
  values (
    v_harbor, 'Long Table',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '2 days 18 hours') at time zone 'America/Los_Angeles',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '2 days 21 hours') at time zone 'America/Los_Angeles',
    12, 'Reclaimed-wood communal table under the skylight. Seasonal Pacific Northwest menu.',
    '$30 minimum spend per person'
  );

  insert into spaces (restaurant_id, label, starts_at, ends_at, capacity, description, price_info)
  values (
    v_harbor, 'Patio',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '6 days 12 hours') at time zone 'America/Los_Angeles',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '6 days 14 hours') at time zone 'America/Los_Angeles',
    8, 'Covered, heated patio. Good for a weekend lunch.',
    null
  );

  insert into spaces (restaurant_id, label, starts_at, ends_at, capacity, description, price_info)
  values (
    v_harbor, 'Window Booth',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '2 days 18 hours') at time zone 'America/Los_Angeles',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '2 days 21 hours') at time zone 'America/Los_Angeles',
    6, 'Corner booth overlooking the marina.',
    '$25 minimum spend per person'
  )
  returning id into v_space;

  v_event := create_event_for_space(
    v_space, 'Founders & makers supper',
    'Bring a project you''re working on and swap notes over dinner. All stages welcome.',
    6, 'Maya Chen', 'maya.chen@example.com'
  );
  foreach v_guest in array array['Jordan Lee', 'Priya Patel'] loop
    perform reserve_seat(v_event.id, v_guest, replace(lower(v_guest), ' ', '.') || '@example.com');
  end loop;

  -- Saffron Table ----------------------------------------------------------

  insert into spaces (restaurant_id, label, starts_at, ends_at, capacity, description, price_info)
  values (
    v_saffron, 'Back Room',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '9 days 18 hours') at time zone 'America/Los_Angeles',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '9 days 21 hours') at time zone 'America/Los_Angeles',
    16, 'Private room with one long table and a projector.',
    'Family-style menu, about $35 per person'
  );

  insert into spaces (restaurant_id, label, starts_at, ends_at, capacity, description, price_info)
  values (
    v_saffron, 'Chef''s Counter',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '4 days 19 hours') at time zone 'America/Los_Angeles',
    (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '4 days 21 hours 30 minutes') at time zone 'America/Los_Angeles',
    4, 'Four seats facing the open kitchen.',
    '$45 tasting menu'
  )
  returning id into v_space;

  -- Sold out, so the discover page shows the Sold out badge.
  v_event := create_event_for_space(
    v_space, 'Spanish–English language exchange',
    'Half the evening in Spanish, half in English. Any level is welcome.',
    4, 'Diego Ramírez', 'diego.ramirez@example.com'
  );
  foreach v_guest in array array['Ana Torres', 'Sam Okafor', 'Lena Fischer', 'Chris Park'] loop
    perform reserve_seat(v_event.id, v_guest, replace(lower(v_guest), ' ', '.') || '@example.com');
  end loop;
end $$;
