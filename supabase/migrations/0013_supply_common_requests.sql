-- 0013_supply_common_requests.sql
-- "Common requests" (reusable supply-request templates) without a new table:
-- a normal supply_request can be flagged as common, then reused to spawn a copy.
--   is_common_request           — flagged as a reusable template for its requester
--   common_request_name         — optional label (defaults from item names in UI)
--   common_request_last_used_at — bumped each time the template is reused
-- Created ad-hoc earlier; captured here for version control (guarded).

alter table supply_requests
  add column if not exists is_common_request boolean not null default false,
  add column if not exists common_request_name text,
  add column if not exists common_request_last_used_at timestamptz;

-- Speeds up the "my common requests" lookup.
create index if not exists supply_requests_common_idx
  on supply_requests (requester_person_id, is_common_request);
