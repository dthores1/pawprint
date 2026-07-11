-- 0094_admin_gate_org_settings_writes.sql
-- Org-level settings tables were writable by ANY org member: their single
-- `for all ... is_org_member` policy covered writes too, with admin-ness only
-- "enforced in the Settings UI". A regular member could change Accepted
-- Animal Types / Accepted Breeds (observed in prod) — and, via the API,
-- trait definitions, saved locations, and navigation visibility.
--
-- Split each into member READ + admin WRITE. Per-record working data is
-- untouched — notably animal_traits (per-animal trait assignments) stays
-- member-writable because editing an animal's traits is day-to-day work;
-- only the org-wide `traits` catalog becomes admin-managed.
--
-- The seed_org_species trigger (0042) is SECURITY DEFINER, so new-org
-- seeding is unaffected. `organizations` itself was already admin-gated
-- for update (0001). Idempotent — safe to re-run.

-- ── organization_species ────────────────────────────────────────────────────
drop policy if exists "org members manage organization species" on public.organization_species;
drop policy if exists "org members read organization species" on public.organization_species;
drop policy if exists "org admins manage organization species" on public.organization_species;

create policy "org members read organization species"
  on public.organization_species
  for select
  using (is_org_member(organization_id));

create policy "org admins manage organization species"
  on public.organization_species
  for all
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- ── organization_breeds ─────────────────────────────────────────────────────
drop policy if exists "org members manage organization breeds" on public.organization_breeds;
drop policy if exists "org members read organization breeds" on public.organization_breeds;
drop policy if exists "org admins manage organization breeds" on public.organization_breeds;

create policy "org members read organization breeds"
  on public.organization_breeds
  for select
  using (is_org_member(organization_id));

create policy "org admins manage organization breeds"
  on public.organization_breeds
  for all
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- ── traits (org-wide trait catalog; NOT animal_traits assignments) ──────────
drop policy if exists "org members manage traits" on public.traits;
drop policy if exists "org members read traits" on public.traits;
drop policy if exists "org admins manage traits" on public.traits;

create policy "org members read traits"
  on public.traits
  for select
  using (is_org_member(organization_id));

create policy "org admins manage traits"
  on public.traits
  for all
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- ── saved_locations ─────────────────────────────────────────────────────────
drop policy if exists "org members manage saved locations" on public.saved_locations;
drop policy if exists "org members read saved locations" on public.saved_locations;
drop policy if exists "org admins manage saved locations" on public.saved_locations;

create policy "org members read saved locations"
  on public.saved_locations
  for select
  using (is_org_member(organization_id));

create policy "org admins manage saved locations"
  on public.saved_locations
  for all
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- ── organization_navigation_settings ────────────────────────────────────────
drop policy if exists "org members manage navigation settings" on public.organization_navigation_settings;
drop policy if exists "org members read navigation settings" on public.organization_navigation_settings;
drop policy if exists "org admins manage navigation settings" on public.organization_navigation_settings;

create policy "org members read navigation settings"
  on public.organization_navigation_settings
  for select
  using (is_org_member(organization_id));

create policy "org admins manage navigation settings"
  on public.organization_navigation_settings
  for all
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));
