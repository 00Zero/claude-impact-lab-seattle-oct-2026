-- Optional demo history: gives Harbor & Pine 8 weeks of past spaces, events and
-- reservations so /restaurant/insights shows real numbers instead of the sample
-- (it needs 8+ past events across 4+ weeks). Run after seed.sql.
--
-- Every week has a Tuesday and a Thursday dinner in Main dining (10 seats,
-- $25 minimum). Tuesdays book early and fill well; Thursdays book late (1 to 3
-- days ahead). A few regulars come back. Weeks are the 8 before the current
-- Seattle week, so the data never goes stale.
--
-- Reservations are inserted directly with explicit created_at values, because
-- reserve_seat stamps now() and insights uses booking lead times.
--
-- Safe to re-run: it does nothing if the history is already there. reset.sql
-- removes it along with all other spaces.

do $$
declare
  v_harbor    uuid;
  v_monday    date;
  v_day       date;
  v_starts    timestamptz;
  v_space     uuid;
  v_event     events;
  v_taken     int;
  v_lead      int;
  v_email     text;
  v_n         int := 0;
  w           int;
  d           int;
  g           int;
  -- Seats booked per week, oldest first.
  v_tue       int[] := array[7, 8, 8, 9, 9, 10, 9, 10];
  v_thu       int[] := array[4, 4, 5, 5, 6, 4, 6, 5];
  v_regulars  text[] := array['ana.reyes@example.com', 'ben.okafor@example.com', 'chloe.park@example.com', 'dev.shah@example.com'];
begin
  select id into v_harbor from restaurants where lower(name) = 'harbor & pine';
  if v_harbor is null then
    raise notice 'Harbor & Pine not found; run seed.sql first.';
    return;
  end if;

  if exists (select 1 from spaces where restaurant_id = v_harbor and description = 'Demo history') then
    raise notice 'Demo history already exists; skipping.';
    return;
  end if;

  -- Monday of the current week in Seattle.
  v_monday := date_trunc('week', now() at time zone 'America/Los_Angeles')::date;

  for w in 1..8 loop
    foreach d in array array[1, 3] loop -- Tuesday, Thursday (days after Monday)
      v_day := v_monday - (9 - w) * 7 + d;
      v_starts := (v_day + time '18:00') at time zone 'America/Los_Angeles';
      v_taken := case when d = 1 then v_tue[w] else v_thu[w] end;

      insert into spaces (restaurant_id, label, starts_at, ends_at, capacity, description, price_info)
      values (v_harbor, 'Main dining', v_starts, (v_day + time '21:00') at time zone 'America/Los_Angeles',
              10, 'Demo history', '$25 minimum spend per person')
      returning id into v_space;

      v_event := create_event_for_space(
        v_space,
        case when d = 1 then 'Tuesday supper club' else 'Thursday language table' end,
        null, 10, 'Maya Chen', 'maya.chen@example.com'
      );

      for g in 1..v_taken loop
        v_n := v_n + 1;
        -- The first two seats go to rotating regulars, so some guests come back.
        v_email := case when g <= 2 then v_regulars[1 + (w + g + d) % 4] else format('history.guest%s@example.com', v_n) end;
        v_lead := case when d = 1 then 4 + g % 6 else 1 + g % 3 end;
        insert into reservations (event_id, name, email, confirmation_code, created_at)
        values (v_event.id,
                case when g <= 2 then initcap(replace(split_part(v_email, '@', 1), '.', ' ')) else 'Guest ' || v_n end,
                v_email,
                substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
                v_starts - make_interval(days => v_lead));
      end loop;
    end loop;
  end loop;
end $$;
