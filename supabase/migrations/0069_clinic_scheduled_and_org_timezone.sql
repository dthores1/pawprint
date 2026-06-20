-- 0069_clinic_scheduled_and_org_timezone.sql
-- ============================================================
-- 1. Org timezone — clinic date_time is timestamptz (stored UTC); without a
--    timezone we can't render a correct local "June 20 at 9:00 AM". Add
--    organizations.timezone (IANA, default 'UTC') and helpers that format a
--    timestamptz in the org's zone. This fixes clinic notification copy AND
--    lets the daily reminders include the local time.
-- 2. New event-based notification: when an animal is ADDED to a clinic (a
--    clinic_slots row is inserted), notify that animal's active foster
--    immediately ("Clinic Appointment Scheduled"). Real-time, unlike the daily
--    "upcoming appointment" reminder.
-- 3. Backfill local times into the daily clinic reminders (run_notification_reminders).
--
-- Idempotent DDL.
-- ============================================================

alter table organizations add column if not exists timezone text not null default 'UTC';

-- ---------- Timezone-aware formatting helpers ----------
-- "Month DD at H:MM AM" in the org's local zone (e.g. 'June 20 at 9:00 AM').
create or replace function public.notif_local_datetime(p_org uuid, p_ts timestamptz)
returns text language sql stable security definer set search_path = public as $$
  select to_char(
    p_ts at time zone coalesce((select timezone from organizations where id = p_org), 'UTC'),
    'FMMonth FMDD "at" FMHH12:MI AM'
  );
$$;

-- "H:MM AM" in the org's local zone (e.g. '9:00 AM').
create or replace function public.notif_local_time(p_org uuid, p_ts timestamptz)
returns text language sql stable security definer set search_path = public as $$
  select to_char(
    p_ts at time zone coalesce((select timezone from organizations where id = p_org), 'UTC'),
    'FMHH12:MI AM'
  );
$$;

-- ---------- Event: animal added to a clinic -> notify active foster ----------
create or replace function public.notify_clinic_slot_added()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_foster uuid;
  v_animal text;
  v_dt timestamptz;
begin
  v_foster := public.notif_active_foster_user(new.animal_id);
  if v_foster is null then return new; end if;

  select date_time into v_dt from clinic_events where id = new.clinic_event_id;
  v_animal := (select name from animals where id = new.animal_id);

  perform public.create_notification(
    new.organization_id,
    'clinic_appointment_scheduled',
    'Clinic Appointment Scheduled',
    coalesce(v_animal, 'An animal you foster')
      || ' has been scheduled for a clinic appointment on '
      || public.notif_local_datetime(new.organization_id, v_dt) || '.',
    'clinic_event', new.clinic_event_id, v_actor,
    jsonb_build_object('animal_name', v_animal, 'clinic_slot_id', new.id),
    array[v_foster]
  );
  return new;
end;
$$;

drop trigger if exists clinic_slots_notify on clinic_slots;
create trigger clinic_slots_notify
  after insert on clinic_slots
  for each row execute function public.notify_clinic_slot_added();

-- ---------- Backfill local times into the daily clinic reminders ----------
-- Full replace of 0068's scan; only the two clinic blocks change (now include
-- the local time). Transport/sitting/placement blocks are unchanged.
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
  -- Clinic: per-animal foster reminders (leads 2 & 1 days)
  for rec in
    select cs.id as slot_id, cs.animal_id, ce.id as event_id, ce.location,
           ce.date_time, ce.organization_id, (ce.date_time::date - current_date) as lead
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
        || public.notif_when_phrase(current_date + rec.lead)
        || ' at ' || public.notif_local_time(rec.organization_id, rec.date_time)
        || ' — ' || rec.location || '.',
      'clinic_event', rec.event_id,
      jsonb_build_object('animal_name', v_animal, 'location', rec.location, 'clinic_slot_id', rec.slot_id),
      'clinic_slot:' || rec.lead || 'd:' || rec.slot_id,
      array[v_foster]
    );
  end loop;

  -- Clinic: event-level reminder to creator + coordinators
  for rec in
    select ce.id as event_id, ce.organization_id, ce.location, ce.date_time,
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
        || public.notif_when_phrase(current_date + rec.lead)
        || ' at ' || public.notif_local_time(rec.organization_id, rec.date_time)
        || ' — ' || rec.n_animals
        || (case when rec.n_animals = 1 then ' animal' else ' animals' end) || ' scheduled.',
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

  -- Transport (lead 1 day)
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

  -- Sitting (lead 1 day)
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

  -- Foster placement ending soon (lead 3 days)
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
