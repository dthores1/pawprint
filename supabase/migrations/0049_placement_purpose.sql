-- 0049_placement_purpose.sql
--
-- Placement Purpose: WHY an animal is staying with a foster. 'general_foster' is
-- the open-ended default; the rest are time-boxed (the UI shows an Expected End
-- Date for them). Modeled as one more attribute on the same placement — still
-- foster care, not a separate concept. Distinct from the legacy `placement_type`
-- column (foster / medical_foster / trial_adoption), which is left untouched.

alter table public.foster_placements
  add column if not exists placement_purpose text not null default 'general_foster'
  check (
    placement_purpose in (
      'general_foster',
      'temporary_holding',
      'medical_recovery',
      'behavioral_observation',
      'transport_staging'
    )
  );
