-- 0019_retire_medical_status.sql
-- The 'medical' lifecycle status is being retired. Medical state is captured
-- by the orthogonal has_medical_concern flag, so anything currently sitting in
-- 'medical' should land in 'not_ready' with the medical concern flag set.

begin;

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
