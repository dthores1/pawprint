-- 0062_transport_scheduling.sql
-- Transport requests get a scheduling model so not every run needs an exact
-- time, and past time-sensitive runs auto-expire instead of lingering as Open.
--
--   schedule_type:
--     exact            – date/time required; auto-expires once the time passes
--     flexible         – optional preferred date window; never auto-expires
--     asap             – no date; stays open (sorted urgent) until claimed/closed
--     coordinate_later – no date; timing worked out with whoever claims it
--
-- Mirrors the Sitting expiration mechanism (0034): a nightly pg_cron flips past
-- open EXACT requests to 'expired'. The UI also derives this at render so a
-- missed run shows immediately.
--
-- Spelling note: the app/TS write `cancelled` (two L) but 0006 + archive_record
-- use `canceled` (one L). The recreated CHECK below accepts BOTH so the existing
-- cancel action actually persists, without disturbing archive_record (still
-- expects 'canceled'). Idempotent; safe to re-run.

-- ---------- 1. New columns ----------
alter table public.transport_requests
  add column if not exists schedule_type text not null default 'exact',
  add column if not exists preferred_window_start date,
  add column if not exists preferred_window_end date;

alter table public.transport_requests
  drop constraint if exists transport_requests_schedule_type_check;
alter table public.transport_requests
  add constraint transport_requests_schedule_type_check check (
    schedule_type in ('exact', 'flexible', 'asap', 'coordinate_later')
  );

-- ---------- 2. Exact time is no longer mandatory ----------
alter table public.transport_requests
  alter column requested_pickup_time drop not null;

-- ---------- 3. Status: add 'expired' (+ accept both cancel spellings) ----------
alter table public.transport_requests
  drop constraint if exists transport_requests_status_check;
alter table public.transport_requests
  add constraint transport_requests_status_check check (
    status in (
      'open', 'claimed', 'in_progress', 'completed',
      'canceled', 'cancelled', 'expired'
    )
  );

-- ---------- 4. Expire-on-schedule (only past, open, EXACT requests) ----------
create or replace function public.expire_transport_requests()
returns void
language sql
as $$
  update transport_requests
  set status = 'expired',
      updated_at = now()
  where status = 'open'
    and schedule_type = 'exact'
    and requested_pickup_time is not null
    and requested_pickup_time < now();
$$;

-- ---------- 5. pg_cron schedule (idempotent; mirrors 0034) ----------
do $$
begin
  perform cron.unschedule('expire-transport-requests');
exception when others then
  null;
end $$;

select cron.schedule(
  'expire-transport-requests',
  '10 0 * * *',
  $$select expire_transport_requests();$$
);