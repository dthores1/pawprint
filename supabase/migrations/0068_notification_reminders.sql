-- 0068_notification_reminders.sql
-- ============================================================
-- Time-based ("reminder") notifications: a daily pg_cron job scans for upcoming
-- events crossing a lead-time threshold and emits notifications once.
--
-- Complements the reactive triggers in 0066/0067 (which fire when a row CHANGES);
-- reminders fire because a scheduled date is approaching, when nothing changed.
--
-- Design:
--   * Daily cron, CALENDAR-DAY buckets (UTC) — find events on current_date + N,
--     so copy ("tomorrow", "in 2 days", "in 3 days") is exact.
--   * Idempotent via notifications.dedupe_key (unique) + on-conflict-do-nothing,
--     so the job can run repeatedly and each reminder is sent exactly once.
--   * Date-granularity copy (no clock time) — date_time is timestamptz with no
--     org timezone stored, so a correct local "9:00 AM" isn't derivable yet.
--     Clinic copy uses date + location instead. (Follow-up: org timezone.)
--   * Lead times hardcoded here (per decision). Reuses create_notification's
--     fan-out shape and notif_active_foster_user() from 0066.
--
-- Idempotent DDL (project migrations are not a clean replay).
-- ============================================================

-- ---------- Schema: dedupe key + clinic_event navigation target ----------

alter table notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_key_idx
  on notifications (dedupe_key) where dedupe_key is not null;

alter table notifications drop constraint if exists notifications_entity_type_check;
alter table notifications add constraint notifications_entity_type_check
  check (entity_type in ('animal', 'transport_request', 'sitting_request', 'supply_request', 'clinic_event'));

-- ============================================================
-- Helpers
-- ============================================================

