-- 0060_contact_visibility.sql
-- Per-person visibility flags for contact info. Non-admin org members only see a
-- contact's phone / email / address if the record opts in (or it's their own
-- record). Admins/owners always see everything.
--
-- Enforced server-side via a masking view (`people_masked`) so hidden values
-- never reach a non-admin's browser — the app reads people through this view;
-- writes still go to the `people` table. security_invoker=true keeps the
-- underlying org-scoped RLS in force for the querying user.
--
-- Defaults (per product): phone shared, email shared, address NOT shared.
-- Adding the columns with these defaults also backfills existing rows to them.

-- ---------- 1. Visibility flags ----------
alter table public.people
  add column if not exists share_phone   boolean not null default true,
  add column if not exists share_email   boolean not null default true,
  add column if not exists share_address boolean not null default false;

-- ---------- 2. Masking view ----------
-- A field is visible when the viewer is an org admin/owner, is looking at their
-- own record, or the record opted into sharing that field. Address sub-fields
-- are all gated by the single share_address flag.
drop view if exists public.people_masked;
create view public.people_masked
  with (security_invoker = true) as
select
  p.id,
  p.organization_id,
  p.first_name,
  p.last_name,
  p.roles,
  p.role,
  p.volunteer_type,
  p.organization_name,
  p.notes,
  p.photo_url,
  p.active,
  p.user_id,
  p.created_at,
  p.is_deleted,
  p.max_capacity,
  p.preferred_species,
  p.share_phone,
  p.share_email,
  p.share_address,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_phone
       then p.phone end as phone,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_email
       then p.email end as email,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address end as address,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_google_place_id end as address_google_place_id,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_formatted end as address_formatted,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_street_1 end as address_street_1,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_street_2 end as address_street_2,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_city end as address_city,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_state end as address_state,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_postal_code end as address_postal_code,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_country end as address_country,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_latitude end as address_latitude,
  case when public.is_org_admin(p.organization_id) or p.user_id = auth.uid() or p.share_address
       then p.address_longitude end as address_longitude
from public.people p;

grant select on public.people_masked to authenticated;
