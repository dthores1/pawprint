-- 0012_consolidate_fosters_into_people.sql
-- Foster parents ARE volunteers, so the separate foster_parents table is being
-- folded into `people` via a multi-role `roles` array (a person can be a vet
-- AND a foster, etc.). foster_placements now points at people.person_id.
--
-- Option B (chosen): expand the schema, then DISCARD the foster test data and
-- recreate fosters through the refactored app UI (as people with the
-- 'foster_parent' role). Schema changes are additive/non-destructive (old
-- columns/tables are kept for now); foster *data* is intentionally wiped.
--
-- Sequencing: run this → app code is refactored to read `people.roles` +
-- `foster_placements.person_id` → re-add fosters/placements in the app.
--
-- NOTE on the legacy `people.role`: it stays NOT NULL with its CHECK
-- ('vet','rescue_staff','volunteer','adopter') — 'foster_parent' is NOT a valid
-- legacy role, it's a `roles[]` value. New foster-people the app creates set the
-- legacy role to 'volunteer' and add 'foster_parent' to roles[].

BEGIN;

-- 1. Multi-role support + foster-specific fields on people.
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS max_capacity integer,
  ADD COLUMN IF NOT EXISTS preferred_species text[];

-- 2. Backfill roles[] from the existing single role.
UPDATE people
SET roles = ARRAY[role]
WHERE role IS NOT NULL
  AND role <> ''
  AND (roles IS NULL OR cardinality(roles) = 0);

-- 3. foster_placements now references people. Add person_id, relax the legacy
--    NOT NULL on foster_parent_id (new people-only fosters have no
--    foster_parents row), and add the new FK + index.
ALTER TABLE foster_placements
  ADD COLUMN IF NOT EXISTS person_id uuid;

ALTER TABLE foster_placements
  ALTER COLUMN foster_parent_id DROP NOT NULL;

ALTER TABLE foster_placements
  DROP CONSTRAINT IF EXISTS foster_placements_person_id_fkey;
ALTER TABLE foster_placements
  ADD CONSTRAINT foster_placements_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS foster_placements_person_id_idx
  ON foster_placements (person_id);

-- 4. Discard foster test data (Option B). Delete placements first; this CASCADES
--    to sitting_request_placements (their foster_placement_id FK is ON DELETE
--    CASCADE), so existing sitting requests will lose their attached animals —
--    expected for test data. Then clear the denormalized cache on animals.
DELETE FROM foster_placements;
DELETE FROM foster_parents;
UPDATE animals SET current_foster_id = NULL WHERE current_foster_id IS NOT NULL;

COMMIT;

-- Deliberately NOT dropped yet (contract step, after the app is stable):
--   DROP TABLE foster_parents;
--   ALTER TABLE foster_placements DROP COLUMN foster_parent_id;
--   ALTER TABLE people DROP COLUMN role;   -- once everything reads roles[]
