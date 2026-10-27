-- Contact job title and address, shown with the contact on the bid detail.

alter table public.bids
  add column if not exists contact_title   text,
  add column if not exists contact_address text;

update public.bids
  set contact_title = raw->'contact'->>'title',
      contact_address = raw->'contact'->>'address'
  where raw ? 'contact';

-- Views expand * when created, so recreate open_bids to pick up the new columns.
create or replace view public.open_bids with (security_invoker = true) as
  select * from public.bids
  where status = 'open' and (deadline is null or deadline > now());

grant select on public.open_bids to anon, authenticated;
