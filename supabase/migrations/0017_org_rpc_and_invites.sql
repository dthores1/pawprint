-- 0017_org_rpc_and_invites.sql
-- Two things:
--   1. A SECURITY DEFINER RPC for self-service org creation. Direct INSERTs into
--      `organizations` can fail "new row violates row-level security policy" when
--      auth.uid() doesn't make it through to the policy check (PostgREST + RLS
--      quirks). Routing creation through an RPC sidesteps that and keeps the
--      "create org + add creator as owner" pair atomic.
--   2. The invitations workflow: an `organization_invitations` table plus RPCs to
--      create, look up, accept, and revoke invites. Acceptance is via a single
--      `accept_org_invite(token)` call so the invitee never inserts into
--      organization_members directly.

-- ============================================================
-- 1. Self-service org creation
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_organization_for_current_user(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;
  INSERT INTO organizations(name) VALUES (btrim(p_name)) RETURNING id INTO v_org_id;
  -- Belt-and-suspenders: ensure ownership even if the 0001 trigger is missing.
  INSERT INTO organization_members(organization_id, user_id, role)
    VALUES (v_org_id, v_uid, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization_for_current_user(text) TO authenticated;

-- ============================================================
-- 2. Invitations table
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_invitations_org_idx
  ON organization_invitations (organization_id);
CREATE INDEX IF NOT EXISTS organization_invitations_token_idx
  ON organization_invitations (token);

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read invites" ON organization_invitations;
CREATE POLICY "admins read invites"
  ON organization_invitations FOR SELECT
  USING (is_org_admin(organization_id));
DROP POLICY IF EXISTS "admins manage invites" ON organization_invitations;
CREATE POLICY "admins manage invites"
  ON organization_invitations FOR ALL
  USING (is_org_admin(organization_id)) WITH CHECK (is_org_admin(organization_id));

-- ============================================================
-- 3. Invitation RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_org_invite(
  p_org_id uuid,
  p_email text,
  p_role text DEFAULT 'member'
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
  INSERT INTO organization_invitations(organization_id, email, role, invited_by)
    VALUES (p_org_id, lower(btrim(p_email)), p_role, v_uid)
    RETURNING * INTO v_invite;
  RETURN v_invite;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_org_invite(uuid, text, text) TO authenticated;

-- Public lookup so the accept page can display org name + email + status
-- without requiring sign-in. Returns nothing if the token is unknown.
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token uuid)
RETURNS TABLE(
  invite_id uuid,
  organization_id uuid,
  organization_name text,
  email text,
  role text,
  expires_at timestamptz,
  accepted boolean,
  revoked boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.organization_id, o.name,
         i.email, i.role, i.expires_at,
         (i.accepted_at IS NOT NULL) AS accepted,
         (i.revoked_at IS NOT NULL) AS revoked
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.organization_id
  WHERE i.token = p_token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_org_invite(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite organization_invitations;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_invite FROM organization_invitations WHERE token = p_token;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_invite.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Invite revoked'; END IF;
  IF v_invite.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;
  -- Idempotent: the unique (organization_id, user_id) guards against duplicates.
  INSERT INTO organization_members(organization_id, user_id, role)
    VALUES (v_invite.organization_id, v_uid, v_invite.role)
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  IF v_invite.accepted_at IS NULL THEN
    UPDATE organization_invitations
      SET accepted_at = now(), accepted_by = v_uid
      WHERE id = v_invite.id;
  END IF;
  RETURN v_invite.organization_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_org_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id FROM organization_invitations WHERE id = p_invite_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF NOT is_org_admin(v_org_id) THEN
    RAISE EXCEPTION 'Only org admins can revoke' USING ERRCODE = '42501';
  END IF;
  UPDATE organization_invitations SET revoked_at = now() WHERE id = p_invite_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_org_invite(uuid) TO authenticated;
