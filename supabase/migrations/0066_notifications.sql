-- 0066_notifications.sql
-- ============================================================
-- In-app notification system.
--
-- Split model: one canonical `notifications` row (the event + denormalized
-- copy) fans out to one `user_notification` row per recipient, so "mark read"
-- is per-user without duplicating the notification text.
--
-- Rows are created EXCLUSIVELY by the SECURITY DEFINER triggers below (the app
-- never inserts notifications directly), so there are no INSERT policies.
-- Recipients are resolved from people.user_id; people without an account
-- (user_id null) silently receive nothing. The acting user (auth.uid()) is
-- never notified about their own action.
--
-- entity_type/entity_id is the NAVIGATION TARGET (e.g. 'animal' + animal_id
-- for foster/medical/adoption events), not necessarily the source row — the
-- source row id is carried in `metadata`.
--
-- Written idempotently (project migrations are not a clean replay).
-- ============================================================

-- ---------- Tables ----------

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text not null check (
    entity_type in ('animal', 'transport_request', 'sitting_request', 'supply_request')
  ),
  entity_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists user_notification (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, recipient_user_id)
);

-- ---------- Indexes (Postgres does NOT auto-index FK columns) ----------

create index if not exists notifications_org_created_idx
  on notifications (organization_id, created_at desc);
create index if not exists notifications_entity_idx
  on notifications (entity_type, entity_id);
create index if not exists user_notification_recipient_idx
  on user_notification (recipient_user_id, read_at);
create index if not exists user_notification_notification_idx
  on user_notification (notification_id);

-- ---------- RLS ----------
-- Users only ever see their own rows. notifications is readable only when the
-- caller has a user_notification row pointing at it. The SECURITY DEFINER
-- trigger functions (owned by the migration role) bypass RLS to insert.

alter table notifications      enable row level security;
alter table user_notification  enable row level security;

drop policy if exists "recipients read notifications" on notifications;
create policy "recipients read notifications"
  on notifications for select
  using (exists (
    select 1 from user_notification un
    where un.notification_id = notifications.id
      and un.recipient_user_id = auth.uid()
  ));

drop policy if exists "users read own user_notification" on user_notification;
create policy "users read own user_notification"
  on user_notification for select
  using (recipient_user_id = auth.uid());

drop policy if exists "users update own user_notification" on user_notification;
create policy "users update own user_notification"
  on user_notification for update
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- ============================================================
-- Helpers
-- ============================================================

