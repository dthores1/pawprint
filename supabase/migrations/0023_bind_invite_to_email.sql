-- Bind invite acceptance to the invited email address.
--
-- Previously accept_org_invite() let ANY authenticated user redeem a token
-- (a bearer-token model): whoever held the link could join the org with any
-- account. This re-defines the function so the signed-in user's email must
-- match the email the invite was sent to (case-insensitive). A leaked or
-- forwarded link can no longer add an unintended account to the organization.
--
-- Everything else (revoked/expired checks, idempotent membership insert,
-- marking the invite accepted) is unchanged from 0017.

create or replace function public.accept_org_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite organization_invitations;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_invite from organization_invitations where token = p_token;
  if v_invite.id is null then raise exception 'Invite not found'; end if;
  if v_invite.revoked_at is not null then raise exception 'Invite revoked'; end if;
  if v_invite.expires_at < now() then raise exception 'Invite expired'; end if;

  -- Email binding: the redeeming account must match the invited address.
  -- create_org_invite() stores the email lower(btrim(...))'d; we normalize both
  -- sides here for safety.
  select email into v_email from auth.users where id = v_uid;
  if v_email is null
     or lower(btrim(v_email)) <> lower(btrim(v_invite.email)) then
    raise exception
      'This invite was sent to %. Sign in with that email to accept it.',
      v_invite.email
      using errcode = '42501';
  end if;

  -- Idempotent: the unique (organization_id, user_id) guards against duplicates.
  insert into organization_members(organization_id, user_id, role)
    values (v_invite.organization_id, v_uid, v_invite.role)
    on conflict (organization_id, user_id) do nothing;

  if v_invite.accepted_at is null then
    update organization_invitations
      set accepted_at = now(), accepted_by = v_uid
      where id = v_invite.id;
  end if;

  return v_invite.organization_id;
end;
$$;

grant execute on function public.accept_org_invite(uuid) to authenticated;
