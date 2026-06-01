-- 0029_adoption_returns.sql
-- Adoption returns: when an adopter returns an animal, the completed adoption is
-- reversed (status -> 'returned') and the animal re-enters care. The `adoptions`
-- table was created ad-hoc (see 0016), so the `status` value set isn't enforced
-- by a CHECK here; the app's AdoptionStatus union is the source of truth. This
-- migration captures the new columns + the reason-required guard.

ALTER TABLE adoptions
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_reason text,
  ADD COLUMN IF NOT EXISTS return_notes text;

-- A returned adoption must carry a (non-blank) reason. The app constrains the
-- value to a fixed vocabulary (behavior, medical, financial, housing,
-- pet_compatibility, family_compatibility, life_changes, rescue_request, other).
ALTER TABLE adoptions
  DROP CONSTRAINT IF EXISTS chk_return_reason_required;
ALTER TABLE adoptions
  ADD CONSTRAINT chk_return_reason_required
  CHECK (
    status <> 'returned'
    OR (
      return_reason IS NOT NULL
      AND btrim(return_reason) <> ''
    )
  );
