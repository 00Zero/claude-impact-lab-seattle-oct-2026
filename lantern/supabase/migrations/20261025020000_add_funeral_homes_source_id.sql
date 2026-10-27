-- ---------------------------------------------------------------------------
-- funeral_homes has no natural key besides its random `id`. The dataset
-- loader (scripts/load-funeral-homes.ts) needs something stable to upsert
-- on so re-running it is idempotent instead of creating duplicates. The
-- source dataset (data/funeral_homes.json) already carries a stable integer
-- `id` per home — store it here as `source_id`.
-- ---------------------------------------------------------------------------
alter table funeral_homes
  add column source_id bigint unique;
