-- 0079_sitting_stale_reminders.sql
--
-- Stale-request nudges for sitting requests — the sitting parallel to the
-- transport stale reminders (0077). Past-dated requests that were never closed
-- pile up; we do NOT auto-complete/cancel (recording unconfirmed coverage is
-- dangerous) — instead we remind the requester to review/close.
--
-- Anchored to the COVERAGE END date (end_date, falling back to start_date): a
-- sit is a multi-day window, so "please review and close" only makes sense once
-- the window is over. (The "begins tomorrow" reminder in 0068 already covers the
-- start side.) For sits whose end date has passed without being completed/
-- cancelled, the requester gets nudged on the end day and +1 / +7 / +30 days,
-- each exactly once via the create_scheduled_notification dedupe_key. Idempotent.

create or replace function public.run_stale_sitting_reminders()
returns void
language plpgsql security definer set search_path = public as $run$
declare
  rec record;
begin
  for rec in
    select sr.id, sr.organization_id, sr.requested_by_person_id,
           coalesce(sr.end_date, sr.start_date) as eff_date,
           (current_date - coalesce(sr.end_date, sr.start_date)) as days_past
    from sitting_requests sr
    where sr.is_deleted = false
      and sr.status not in ('completed', 'cancelled', 'canceled')
      and (current_date - coalesce(sr.end_date, sr.start_date)) in (0, 1, 7, 30)
  loop
    if rec.days_past = 0 then
      perform public.create_scheduled_notification(
        rec.organization_id, 'sitting_review_due',
        'Sitting Coverage Ends Today',
        'Your sitting request’s coverage ends today. Once it’s complete, please review and close the request.',
        'sitting_request', rec.id, '{}'::jsonb,
        'sitting:review:0:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    elsif rec.days_past = 1 then
      perform public.create_scheduled_notification(
        rec.organization_id, 'sitting_review_overdue_1',
        'Sitting Awaiting Review',
        'Your sitting request is still awaiting review. Please confirm whether the coverage was completed.',
        'sitting_request', rec.id, '{}'::jsonb,
        'sitting:review:1:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    elsif rec.days_past = 7 then
      perform public.create_scheduled_notification(
        rec.organization_id, 'sitting_review_overdue_7',
        'Sitting Awaiting Review',
        'Your sitting request has been awaiting review for 7 days. Please review the request or update its status.',
        'sitting_request', rec.id, '{}'::jsonb,
        'sitting:review:7:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    elsif rec.days_past = 30 then
      perform public.create_scheduled_notification(
        rec.organization_id, 'sitting_review_overdue_30',
        'Sitting Awaiting Review',
        'Your sitting request has been awaiting review for 30 days. Please review or close it.',
        'sitting_request', rec.id, '{}'::jsonb,
        'sitting:review:30:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    end if;
  end loop;
end;
$run$;

-- ---------- pg_cron schedule (idempotent; mirrors 0077) ----------
do $$
begin
  perform cron.unschedule('stale-sitting-reminders');
exception when others then
  null;
end $$;

select cron.schedule(
  'stale-sitting-reminders',
  '15 13 * * *',
  $$select public.run_stale_sitting_reminders();$$
);
