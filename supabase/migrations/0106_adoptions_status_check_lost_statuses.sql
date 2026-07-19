-- 0106_adoptions_status_check_lost_statuses.sql
--
-- The live DB carries an adoptions_status_check CHECK constraint that exists
-- in no migration file (added manually in the Supabase GUI — 0029 assumed no
-- CHECK enforced adoptions.status). It still allows only the pre-0105
-- vocabulary, so closing an adoption as rejected / cancelled_by_applicant /
-- duplicate fails with a constraint violation. Replace it with the full list.
--
-- Note: if the constraint made any of 0105's remap UPDATEs fail, that whole
-- transaction rolled back — re-run 0105 after this (it's idempotent). The
-- remap is repeated here anyway so this file alone converges the data.

BEGIN;

ALTER TABLE adoptions DROP CONSTRAINT IF EXISTS adoptions_status_check;
ALTER TABLE adoptions ADD CONSTRAINT adoptions_status_check
  CHECK (status IN (
    'inquiry',
    'application_submitted',
    'meet_and_greet',
    'pending_paperwork',
    'ready_for_placement',
    'completed',
    'rejected',
    'cancelled_by_applicant',
    'duplicate',
    'cancelled',
    'returned'
  ));

-- Same remap as 0105 §1 (no-ops once converged).
UPDATE adoptions SET status = 'rejected'
  WHERE status = 'cancelled' AND cancelled_reason = 'application_rejected';
UPDATE adoptions SET status = 'cancelled_by_applicant'
  WHERE status = 'cancelled'
    AND cancelled_reason IN ('applicant_withdrew', 'no_response');
UPDATE adoptions SET status = 'duplicate'
  WHERE status = 'cancelled' AND cancelled_reason = 'duplicate_application';

COMMIT;
