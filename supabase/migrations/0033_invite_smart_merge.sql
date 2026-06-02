-- 0033_invite_smart_merge.sql
-- When an invite is accepted, claim an existing org-contact `people` row
-- by email if one is there. Prevents the duplicate-person problem when a
-- foster (or any other contact) is first tracked in `people` and later
-- invited to join the org — there's now one row for that person, with
-- `user_id` set.
--
-- Behaviour:
--   * If the redeeming user already has a self-record in this org
--     (user_id matches), do nothing here — the existing AuthContext
--     pendingInviteRoles merge handles role updates.
--   * Otherwise, find the EARLIEST unclaimed `people` row with a matching
--     email in this org (case-insensitive on btrim) and set its `user_id`.
--     AuthContext's find-or-create then resolves to that row by `user_id`
--     and the contact + self records become one.
--
-- Everything else from 0023_bind_invite_to_email.sql is preserved:
--   * Auth user's email must match the invite (email binding)
--   * Idempotent organization_members insert
--   * Marks the invite accepted
--
-- Idempotent — replaces accept_org_invite.

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
  v_self_exists boolean;
  v_contact_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_invite from organization_invitations where token = p_token;
  if v_invite.id is null then raise exception 'Invite not found'; end if;
  if v_invite.revoked_at is not null then raise exception 'Invite revoked'; end if;
  if v_invite.expires_at < now() then raise exception 'Invite expired'; end if;

  -- Email binding (from 0023): the redeeming account must match the invited
  -- address. We compare lowercased + trimmed on both sides.
  select email into v_email from auth.users where id = v_uid;
  if v_email is null
     or lower(btrim(v_email)) <> lower(btrim(v_invite.email)) then
    raise exception
      'This invite was sent to %. Sign in with that email to accept it.',
      v_invite.email
      using errcode = '42501';
  end if;

  -- Smart merge: if there's already a contact row for this email in the org
  -- and the inviter has no self-record yet, claim the contact row by setting
  -- its user_id. Skipped when a self-record already exists (don't try to
  -- destructively merge two rows).
  select exists(
    select 1 from people
    where organization_id = v_invite.organization_id and user_id = v_uid
  ) into v_self_exists;

  if not v_self_exists then
    select id into v_contact_id
    from people
    where organization_id = v_invite.organization_id
      and user_id is null
      and is_deleted = false
      and lower(btrim(email)) = lower(btrim(v_invite.email))
    order by created_at asc
    limit 1;

    if v_contact_id is not null then
      update people set user_id = v_uid where id = v_contact_id;
    end if;
  end if;

  -- Idempotent membership insert.
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
