-- House rules for restaurants: migration for an existing database. Safe to run more than once.
-- Run in the Supabase SQL Editor. It does not delete or change any existing data.
-- (schema.sql already includes this, so a fresh rebuild does not need this file.)
--
-- One rule per line, set during sign-up and shown as chips on /spaces/[id] and /events/[id].
-- No views change: the app reads it from restaurants directly.

alter table restaurants add column if not exists house_rules text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurants_house_rules_length_check') then
    alter table restaurants add constraint restaurants_house_rules_length_check check (char_length(house_rules) <= 600);
  end if;
end $$;
