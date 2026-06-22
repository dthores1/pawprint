-- 0074_transport_assign_notify_on_insert.sql
--
-- Fix: assigning a volunteer AT CREATION TIME did not notify them.
--
-- notify_transport_assignment() (0066) fired only AFTER UPDATE. When a request
-- is created already directed at a volunteer (the "Assign to volunteer" option
-- on the new-request form), the row is INSERTed with assigned_volunteer_person_id
-- already set, so the update-only trigger never ran and the assignee got nothing.
--
-- This recreates the function to handle INSERT as well as UPDATE, and fires the
-- trigger AFTER INSERT OR UPDATE. On UPDATE we still only notify when the
-- assignee actually changes (so unrelated edits don't re-notify); on INSERT we
-- notify whenever the new row already has an assignee. Idempotent; safe to re-run.

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
  -- Only act when there's an assignee, and (on UPDATE) only when it changed.
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
