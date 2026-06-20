-- 0070_pacific_default_and_hourly_reminders.sql
-- ============================================================
-- 1. Default new orgs to Pacific (most of our orgs are US West Coast), and
--    backfill orgs still on the old 'UTC' default — they hadn't set one yet,
--    and UTC was producing wrong clinic times.
-- 2. Run the reminder scan hourly instead of once daily, so same-day-created
--    events (e.g. a clinic added this afternoon for tomorrow) get picked up
--    within the hour. Safe to over-run: the dedupe_key still guarantees each
--    reminder is created exactly once.
--
-- Idempotent.
-- ============================================================

alter table organizations alter column timezone set default 'America/Los_Angeles';

-- Backfill orgs left on the previous default. (An org that genuinely wants UTC
-- can re-select it on Settings → General.)
update organizations set timezone = 'America/Los_Angeles' where timezone = 'UTC';

-- Reschedule the reminder job: hourly (mirrors the 0034/0062 idiom).
do $$
begin
  perform cron.unschedule('notification-reminders');
exception when others then
  null;
end $$;

select cron.schedule(
  'notification-reminders',
  '0 * * * *',
  $$select public.run_notification_reminders();$$
);
