-- 0089_animal_outcomes_and_necropsy.sql
-- ============================================================
-- Terminal-outcome details for an animal, plus a Necropsy medical type.
--
--   • animals: date_of_death / cause_of_death / death_notes (Deceased) and
--     released_at (Released). Captured in the Edit dialog when the status is
--     set, surfaced in the profile's Case Summary / Release Summary.
--   • medical_records: allow procedure_type + procedure = 'necropsy' so a
--     post-mortem exam can be logged like any other record.
--
-- Mirrors src/types/index.ts + src/lib/medicalOptions.ts — keep in sync.
-- Idempotent; safe to re-run.
-- ============================================================

alter table public.animals
  add column if not exists date_of_death date,
  add column if not exists cause_of_death text,
  add column if not exists death_notes text,
  add column if not exists released_at date;

-- Extend the medical taxonomy with Necropsy (a top-level type whose single
-- procedure value is also 'necropsy').
alter table public.medical_records
  drop constraint if exists medical_records_procedure_type_check;
alter table public.medical_records
  add constraint medical_records_procedure_type_check
  check (procedure_type in (
    'vaccine', 'spay_neuter', 'microchip', 'parasite_prevention',
    'exam', 'surgery', 'diagnostic_test', 'medication', 'necropsy', 'other'
  ));

alter table public.medical_records
  drop constraint if exists medical_records_procedure_check;
alter table public.medical_records
  add constraint medical_records_procedure_check
  check (procedure is null or procedure in (
    -- vaccine
    'rabies', 'fvrcp', 'felv', 'dhpp', 'bordetella',
    'leptospirosis', 'canine_influenza', 'rhdv2',
    -- spay/neuter
    'spay', 'neuter',
    -- parasite prevention
    'flea_tick_prevention', 'heartworm_prevention', 'deworming',
    -- exam
    'wellness_exam', 'intake_exam', 'recheck_exam', 'sick_exam',
    -- diagnostic test
    'felv_fiv_test', 'heartworm_test', 'fecal_test',
    'bloodwork', 'urinalysis', 'xray', 'ultrasound',
    -- microchip
    'microchip_implant', 'microchip_scan',
    -- medication
    'antibiotic', 'pain_medication', 'anti_inflammatory', 'sedative',
    -- surgery
    'dental_surgery', 'mass_removal', 'wound_repair',
    'eye_surgery', 'orthopedic_surgery',
    -- necropsy
    'necropsy',
    -- catch-all
    'other'
  ));
