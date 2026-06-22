-- 0075_sitting_release_notify.sql
--
-- "Unable to Sit": when an accepted sitter backs out, the request is reopened
-- (sitter_person_id cleared, status → open) and the requester should be told
-- their coverage fell through.
--
-- notify_sitting_accepted() (0066) only fired when sitter_person_id changed to a
-- NON-null value, so clearing it was silent. This recreates the function to
-- handle both directions on UPDATE:
--   * sitter set / changed  → "X accepted your sitting request" (unchanged)
--   * sitter cleared          → "X can no longer cover your sitting request"
-- create_notification already skips the actor (so the withdrawing sitter doesn't
-- self-notify) and sitting_request routes to /requests?tab=sitting. The trigger
-- stays AFTER UPDATE. Idempotent; safe to re-run.

create or replace function public.notify_sitting_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_requester_user uuid;
begin
  -- Only act when the sitter actually changes.
  if new.sitter_person_id is not distinct from old.sitter_person_id then
    return new;
  end if;

  select user_id into v_requester_user from people where id = new.requested_by_person_id;
  if v_requester_user is null then return new; end if;

  v_actor_name := public.notif_actor_name(new.organization_id, v_actor);

  if new.sitter_person_id is not null then
    -- Accepted (or reassigned to a new sitter).
    perform public.create_notification(
      new.organization_id,
      'sitting_request_accepted',
      'Sitting request accepted',
      coalesce(v_actor_name, 'Someone') || ' accepted your sitting request.',
      'sitting_request', new.id, v_actor,
      jsonb_build_object('actor_name', v_actor_name),
      array[v_requester_user]
    );
  else
    -- Sitter backed out → request is open again.
    perform public.create_notification(
      new.organization_id,
      'sitting_request_sitter_withdrew',
      'Sitter unavailable',
      coalesce(v_actor_name, 'Your sitter') ||
        ' can no longer cover your sitting request — it''s open again for someone else to accept.',
      'sitting_request', new.id, v_actor,
      jsonb_build_object('actor_name', v_actor_name),
      array[v_requester_user]
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sitting_requests_notify on sitting_requests;
create trigger sitting_requests_notify
  after update on sitting_requests
  for each row execute function public.notify_sitting_accepted();
