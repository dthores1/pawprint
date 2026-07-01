-- 0088_sitting_cancel_notify.sql
--
-- When a requester cancels a sitting request that a sitter has already accepted,
-- the sitter should be told their commitment is off — otherwise they only find
-- out by stumbling back onto the (now-gone) request.
--
-- Fires on the transition INTO 'cancelled' when there was an accepted sitter
-- (old.sitter_person_id set). The recipient is that sitter; the body names the
-- requester (canCancel is requester-only in the UI, but we look the requester up
-- explicitly so the copy is right regardless of who performed the update).
--
-- This is a SEPARATE trigger from sitting_requests_notify / notify_sitting_accepted
-- (0075), which early-returns when the sitter is unchanged (as on a cancel) and so
-- never covers this case. create_notification skips the actor as a recipient and
-- 'sitting_request' entity_type routes to /requests?tab=sitting. Idempotent.

create or replace function public.notify_sitting_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_sitter_user uuid;
  v_requester_name text;
begin
  -- Only when the request transitions INTO cancelled...
  if not (new.status = 'cancelled' and old.status is distinct from 'cancelled') then
    return new;
  end if;
  -- ...and a sitter had actually accepted it (nobody to tell otherwise).
  if old.sitter_person_id is null then
    return new;
  end if;

  select user_id into v_sitter_user from people where id = old.sitter_person_id;
  if v_sitter_user is null then return new; end if;  -- sitter has no account

  select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
    into v_requester_name
    from people where id = new.requested_by_person_id;

  perform public.create_notification(
    new.organization_id,
    'sitting_request_cancelled',
    'Sitting Request Cancelled',
    coalesce(v_requester_name, 'The requester') ||
      ' no longer needs coverage and has cancelled the sitting request you accepted.',
    'sitting_request', new.id, v_actor,
    jsonb_build_object('requester_name', v_requester_name),
    array[v_sitter_user]
  );

  return new;
end;
$$;

drop trigger if exists sitting_requests_cancel_notify on sitting_requests;
create trigger sitting_requests_cancel_notify
  after update on sitting_requests
  for each row execute function public.notify_sitting_cancelled();
