-- Aligns `cases` with the consolidated spec (docs/spec.md), which replaces
-- the original flat decedent_name/dob/place_of_death fields with the
-- field-level schema grounded in the actual hospital certificate and WA
-- death-certificate worksheet (see "Template field gaps" in the spec).
-- cases has no rows yet, so this is a straight drop/add rather than a
-- backfill.

alter table cases
  drop column decedent_name,
  drop column decedent_dob,
  drop column place_of_death,
  drop column hospital_facility_name,
  drop column location_zip,
  drop column location_county;

alter table cases
  add column legal_first_name text,
  add column legal_middle_name text,
  add column legal_last_name text,
  add column sex text,
  add column date_of_birth date,
  add column age_at_death integer,
  add column time_of_death time,
  -- stored per spec "Resolved questions" (never shown to family in the UI)
  add column ward text,
  add column facility_name text,
  add column facility_city text,
  add column facility_state text,
  add column facility_zip text,
  add column place_of_death_type text not null default 'unknown',
  add column residence_street text,
  add column residence_city text,
  add column residence_state text,
  add column residence_zip text,
  add column residence_county text,
  add column family_contact_relationship text;

alter table cases
  add constraint cases_place_of_death_type_check
  check (place_of_death_type in (
    'inpatient', 'emergency', 'dead_on_arrival', 'hospice',
    'nursing_home', 'decedent_home', 'other', 'unknown'
  ));

comment on column cases.residence_zip is 'drives funeral-home matching, replacing the old location_zip';
comment on column cases.residence_county is 'drives funeral-home matching, replacing the old location_county';
