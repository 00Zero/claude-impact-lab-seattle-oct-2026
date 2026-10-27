-- Self-serve families can now skip the email step and continue as an anonymous
-- Supabase user (see Wizard.tsx). Their case has no contact email until they add one.
-- Hospital-sourced cases still always have an email (NewCase requires it).
alter table cases alter column family_contact_email drop not null;
