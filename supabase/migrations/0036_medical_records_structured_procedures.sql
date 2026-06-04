-- 0036_medical_records_structured_procedures.sql
--
-- Restructures the medical_records taxonomy so the broad category
-- (procedure_type) and the structured subtype (procedure) are separate,
-- coherent fields — removing the old "type + free-text procedure_name"
-- ambiguity. procedure_name is retained (NOT NULL) for backwards
-- compatibility; the app keeps populating it with a derived display label.
--
-- Run order matters: new columns → remap/backfill existing rows → then add
-- the stricter CHECK constraints (so legacy data can't trip them mid-migration).

begin;

-- 1. New columns -----------------------------------------------------------
alter table medical_records
  add column if not exists procedure              text,
  add column if not exists product_name           text,
  add column if not exists custom_procedure_name  text,
  add column if not exists lot_number             text,
  add column if not exists manufacturer           text,
  add column if not exists dosage                 numeric,
  add column if not exists dose_unit              text,
  add column if not exists route                  text,
  add column if not exists body_location          text,
  add column if not exists expiration_date        date;

-- 2. Remap retired procedure_type values BEFORE re-constraining ------------
--    The old taxonomy had 'deworming' and 'test'; the new one folds those
--    into 'parasite_prevention' and 'diagnostic_test'.
update medical_records
   set procedure_type = 'parasite_prevention',
       procedure      = 'deworming'
 where procedure_type = 'deworming';

update medical_records
   set procedure_type = 'diagnostic_test'
 where procedure_type = 'test';

-- 3. Backfill `procedure` / `custom_procedure_name` from legacy names ------
update medical_records
   set procedure = case
     when lower(procedure_name) like '%rabies%'     then 'rabies'
     when lower(procedure_name) like '%fvrcp%'      then 'fvrcp'
     when lower(procedure_name) like '%felv%'       then 'felv'
     when lower(procedure_name) like '%dhpp%'       then 'dhpp'
     when lower(procedure_name) like '%bordetella%' then 'bordetella'
     when lower(procedure_name) like '%spay%'       then 'spay'
     when lower(procedure_name) like '%neuter%'     then 'neuter'
     when lower(procedure_name) like '%microchip%'  then 'microchip_implant'
     else null
   end
 where procedure is null;

-- Anything we couldn't structure keeps its original text as a custom name.
update medical_records
   set custom_procedure_name = procedure_name
 where procedure is null
   and procedure_name is not null;

-- 4. Constraints (data now conforms) --------------------------------------
alter table medical_records drop constraint if exists medical_records_procedure_type_check;
alter table medical_records add constraint medical_records_procedure_type_check
  check (procedure_type in (
    'vaccine',
    'spay_neuter',
    'microchip',
    'parasite_prevention',
    'exam',
    'surgery',
    'diagnostic_test',
    'medication',
    'other'
  ));

-- Status keeps the existing one-L 'canceled' spelling; only adds 'not_applicable'.
alter table medical_records drop constraint if exists medical_records_status_check;
alter table medical_records add constraint medical_records_status_check
  check (status in (
    'scheduled',
    'completed',
    'due',
    'overdue',
    'canceled',
    'not_applicable'
  ));

alter table medical_records drop constraint if exists medical_records_procedure_check;
alter table medical_records add constraint medical_records_procedure_check
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
    -- catch-all
    'other'
  ));

alter table medical_records drop constraint if exists medical_records_route_check;
alter table medical_records add constraint medical_records_route_check
  check (route is null or route in (
    'oral', 'topical', 'subcutaneous', 'intramuscular', 'intravenous',
    'intranasal', 'otic', 'ophthalmic', 'other'
  ));

alter table medical_records drop constraint if exists medical_records_dose_unit_check;
alter table medical_records add constraint medical_records_dose_unit_check
  check (dose_unit is null or dose_unit in (
    'ml', 'mg', 'tablet', 'capsule', 'dose', 'drop', 'application', 'other'
  ));

-- A custom name is required exactly when procedure = 'other'.
alter table medical_records drop constraint if exists medical_records_other_procedure_name_check;
alter table medical_records add constraint medical_records_other_procedure_name_check
  check (
    procedure is distinct from 'other'
    or nullif(trim(custom_procedure_name), '') is not null
  );

commit;
