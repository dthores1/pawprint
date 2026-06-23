-- 0076_transport_sitting_link.sql
--
-- Link a transport request back to the sitting request that prompted it.
--
-- Sitting requests have a "Transport help needed to get to sitter" flag
-- (sitting_requests.transport_needed). When a coordinator arranges that ride we
-- create a normal transport request and tag it with the sitting request's id, so
-- the sitting card can show "Transport requested" (and not offer to create a
-- duplicate). Mirrors the existing supply_request_id / clinic_event_id links on
-- transport_requests. on delete set null keeps the transport if the sitting
-- request is later removed. Idempotent; safe to re-run.

alter table public.transport_requests
  add column if not exists sitting_request_id uuid
    references public.sitting_requests(id) on delete set null;

create index if not exists transport_requests_sitting_request_id_idx
  on public.transport_requests (sitting_request_id);
