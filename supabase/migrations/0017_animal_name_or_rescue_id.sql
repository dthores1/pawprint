-- Animals can now exist with either a Name or a Rescue ID (or both). Rescue
-- IDs are operational identifiers assigned by the org (e.g. `DanBH-1`,
-- `ACP-1044`) and are unique within an organization. Different orgs may reuse
-- the same Rescue ID value.
--
-- This migration mirrors SQL that was already run in production via the
-- Supabase SQL editor — kept here so the migrations folder remains the
-- canonical source of schema history.
--
-- Idempotent: each DDL guards against repeated application.

-- 1) Name becomes optional. Rescue ID stands in when no name is set.
ALTER TABLE animals
  ALTER COLUMN name DROP NOT NULL;

-- 2) Rescue ID column (free-form text — orgs use varied conventions).
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS rescue_id text;

-- 3) Require at least one of name or rescue_id. The app's add/edit modals
-- enforce this client-side too with a friendlier message.
ALTER TABLE animals
  DROP CONSTRAINT IF EXISTS animals_name_or_rescue_id_check;
ALTER TABLE animals
  ADD CONSTRAINT animals_name_or_rescue_id_check
  CHECK (name IS NOT NULL OR rescue_id IS NOT NULL);

-- 4) Rescue IDs are unique per org. Partial index keeps NULLs allowed
-- (multiple animals can exist without a rescue_id concurrently).
CREATE UNIQUE INDEX IF NOT EXISTS animals_org_rescue_id_unique
  ON animals (organization_id, rescue_id)
  WHERE rescue_id IS NOT NULL;
