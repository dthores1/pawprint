-- 0019_supply_status_simplification.sql
-- Collapse the supply-request lifecycle to four states. The previous flow
-- (submitted → reviewing → approved → ordered → ready_for_pickup → delivered
-- → completed → canceled) had too much overlap; the new flow is just:
--
--   submitted   (initial)
--   in_progress (someone is sourcing/ordering)
--   fulfilled   (received / handed off / done)
--   cancelled   (terminal, won't be filled)
--
-- Pickup vs. shipping vs. delivery are fulfillment details, not statuses.

BEGIN;

-- 1. Remap existing rows to the new vocabulary before re-tightening the CHECK.
UPDATE supply_requests SET status = 'in_progress'
  WHERE status IN ('reviewing', 'approved', 'ordered');
UPDATE supply_requests SET status = 'fulfilled'
  WHERE status IN ('ready_for_pickup', 'delivered', 'completed');
UPDATE supply_requests SET status = 'cancelled'
  WHERE status = 'canceled';

-- 2. Swap the CHECK to the new set.
ALTER TABLE supply_requests
  DROP CONSTRAINT IF EXISTS supply_requests_status_check;
ALTER TABLE supply_requests
  ADD CONSTRAINT supply_requests_status_check
  CHECK (status IN ('submitted', 'in_progress', 'fulfilled', 'cancelled'));

COMMIT;