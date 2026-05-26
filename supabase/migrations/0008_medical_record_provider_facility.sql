-- 0008_medical_record_provider_facility.sql
-- A medical record can be attributed to a known contact OR a free-text name,
-- and to a scheduled clinic event OR a free-text facility. All optional, so the
-- form stays low-friction for ad-hoc records. FKs use ON DELETE SET NULL so
-- removing a clinic or contact never deletes medical history.
--
--   clinic_id           → the scheduled clinic event it was done at
--   provider_contact_id → the person who performed/administered it
--   provider_name       → free-text performer fallback (already existed)
--   facility_name       → free-text facility fallback (vet office, shelter, …)

alter table medical_records
  add column if not exists clinic_id uuid references clinic_events(id) on delete set null,
  add column if not exists provider_contact_id uuid references people(id) on delete set null,
  add column if not exists facility_name text;

create index if not exists medical_records_clinic_id_idx
  on medical_records (clinic_id);
create index if not exists medical_records_provider_contact_id_idx
  on medical_records (provider_contact_id);
