-- 0019_retire_medical_status.sql
-- The 'medical' lifecycle status is being retired. Medical state is captured
-- by the orthogonal has_medical_concern flag, so anything currently sitting in
-- 'medical' should land in 'not_ready' with the medical concern flag set.

begin;

-- 0. Ensure the orthogonal care-flag columns exist before we write to them.
--    These were originally added out-of-band (manually / via the Supabase GUI),
--    so they were never recorded in a migration — this makes the history
--    replayable from scratch. Idempotent: a no-op where they already exist.
alter table animals add column if not exists is_on_hold           boolean not null default false;
alter table animals add column if not exists has_behavior_concern boolean not null default false;
alter table animals add column if not exists has_medical_concern  boolean not null default false;

-- 1. Migrate the data: medical → not_ready + has_medical_concern = true.
update animals
   set status              = 'not_ready',
       has_medical_concern = true,
       updated_at          = now()
 where status = 'medical';

-- 2. Replace the status CHECK constraint so 'medical' is no longer accepted.
--    Drop whatever's there (the original 0001 spelling drifted from reality)
--    and reinstate it with the current AnimalStatus set.
alter table animals
  drop constraint if exists animals_status_check;

alter table animals
  add constraint animals_status_check
  check (status in (
    'intake',
    'not_ready',
    'adoptable',
    'adoption_pending',
    'adopted',
    'released',
    'hospice',
    'deceased'
  ));

commit;
