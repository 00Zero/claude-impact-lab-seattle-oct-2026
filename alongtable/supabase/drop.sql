-- DANGER: deletes every ALongTable table, view, function and all data.
-- Use only to rebuild from scratch, then run schema.sql and seed.sql.
drop view if exists spaces_with_booking, events_with_availability, available_spaces;
drop function if exists reserve_seat(uuid, text, text);
drop function if exists create_event_for_space(uuid, text, text, int, text, text);
drop table if exists reservations, events, spaces, restaurants;
