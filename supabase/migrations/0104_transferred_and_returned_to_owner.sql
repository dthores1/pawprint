-- 0104_transferred_and_returned_to_owner.sql
-- ============================================================
-- Two new terminal (historical) animal statuses — both mean the animal has
-- left the organization's care:
--
--   • 'transferred'        — moved to another rescue/shelter (e.g. at
--                            capacity). Outcome details: transferred_to
--                            (required in the app), transferred_at,
--                            transfer_notes.
--   • 'returned_to_owner'  — a lost/separated animal relinquished back to its
--                            family. Outcome details: returned_to_owner_name
--                            (free text; optional — the owner isn't
--                            necessarily a contact), returned_to_owner_at,
--                            returned_to_owner_notes.
--
-- Mirrors the Released/Deceased outcome-detail pattern from 0089. Captured in
-- the Edit dialog when the status is set, surfaced in the profile's summary
-- panels. Keep in sync with src/types/index.ts + src/lib/animalStatus.ts.
-- Idempotent; safe to re-run.
-- ============================================================

alter table public.animals
  add column if not exists transferred_to text,
  add column if not exists transferred_at date,
  add column if not exists transfer_notes text,
  add column if not exists returned_to_owner_name text,
  add column if not exists returned_to_owner_at date,
  add column if not exists returned_to_owner_notes text;

-- Extend the status vocabulary (replaces the 7-status check from 0054).
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
    'deceased',
    'transferred',
    'returned_to_owner'
  ));
