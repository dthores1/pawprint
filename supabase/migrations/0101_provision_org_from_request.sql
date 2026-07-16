-- Staff-side provisioning helper for beta signup requests.
--
-- The public /request-access form inserts an organization_signup_requests row —
-- no auth user, no org. Converting a request is done by staff in the Supabase
-- SQL editor (self-service org creation stays disabled during the beta). This
-- function wraps the whole conversion in one call:
--
--   1. Creates the organization (the creation triggers auto-seed species
--      enablement + the starter product catalog; the creator-as-owner trigger
--      is a no-op here because auth.uid() is null in the SQL editor).
--   2. Inserts an organization_invitations row for the request's contact email
--      (role 'admin' — invites can't grant 'owner'; see promote helper below).
--   3. Marks the request Converted and links it to the new org.
--
-- Usage (SQL editor):
--
--   select * from public.provision_org_from_request('<request-id>');
--
--   -- returns: organization_id | invite_token | invite_path
--   -- send the invitee:  https://<app-origin><invite_path>
--
-- The invitee opens the link, signs up (email is prefilled and bound to the
-- invite), and acceptance adds their membership. To then make them the org
-- OWNER (invites top out at admin):
--
--   select public.promote_org_member_to_owner('<organization-id>', '<their-email>');
--
-- Both functions are for the SQL editor / service role only — EXECUTE is
-- revoked from every API role below.

CREATE OR REPLACE FUNCTION public.provision_org_from_request(
  p_request_id uuid,
  p_org_name text DEFAULT NULL,     -- override; defaults to the request's organization_name
  p_invite_email text DEFAULT NULL, -- override; defaults to the request's contact_email
  p_invite_role text DEFAULT 'admin'
)
RETURNS TABLE (organization_id uuid, invite_token uuid, invite_path text)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_request organization_signup_requests%ROWTYPE;
  v_org_id uuid;
  v_token uuid;
  v_email text;
BEGIN
  SELECT * INTO v_request
    FROM organization_signup_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No signup request with id %', p_request_id;
  END IF;
  IF v_request.organization_id IS NOT NULL OR v_request.status = 'Converted' THEN
    RAISE EXCEPTION 'Request % is already converted (org %)',
      p_request_id, v_request.organization_id;
  END IF;
  IF p_invite_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invite role must be admin or member (owner is granted after acceptance — see promote_org_member_to_owner)';
  END IF;

  v_email := lower(btrim(coalesce(p_invite_email, v_request.contact_email)));

  INSERT INTO organizations (name)
    VALUES (btrim(coalesce(p_org_name, v_request.organization_name)))
    RETURNING id INTO v_org_id;

  INSERT INTO organization_invitations (organization_id, email, role)
    VALUES (v_org_id, v_email, p_invite_role)
    RETURNING token INTO v_token;

  UPDATE organization_signup_requests
    SET status = 'Converted',
        organization_id = v_org_id,
        reviewed_at = now(),
        reviewed_by = auth.uid(), -- null in the SQL editor; kept for completeness
        updated_at = now()
    WHERE id = p_request_id;

  RETURN QUERY SELECT v_org_id, v_token, '/invite/' || v_token::text;
END;
$$;

-- Invites top out at 'admin' (DB CHECK), so ownership is granted after the
-- invitee accepts: looks up their auth user by email and flips their
-- membership role. Fails loudly if they haven't signed up / accepted yet.
CREATE OR REPLACE FUNCTION public.promote_org_member_to_owner(
  p_organization_id uuid,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(btrim(p_email))
    ORDER BY created_at
    LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user with email % — have they accepted the invite yet?', p_email;
  END IF;

  UPDATE organization_members
    SET role = 'owner'
    WHERE organization_id = p_organization_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % is not a member of org % — have they accepted the invite yet?',
      p_email, p_organization_id;
  END IF;
END;
$$;

-- SQL-editor / service-role only: not callable through the API.
REVOKE EXECUTE ON FUNCTION public.provision_org_from_request(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_org_member_to_owner(uuid, text)
  FROM PUBLIC, anon, authenticated;
