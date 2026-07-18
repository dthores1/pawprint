-- 0103_adoption_cancelled_reason.sql
-- "Close Adoption" outcomes: closing an adoption unsuccessfully now records a
-- structured reason (mirrors return_reason from 0029). The app constrains the
-- value to a fixed vocabulary (applicant_withdrew, application_rejected,
-- no_response, duplicate_application, other); existing cancelled rows predate
-- the field and stay NULL. Successful closes remain status='completed'.

ALTER TABLE adoptions
  ADD COLUMN IF NOT EXISTS cancelled_reason text;
