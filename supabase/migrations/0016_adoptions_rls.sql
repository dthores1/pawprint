-- 0016_adoptions_rls.sql
-- The `adoptions` table was created ad-hoc (operational adoption workflow with
-- state tracking). This migration adds what the table needs to behave like every
-- other org-scoped table: indexes, an updated_at trigger, and — importantly —
-- the org-member RLS policy (without it the app's anon-key reads/writes are
-- either fully open or fully blocked). Safe to run against the existing table.

-- Indexes for the common lookups (by org, by animal, by adopter).
CREATE INDEX IF NOT EXISTS adoptions_organization_id_idx ON adoptions (organization_id);
CREATE INDEX IF NOT EXISTS adoptions_animal_id_idx ON adoptions (animal_id);
CREATE INDEX IF NOT EXISTS adoptions_adopter_id_idx ON adoptions (adopter_id);

-- updated_at trigger (reuse public.set_updated_at from 0001).
DROP TRIGGER IF EXISTS adoptions_set_updated_at ON adoptions;
CREATE TRIGGER adoptions_set_updated_at
  BEFORE UPDATE ON adoptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS — gate all access to members of the owning organization.
ALTER TABLE adoptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members manage adoptions" ON adoptions;
CREATE POLICY "org members manage adoptions"
  ON adoptions FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
