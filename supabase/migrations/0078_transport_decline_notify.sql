-- 0078_transport_decline_notify.sql
--
-- Notify the requester when a transport assignment is dropped.
--
-- notify_transport_assignment() (0066/0074) only notified when an assignee was
-- SET (assigned/claimed). When the assignee is CLEARED — a volunteer declines
-- their assignment, or an admin removes it (both go through
-- unassignTransportRequest: assigned_volunteer_person_id → null, status → open)
-- — nobody was told. The requester should know their volunteer dropped so they
-- can find new coverage. Mirrors the sitting "Unable to Sit" notification (0075).
--
-- This recreates the function with a leading "assignment cleared" branch. The
-- former assignee's name comes from OLD; create_notification already skips the
-- actor, so a self-decline doesn't self-notify, and if the requester themselves
-- removes the assignment they aren't notified. Idempotent; safe to re-run.

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
    select name into v_animal_name from animals where id = new.animal_id;
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
  after insert or update on transport_requests
  for each row execute function public.notify_transport_assignment();
