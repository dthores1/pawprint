-- Direct ("recorded directly") adoptions — support marking an animal Adopted
-- from the Edit modal without going through the application workflow, while
-- still creating an adoptions row so reporting and placement invariants hold.
--
-- 1. adopter_id becomes nullable: historical/backfilled adoptions often have an
--    unknown adopter. Display sites already fall back to "Unknown".
-- 2. source distinguishes workflow adoptions from directly-recorded ones so the
--    funnel metrics (applications, conversion, avg days) can exclude records
--    that never had an application, while completed counts include them.

ALTER TABLE adoptions ALTER COLUMN adopter_id DROP NOT NULL;

ALTER TABLE adoptions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'workflow';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'adoptions_source_check' AND conrelid = 'adoptions'::regclass
  ) THEN
    ALTER TABLE adoptions
      ADD CONSTRAINT adoptions_source_check CHECK (source IN ('workflow', 'direct'));
  END IF;
END $$;