-- Insert a single notification keyed by dedupe_key (idempotent) and fan out to
-- recipients. System-generated (no actor). Returns without inserting if there
-- are no recipients, so we never burn a dedupe key on a no-op.
create or replace function public.create_scheduled_notification(
  p_org uuid,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb,
  p_dedupe_key text,
  p_recipient_user_ids uuid[]
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_notification_id uuid;
  v_recipient uuid;
  v_recipients uuid[];
begin
  select array_agg(distinct r) into v_recipients
  from unnest(p_recipient_user_ids) as r
  where r is not null;

  if v_recipients is null or array_length(v_recipients, 1) is null then
    return;  -- nobody to notify
  end if;

  insert into notifications (
    organization_id, type, title, body,
    entity_type, entity_id, actor_user_id, metadata, dedupe_key
  )
  values (
    p_org, p_type, p_title, p_body,
    p_entity_type, p_entity_id, null, coalesce(p_metadata, '{}'::jsonb), p_dedupe_key
  )
  on conflict (dedupe_key) do nothing
  returning id into v_notification_id;

  if v_notification_id is null then
    return;  -- already sent this reminder
  end if;

  foreach v_recipient in array v_recipients loop
    insert into user_notification (notification_id, recipient_user_id)
    values (v_notification_id, v_recipient)
    on conflict (notification_id, recipient_user_id) do nothing;
  end loop;
end;
$$;

create or replace function public.notif_person_user(p_person uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select user_id from people where id = p_person;
$$;

create or replace function public.notif_person_name(p_person uuid)
returns text language sql security definer stable set search_path = public as $$
  select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
  from people where id = p_person;
$$;

-- 'today' / 'tomorrow' / 'in N days' relative to the current (UTC) date.
create or replace function public.notif_when_phrase(p_date date)
returns text language sql immutable as $$
  select case
    when p_date - current_date = 0 then 'today'
    when p_date - current_date = 1 then 'tomorrow'
    else 'in ' || (p_date - current_date) || ' days'
  end;
$$;

-- ============================================================
-- The daily scan
-- ============================================================

create or replace function public.run_notification_reminders()
returns void
language plpgsql security definer set search_path = public as $run$
declare
  rec record;
  v_foster uuid;
  v_animal text;
  v_when text;
  v_req_name text;
  v_vol_name text;
  v_sitter_name text;
begin
  -- ---------- Clinic: per-animal foster reminders (leads 2 & 1 days) ----------
  for rec in
    select cs.id as slot_id, cs.animal_id, ce.id as event_id, ce.location,
           ce.organization_id, (ce.date_time::date - current_date) as lead
    from clinic_slots cs
    join clinic_events ce on ce.id = cs.clinic_event_id
    where ce.date_time::date in (current_date + 1, current_date + 2)
      and cs.status in ('reserved', 'confirmed')
      and ce.status not in ('cancelled', 'canceled', 'completed')
      and cs.is_deleted = false
      and ce.is_deleted = false
  loop
    v_foster := public.notif_active_foster_user(rec.animal_id);
    if v_foster is null then continue; end if;
    v_animal := (select name from animals where id = rec.animal_id);
    perform public.create_scheduled_notification(
      rec.organization_id,
      'clinic_appointment_reminder',
      'Upcoming Clinic Appointment',
      coalesce(v_animal, 'An animal you foster') || ' has a clinic appointment '
        || public.notif_when_phrase(current_date + rec.lead) || ' at ' || rec.location || '.',
      'clinic_event', rec.event_id,
      jsonb_build_object('animal_name', v_animal, 'location', rec.location, 'clinic_slot_id', rec.slot_id),
      'clinic_slot:' || rec.lead || 'd:' || rec.slot_id,
      array[v_foster]
    );
  end loop;

  -- ---------- Clinic: event-level reminder to creator + coordinators ----------
  for rec in
    select ce.id as event_id, ce.organization_id, ce.location,
           (ce.date_time::date - current_date) as lead,
           ce.reserved_by_person_id, ce.transport_coordinator_person_id,
           ce.intake_coordinator_person_id,
           (select count(*) from clinic_slots cs
            where cs.clinic_event_id = ce.id
              and cs.status in ('reserved', 'confirmed')
              and cs.is_deleted = false) as n_animals
    from clinic_events ce
    where ce.date_time::date in (current_date + 1, current_date + 2)
      and ce.status not in ('cancelled', 'canceled', 'completed')
      and ce.is_deleted = false
  loop
    if rec.n_animals = 0 then continue; end if;
    perform public.create_scheduled_notification(
      rec.organization_id,
      'clinic_event_reminder',
      'Upcoming Clinic',
      'Your clinic at ' || rec.location || ' is '
        || public.notif_when_phrase(current_date + rec.lead) || ' — '
        || rec.n_animals || (case when rec.n_animals = 1 then ' animal' else ' animals' end)
        || ' scheduled.',
      'clinic_event', rec.event_id,
      jsonb_build_object('location', rec.location, 'animal_count', rec.n_animals),
      'clinic_event:' || rec.lead || 'd:' || rec.event_id,
      array[
        public.notif_person_user(rec.reserved_by_person_id),
        public.notif_person_user(rec.transport_coordinator_person_id),
        public.notif_person_user(rec.intake_coordinator_person_id)
      ]
    );
  end loop;

  -- ---------- Transport (lead 1 day) ----------
  for rec in
    select tr.id, tr.organization_id, tr.animal_id, tr.status,
           tr.requested_by_person_id, tr.assigned_volunteer_person_id,
           (case when tr.schedule_type = 'exact' then tr.requested_pickup_time::date
                 else tr.preferred_window_start end) as eff_date
    from transport_requests tr
    where tr.status in ('open', 'claimed', 'in_progress')
      and tr.is_deleted = false
      and (
        (tr.schedule_type = 'exact' and tr.requested_pickup_time is not null
          and tr.requested_pickup_time::date = current_date + 1)
        or (tr.schedule_type = 'flexible' and tr.preferred_window_start = current_date + 1)
      )
  loop
    v_animal := (select name from animals where id = rec.animal_id);
    v_when := public.notif_when_phrase(rec.eff_date);
    if rec.assigned_volunteer_person_id is not null then
      v_req_name := coalesce(public.notif_person_name(rec.requested_by_person_id), 'the requester');
      perform public.create_scheduled_notification(
        rec.organization_id, 'transport_reminder_volunteer', 'Upcoming Transport',
        case when v_animal is not null
          then 'You have agreed to transport ' || v_animal || ' ' || v_when || ' for ' || v_req_name || '.'
          else 'You have a transport scheduled ' || v_when || ' for ' || v_req_name || '.' end,
        'transport_request', rec.id, jsonb_build_object('animal_name', v_animal),
        'transport:vol:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.assigned_volunteer_person_id)]
      );
      v_vol_name := coalesce(public.notif_person_name(rec.assigned_volunteer_person_id), 'a volunteer');
      perform public.create_scheduled_notification(
        rec.organization_id, 'transport_reminder_requester', 'Upcoming Transport',
        case when v_animal is not null
          then v_animal || '''s transport is scheduled for ' || v_when || ' and will be completed by ' || v_vol_name || '.'
          else 'Your transport request is scheduled for ' || v_when || ' and will be completed by ' || v_vol_name || '.' end,
        'transport_request', rec.id, jsonb_build_object('animal_name', v_animal),
        'transport:req:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    elsif rec.status = 'open' then
      perform public.create_scheduled_notification(
        rec.organization_id, 'transport_reminder_unaccepted', 'Transport Still Needs Volunteer',
        'Your transport request scheduled for ' || v_when
          || ' has not yet been accepted. Additional coordination may be needed.',
        'transport_request', rec.id, jsonb_build_object('animal_name', v_animal),
        'transport:unaccepted:' || rec.id || ':' || rec.eff_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    end if;
  end loop;

  -- ---------- Sitting (lead 1 day) ----------
  for rec in
    select sr.id, sr.organization_id, sr.status, sr.start_date,
           sr.requested_by_person_id, sr.sitter_person_id
    from sitting_requests sr
    where sr.status in ('open', 'claimed', 'in_progress')
      and sr.is_deleted = false
      and sr.start_date = current_date + 1
  loop
    v_when := public.notif_when_phrase(rec.start_date);
    if rec.sitter_person_id is not null then
      v_req_name := coalesce(public.notif_person_name(rec.requested_by_person_id), 'the requester');
      perform public.create_scheduled_notification(
        rec.organization_id, 'sitting_reminder_volunteer', 'Upcoming Sitting Assignment',
        'You are scheduled to sit for ' || v_req_name || ' beginning ' || v_when || '.',
        'sitting_request', rec.id, '{}'::jsonb,
        'sitting:vol:' || rec.id || ':' || rec.start_date,
        array[public.notif_person_user(rec.sitter_person_id)]
      );
      v_sitter_name := coalesce(public.notif_person_name(rec.sitter_person_id), 'a sitter');
      perform public.create_scheduled_notification(
        rec.organization_id, 'sitting_reminder_requester', 'Upcoming Sitting Assignment',
        'Your sitting request begins ' || v_when || ' and will be handled by ' || v_sitter_name || '.',
        'sitting_request', rec.id, '{}'::jsonb,
        'sitting:req:' || rec.id || ':' || rec.start_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    elsif rec.status = 'open' then
      perform public.create_scheduled_notification(
        rec.organization_id, 'sitting_reminder_unaccepted', 'Sitting Request Still Needs Volunteer',
        'Your sitting request begins ' || v_when
          || ' and has not yet been accepted. Additional coordination may be needed.',
        'sitting_request', rec.id, '{}'::jsonb,
        'sitting:unaccepted:' || rec.id || ':' || rec.start_date,
        array[public.notif_person_user(rec.requested_by_person_id)]
      );
    end if;
  end loop;

  -- ---------- Foster placement ending soon (lead 3 days) ----------
  for rec in
    select fp.id, fp.organization_id, fp.animal_id, fp.person_id, fp.expected_end_date
    from foster_placements fp
    where fp.placement_status = 'active'
      and fp.end_date is null
      and fp.expected_end_date = current_date + 3
      and fp.is_deleted = false
  loop
    v_animal := (select name from animals where id = rec.animal_id);
    perform public.create_scheduled_notification(
      rec.organization_id, 'foster_placement_ending', 'Foster Placement Ending Soon',
      coalesce(v_animal, 'An animal') || '''s foster placement is scheduled to end '
        || public.notif_when_phrase(rec.expected_end_date) || '.',
      'animal', rec.animal_id,
      jsonb_build_object('animal_name', v_animal, 'placement_id', rec.id),
      'placement_ending:' || rec.id || ':' || rec.expected_end_date,
      array[public.notif_person_user(rec.person_id)]
    );
  end loop;
end;
$run$;

-- ---------- pg_cron schedule (idempotent; mirrors 0034 / 0062) ----------
do $$
begin
  perform cron.unschedule('notification-reminders');
exception when others then
  null;
end $$;

select cron.schedule(
  'notification-reminders',
  '0 13 * * *',
  $$select public.run_notification_reminders();$$
);
