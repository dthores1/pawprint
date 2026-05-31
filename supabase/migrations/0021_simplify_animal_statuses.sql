-- 0021_simplify_animal_statuses.sql
-- Collapse the lifecycle to: intake, medical, adoptable, adopted, released,
-- hospice, deceased. The two retired statuses migrate as follows:
--   * not_ready WITH has_medical_concern  -> medical (flag cleared, since the
--                                            status now carries that meaning)
--   * not_ready WITHOUT has_medical_concern -> intake
--   * adoption_pending -> adoptable + is_on_hold = true
-- "On hold" is now the canonical way to signal an active adoption; the
-- adoption-workflow code keeps it in sync going forward.

begin;

-- 1a. not_ready + medical concern -> medical (clear the now-redundant flag).
update animals
   set status              = 'medical',
       has_medical_concern = false,
       updated_at          = now()
 where status = 'not_ready'
   and has_medical_concern is true;

-- 1b. Remaining not_ready -> intake.
update animals
   set status     = 'intake',
       updated_at = now()
 where status = 'not_ready';

-- 1c. adoption_pending -> adoptable + on_hold.
update animals
   set status     = 'adoptable',
       is_on_hold = true,
       updated_at = now()
 where status = 'adoption_pending';

-- 2. Replace the CHECK constraint with the new vocabulary.
alter table animals
  drop constraint if exists animals_status_check;

alter table animals
  add constraint animals_status_check
  check (status in (
    'intake',
    'medical',
    'adoptable',
    'adopted',
    'released',
    'hospice',
    'deceased'
  ));

commit;