-- Insert one notification + a user_notification per recipient. Dedupes,
-- drops nulls, and never notifies the actor about their own action.
create or replace function public.create_notification(
  p_org uuid,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor uuid,
  p_metadata jsonb,
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
  where r is not null and r is distinct from p_actor;

  if v_recipients is null or array_length(v_recipients, 1) is null then
    return;  -- nobody to notify
  end if;

  insert into notifications (
    organization_id, type, title, body,
    entity_type, entity_id, actor_user_id, metadata
  )
  values (
    p_org, p_type, p_title, p_body,
    p_entity_type, p_entity_id, p_actor, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_notification_id;

  foreach v_recipient in array v_recipients loop
    insert into user_notification (notification_id, recipient_user_id)
    values (v_notification_id, v_recipient)
    on conflict (notification_id, recipient_user_id) do nothing;
  end loop;
end;
$$;

-- Display name of the acting user, scoped to the org (null if no people row).
create or replace function public.notif_actor_name(p_org uuid, p_actor uuid)
returns text language sql security definer stable set search_path = public as $$
  select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
  from people
  where user_id = p_actor and organization_id = p_org
  limit 1;
$$;

-- The auth user id of the current active foster for an animal (null if none /
-- the foster has no account).
create or replace function public.notif_active_foster_user(p_animal uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select p.user_id
  from foster_placements fp
  join people p on p.id = fp.person_id
  where fp.animal_id = p_animal
    and fp.placement_status = 'active'
    and fp.end_date is null
  limit 1;
$$;

-- ============================================================
-- Event triggers
-- ============================================================

-- ---------- Transport: claimed (notify requester) / assigned (notify assignee) ----------
-- Both "claim" (volunteer self-assigns) and "assign" (coordinator assigns a
-- volunteer) write assigned_volunteer_person_id. We notify the requester that
-- it's being handled AND the assignee that they're on the hook; create_notification
-- skips whichever of them is the actor (so a self-claim doesn't self-notify).
create or replace function public.notify_transport_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_requester_user uuid;
  v_assignee_user uuid;
  v_animal_name text;
  v_label text;
begin
  if new.assigned_volunteer_person_id is null
     or new.assigned_volunteer_person_id is not distinct from old.assigned_volunteer_person_id then
    return new;
  end if;

  select user_id into v_assignee_user from people where id = new.assigned_volunteer_person_id;
  select user_id into v_requester_user from people where id = new.requested_by_person_id;
  v_actor_name := public.notif_actor_name(new.organization_id, v_actor);
  select name into v_animal_name from animals where id = new.animal_id;
  v_label := coalesce(v_animal_name, 'a transport request');

  if v_requester_user is not null then
    perform public.create_notification(
      new.organization_id,
      'transport_request_claimed',
      'Transport request claimed',
      coalesce(v_actor_name, 'Someone') || ' is handling your transport request'
        || case when v_animal_name is not null then ' for ' || v_animal_name else '' end || '.',
      'transport_request', new.id, v_actor,
      jsonb_build_object('animal_name', v_animal_name, 'actor_name', v_actor_name),
      array[v_requester_user]
    );
  end if;

  if v_assignee_user is not null then
    perform public.create_notification(
      new.organization_id,
      'transport_request_assigned',
      'You were assigned a transport',
      'You were assigned to transport ' || v_label || '.',
      'transport_request', new.id, v_actor,
      jsonb_build_object('animal_name', v_animal_name, 'actor_name', v_actor_name),
      array[v_assignee_user]
    );
  end if;

  return new;
end;
$$;

drop trigger if exists transport_requests_notify on transport_requests;
create trigger transport_requests_notify
  after update on transport_requests
  for each row execute function public.notify_transport_assignment();

-- ---------- Sitting: accepted (notify requester) ----------
create or replace function public.notify_sitting_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_requester_user uuid;
begin
  if new.sitter_person_id is null
     or new.sitter_person_id is not distinct from old.sitter_person_id then
    return new;
  end if;

  select user_id into v_requester_user from people where id = new.requested_by_person_id;
  if v_requester_user is null then return new; end if;

  v_actor_name := public.notif_actor_name(new.organization_id, v_actor);
  perform public.create_notification(
    new.organization_id,
    'sitting_request_accepted',
    'Sitting request accepted',
    coalesce(v_actor_name, 'Someone') || ' accepted your sitting request.',
    'sitting_request', new.id, v_actor,
    jsonb_build_object('actor_name', v_actor_name),
    array[v_requester_user]
  );
  return new;
end;
$$;

drop trigger if exists sitting_requests_notify on sitting_requests;
create trigger sitting_requests_notify
  after update on sitting_requests
  for each row execute function public.notify_sitting_accepted();

-- ---------- Supply: status changed (notify requester) ----------
create or replace function public.notify_supply_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_requester_user uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select user_id into v_requester_user from people where id = new.requester_person_id;
  if v_requester_user is null then return new; end if;

  perform public.create_notification(
    new.organization_id,
    'supply_request_status_changed',
    'Supply request updated',
    'Your supply request status changed to ' || replace(new.status, '_', ' ') || '.',
    'supply_request', new.id, v_actor,
    jsonb_build_object('status', new.status),
    array[v_requester_user]
  );
  return new;
end;
$$;

drop trigger if exists supply_requests_notify on supply_requests;
create trigger supply_requests_notify
  after update on supply_requests
  for each row execute function public.notify_supply_status();

-- ---------- Adoption: status changed for an animal you foster ----------
create or replace function public.notify_adoption_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_foster_user uuid;
  v_animal_name text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  v_foster_user := public.notif_active_foster_user(new.animal_id);
  if v_foster_user is null then return new; end if;

  select name into v_animal_name from animals where id = new.animal_id;
  perform public.create_notification(
    new.organization_id,
    'foster_animal_adoption_status_changed',
    'Adoption update',
    'The adoption status for ' || coalesce(v_animal_name, 'an animal you foster')
      || ' changed to ' || replace(new.status, '_', ' ') || '.',
    'animal', new.animal_id, v_actor,
    jsonb_build_object('animal_name', v_animal_name, 'adoption_id', new.id, 'status', new.status),
    array[v_foster_user]
  );
  return new;
end;
$$;

drop trigger if exists adoptions_notify on adoptions;
create trigger adoptions_notify
  after insert or update on adoptions
  for each row execute function public.notify_adoption_status();

-- ---------- Medical: new record for an animal you foster ----------
create or replace function public.notify_medical_record_added()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_foster_user uuid;
  v_animal_name text;
begin
  v_foster_user := public.notif_active_foster_user(new.animal_id);
  if v_foster_user is null then return new; end if;

  select name into v_animal_name from animals where id = new.animal_id;
  perform public.create_notification(
    new.organization_id,
    'foster_animal_medical_record_added',
    'New medical record',
    'A new medical record was added for ' || coalesce(v_animal_name, 'an animal you foster') || '.',
    'animal', new.animal_id, v_actor,
    jsonb_build_object('animal_name', v_animal_name, 'medical_record_id', new.id),
    array[v_foster_user]
  );
  return new;
end;
$$;

drop trigger if exists medical_records_notify on medical_records;
create trigger medical_records_notify
  after insert on medical_records
  for each row execute function public.notify_medical_record_added();

-- ---------- Foster placement: assigned (insert) / ended (active -> closed) ----------
-- "Animal assigned to you" == a new active placement (placements are the only
-- assignment concept).
create or replace function public.notify_foster_placement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_foster_user uuid;
  v_animal_name text;
begin
  if tg_op = 'INSERT' then
    if new.placement_status <> 'active' or new.person_id is null then
      return new;
    end if;
    select user_id into v_foster_user from people where id = new.person_id;
    if v_foster_user is null then return new; end if;
    select name into v_animal_name from animals where id = new.animal_id;
    perform public.create_notification(
      new.organization_id,
      'foster_placement_assigned',
      'New foster placement',
      coalesce(v_animal_name, 'An animal') || ' was placed in your foster care.',
      'animal', new.animal_id, v_actor,
      jsonb_build_object('animal_name', v_animal_name, 'placement_id', new.id),
      array[v_foster_user]
    );

  elsif tg_op = 'UPDATE' then
    if old.placement_status = 'active'
       and new.placement_status in ('completed', 'interrupted') then
      select user_id into v_foster_user from people where id = new.person_id;
      if v_foster_user is null then return new; end if;
      select name into v_animal_name from animals where id = new.animal_id;
      perform public.create_notification(
        new.organization_id,
        'foster_placement_ended',
        'Foster placement ended',
        'Your foster placement for ' || coalesce(v_animal_name, 'an animal') || ' has ended.',
        'animal', new.animal_id, v_actor,
        jsonb_build_object('animal_name', v_animal_name, 'placement_id', new.id),
        array[v_foster_user]
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists foster_placements_notify on foster_placements;
create trigger foster_placements_notify
  after insert or update on foster_placements
  for each row execute function public.notify_foster_placement();
