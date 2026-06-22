-- 0073_transport_assignment.sql
--
-- Direct-assign transport requests. Until now a request was post-and-claim only:
-- created `open`, then a volunteer self-claims it. Coordinators often already
-- know who's driving, so we add a second flow where a request is assigned to a
-- specific volunteer who can accept or decline.
--
--   open      – posted, anyone may claim (unchanged)
--   assigned  – directed at one volunteer, awaiting their accept/decline (NEW)
--   accepted  – the assigned volunteer committed (NEW)
--   claimed   – a volunteer self-claimed an open request (unchanged)
--   …         – in_progress / completed / cancelled / expired (unchanged)
--
-- Assignment notifications already exist: notify_transport_assignment() (0066)
-- fires whenever assigned_volunteer_person_id changes and notifies the assignee.
-- No notification changes are needed here. Idempotent; safe to re-run.

-- ---------- 1. Status: add 'assigned' + 'accepted' ----------
-- Keep every existing value, including BOTH cancel spellings (see 0062).
alter table public.transport_requests
  drop constraint if exists transport_requests_status_check;
alter table public.transport_requests
  add constraint transport_requests_status_check check (
    status in (
      'open', 'assigned', 'accepted', 'claimed', 'in_progress',
      'completed', 'canceled', 'cancelled', 'expired'
    )
  );

-- ---------- 2. Expire past EXACT requests that nobody committed to ----------
-- An assigned request whose volunteer never accepted is, like an open one,
-- "missed" once its exact time passes — surface it for review. Committed states
-- (accepted / claimed) intentionally never auto-expire.
create or replace function public.expire_transport_requests()
returns void
language sql
as $$
  update transport_requests
  set status = 'expired',
      updated_at = now()
  where status in ('open', 'assigned')
    and schedule_type = 'exact'
    and requested_pickup_time is not null
    and requested_pickup_time < now();
$$;
