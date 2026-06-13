-- 0054_in_care_status.sql
-- Retire the 'medical' lifecycle status in favor of a neutral 'in_care' stage.
--
-- Rationale: 'medical' was the odd one out in the lifecycle taxonomy — it
-- described WHY an animal wasn't progressing (unfinished medical work), not
-- WHERE it was in its journey, and it collided head-on with the orthogonal
-- has_medical_concern care flag. Lifecycle now answers only "where in the
-- journey": intake -> in_care -> adoptable -> adopted/released/hospice/deceased.
-- Care flags (is_on_hold / has_behavior_concern / has_medical_concern) answer
-- "what to know" and coexist with any status.
--
-- Data migration: medical -> in_care AND set has_medical_concern = true, since
-- the medical signal those rows carried now lives in the flag (mirrors 0019).

begin;

-- 1. Migrate the data: medical -> in_care, preserving the medical signal as the
--    flag so nothing is lost.
update animals
   set status              = 'in_care',
       has_medical_concern = true,
       updated_at          = now()
 where status = 'medical';

-- 2. Replace the status CHECK constraint with the new vocabulary.
alter table animals
  drop constraint if exists animals_status_check;

alter table animals
  add constraint animals_status_check
  check (status in (
    'intake',
    'in_care',
    'adoptable',
    'adopted',
    'released',
    'hospice',
    'deceased'
  ));

commit;
