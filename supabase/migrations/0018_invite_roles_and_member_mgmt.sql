-- 0018_invite_roles_and_member_mgmt.sql
-- Two operational additions to the invites/membership system:
--   1. The admin can pre-assign operational roles (foster_parent, trapper, etc.)
--      on an invite. Stored on the invite row; applied to the invitee's
--      self-record when they accept.
--   2. RPCs to change an existing member's org role and to remove a member —
--      both guarded against ever removing the last owner.

-- ============================================================
-- 1. Operational roles on invites
-- ============================================================

ALTER TABLE organization_invitations
  ADD COLUMN IF NOT EXISTS person_roles text[] NOT NULL DEFAULT '{}';

-- Replace create_org_invite to accept person_roles. Same admin guard as before.
CREATE OR REPLACE FUNCTION public.create_org_invite(
  p_org_id uuid,
  p_email text,
  p_role text DEFAULT 'member',
  p_person_roles text[] DEFAULT '{}'
)
RETURNS organization_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite organization_invitations;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'Only org admins can invite' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin','member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  INSERT INTO organization_invitations(
    organization_id, email, role, invited_by, person_roles
  )
    VALUES (
      p_org_id, lower(btrim(p_email)), p_role, v_uid, COALESCE(p_person_roles, '{}')
    )
    RETURNING * INTO v_invite;
  RETURN v_invite;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_org_invite(uuid, text, text, text[]) TO authenticated;

-- Replace get_invite_by_token to return person_roles too.
DROP FUNCTION IF EXISTS public.get_invite_by_token(uuid);
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token uuid)
RETURNS TABLE(
  invite_id uuid,
  organization_id uuid,
  organization_name text,
  email text,
  role text,
  person_roles text[],
  expires_at timestamptz,
  accepted boolean,
  revoked boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.organization_id, o.name,
         i.email, i.role, i.person_roles, i.expires_at,
         (i.accepted_at IS NOT NULL) AS accepted,
         (i.revoked_at IS NOT NULL) AS revoked
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.organization_id
  WHERE i.token = p_token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;

-- ============================================================
-- 2. Member role / removal RPCs (admin-only, last-owner guarded)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_member_role(
  p_member_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_current_role text;
  v_owner_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_role NOT IN ('owner','admin','member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT organization_id, role INTO v_org_id, v_current_role
  FROM organization_members WHERE id = p_member_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF NOT is_org_admin(v_org_id) THEN
    RAISE EXCEPTION 'Only org admins can change member roles' USING ERRCODE = '42501';
  END IF;

  -- Don't allow demoting the last remaining owner.
  IF v_current_role = 'owner' AND p_role <> 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM organization_members
    WHERE organization_id = v_org_id AND role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the only owner — promote another member first';
    END IF;
  END IF;

  UPDATE organization_members SET role = p_role WHERE id = p_member_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_current_role text;
  v_owner_count int;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_current_role
  FROM organization_members WHERE id = p_member_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF NOT is_org_admin(v_org_id) THEN
    RAISE EXCEPTION 'Only org admins can remove members' USING ERRCODE = '42501';
  END IF;
  IF v_current_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM organization_members
    WHERE organization_id = v_org_id AND role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the only owner — promote another member first';
    END IF;
  END IF;
  DELETE FROM organization_members WHERE id = p_member_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid) TO authenticated;
