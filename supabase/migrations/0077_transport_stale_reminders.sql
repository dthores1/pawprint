-- 0077_transport_stale_reminders.sql
--
-- Stale-request nudges for transport requests. Past-dated requests never get
-- closed, so they pile up at the top of lists and pollute dashboards. We do NOT
-- auto-complete or auto-cancel (recording a business event nobody confirmed is
-- dangerous) — instead we remind the requester to review/close, and let the UI
-- show an "awaiting review" badge.
--
-- A separate daily cron (kept out of run_notification_reminders to avoid
-- rewriting that whole function) emits, for EXACT-scheduled transports whose
-- pickup date has passed without completion:
--   * day-of   (eff = today)        — "scheduled for today, please review/close once complete"
--   * +1 day                        — "still awaiting review, confirm whether completed"
--   * +7 days                       — "awaiting review for 7 days"
--   * +30 days                      — "awaiting review for 30 days"
-- Recipient = the requester. Each reminder fires exactly once via the
-- create_scheduled_notification dedupe_key (0068). Flexible / asap /
-- coordinate_later are soft by design and intentionally excluded. Idempotent.

create or replace function public.run_stale_transport_reminders()
returns void
language plpgsql security definer set search_path = public as $run$
declare
  rec record;
  v_animal text;
  v_label text;
begin
  for rec in
    select tr.id, tr.organization_id, tr.animal_id, tr.requested_by_person_id,
           (tr.requested_pickup_time::date) as eff_date,
           (current_date - tr.requested_pickup_time::date) as days_past
    from transport_requests tr
    where tr.is_deleted = false
      and tr.schedule_type = 'exact'
      and tr.requested_pickup_time is not null
      and tr.status not in ('completed', 'cancelled', 'canceled')
      and (current_date - tr.requested_pickup_time::date) in (0, 1, 7, 30)
  loop
    v_animal := (select name from animals where id = rec.animal_id);
    v_label := coalesce(v_animal, 'a transport request');

    if rec.days_past = 0 then
      perform public.create_scheduled_notification(
        rec.organization_id, 'transport_review_due',
        'Transport Scheduled Today',
        'Your transport request for ' || v_label
          || ' was scheduled for today. Once the transport is complete, please review and close the request.',
        'transport_request', rec.id,
        jsonb_build_object('animal_name', v_animal),
        'transport:review:0:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    elsif rec.days_past = 1 then
      perform public.create_scheduled_notification(
        rec.organization_id, 'transport_review_overdue_1',
        'Transport Awaiting Review',
        'Your transport request for ' || v_label
          || ' is still awaiting review. Please confirm whether the transport was completed.',
        'transport_request', rec.id,
        jsonb_build_object('animal_name', v_animal),
        'transport:review:1:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    elsif rec.days_past = 7 then
      perform public.create_scheduled_notification(
        rec.organization_id, 'transport_review_overdue_7',
        'Transport Awaiting Review',
        'Your transport request for ' || v_label
          || ' has been awaiting review for 7 days. Please review the request or update its status.',
        'transport_request', rec.id,
        jsonb_build_object('animal_name', v_animal),
        'transport:review:7:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    elsif rec.days_past = 30 then
      perform public.create_scheduled_notification(
        rec.organization_id, 'transport_review_overdue_30',
        'Transport Awaiting Review',
        'Your transport request for ' || v_label
          || ' has been awaiting review for 30 days. Please review or close it.',
        'transport_request', rec.id,
        jsonb_build_object('animal_name', v_animal),
        'transport:review:30:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    end if;
  end loop;
end;
$run$;

-- ---------- pg_cron schedule (idempotent; mirrors 0068) ----------
do $$
begin
  perform cron.unschedule('stale-transport-reminders');
exception when others then
  null;
end $$;

select cron.schedule(
  'stale-transport-reminders',
  '10 13 * * *',
  $$select public.run_stale_transport_reminders();$$
);
