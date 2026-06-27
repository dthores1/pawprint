-- 0085_transport_request_animals.sql
--
-- Transport requests move from a single animal_id to a multi-animal child table
-- (parity with sitting_request_placements). The legacy transport_requests.animal_id
-- column is DROPPED; every reader now uses transport_request_animals.
--
-- The notification triggers (0074/0077/0078) named the animal via animal_id. They
-- are rewritten to aggregate the child animals' names through a new
-- transport_animal_names() helper. The insert-time assignment notification no
-- longer depends on animal_id: the app inserts the parent unassigned, inserts the
-- child animals, then sets the assignee via an UPDATE — so the child rows exist
-- when notify_transport_assignment() fires for the assignment.
--
-- Idempotent / guarded. Functions are recreated BEFORE the column is dropped so
-- nothing references the column at drop time.

-- 1. Child table -----------------------------------------------------------
create table if not exists public.transport_request_animals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transport_request_id uuid not null references public.transport_requests(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists transport_request_animals_req_animal_key
  on public.transport_request_animals (transport_request_id, animal_id);
create index if not exists transport_request_animals_animal_idx
  on public.transport_request_animals (animal_id);

alter table public.transport_request_animals enable row level security;
drop policy if exists "org members manage transport request animals" on public.transport_request_animals;
create policy "org members manage transport request animals"
  on public.transport_request_animals
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 2. Backfill from the existing single animal_id ---------------------------
insert into public.transport_request_animals (organization_id, transport_request_id, animal_id)
select tr.organization_id, tr.id, tr.animal_id
from public.transport_requests tr
where tr.animal_id is not null
on conflict (transport_request_id, animal_id) do nothing;

-- 3. Helper: comma-joined animal names for a transport (NULL when none) -----
create or replace function public.transport_animal_names(p_transport_request_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select string_agg(a.name, ', ' order by a.name)
  from public.transport_request_animals tra
  join public.animals a on a.id = tra.animal_id
  where tra.transport_request_id = p_transport_request_id;
$$;

-- 4. Rewrite notify_transport_assignment() to aggregate child animal names --
--    (Mirrors 0078 exactly except the three animal-name lookups now go through
--    transport_animal_names(new.id).)
create or replace function public.notify_transport_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_requester_user uuid;
  v_assignee_user uuid;
  v_former_name text;
  v_animal_name text;
  v_label text;
begin
  -- Case A: assignment cleared (volunteer declined, or admin removed it).
  if tg_op = 'UPDATE'
     and old.assigned_volunteer_person_id is not null
     and new.assigned_volunteer_person_id is null then
    select user_id into v_requester_user from people where id = new.requested_by_person_id;
    if v_requester_user is null then return new; end if;
    v_former_name := public.notif_person_name(old.assigned_volunteer_person_id);
    v_animal_name := public.transport_animal_names(new.id);
    perform public.create_notification(
      new.organization_id,
      'transport_request_unassigned',
      'Transport volunteer dropped',
      coalesce(v_former_name, 'A volunteer') || ' is no longer assigned to your transport request'
        || case when v_animal_name is not null then ' for ' || v_animal_name else '' end
        || '. It’s open again for someone to claim.',
      'transport_request', new.id, v_actor,
      jsonb_build_object('animal_name', v_animal_name, 'former_assignee', v_former_name),
      array[v_requester_user]
    );
    return new;
  end if;

  -- Case B: assignment set/changed — notify the requester + the new assignee.
  if new.assigned_volunteer_person_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.assigned_volunteer_person_id is not distinct from old.assigned_volunteer_person_id then
    return new;
  end if;

  select user_id into v_assignee_user from people where id = new.assigned_volunteer_person_id;
  select user_id into v_requester_user from people where id = new.requested_by_person_id;
  v_actor_name := public.notif_actor_name(new.organization_id, v_actor);
  v_animal_name := public.transport_animal_names(new.id);
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

-- 5. Rewrite run_stale_transport_reminders() to aggregate child animal names -
create or replace function public.run_stale_transport_reminders()
returns void
language plpgsql security definer set search_path = public as $run$
declare
  rec record;
  v_animal text;
  v_label text;
begin
  for rec in
    select tr.id, tr.organization_id, tr.requested_by_person_id,
           (tr.requested_pickup_time::date) as eff_date,
           (current_date - tr.requested_pickup_time::date) as days_past
    from transport_requests tr
    where tr.is_deleted = false
      and tr.schedule_type = 'exact'
      and tr.requested_pickup_time is not null
      and tr.status not in ('completed', 'cancelled', 'canceled')
      and (current_date - tr.requested_pickup_time::date) in (0, 1, 7, 30)
  loop
    v_animal := public.transport_animal_names(rec.id);
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

-- 6. Drop the legacy column (now unreferenced) -----------------------------
alter table public.transport_requests drop column if exists animal_id;
