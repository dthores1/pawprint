-- 0072_organization_navigation_settings.sql
--
-- Per-org sidebar navigation customization. Lets an org hide nav tabs it doesn't
-- use (e.g. a humane society with no Rescue Sites / Foster Parents) to simplify
-- the app. This is NAVIGATION ONLY — it does not change permissions or RLS, and
-- it does not block direct-URL access to a hidden tab's routes.
--
-- Sparse model: a MISSING row means the tab is VISIBLE (the default). We only
-- persist explicit toggles, so new orgs and newly-added tabs default to visible
-- with no backfill or seed trigger. "Restore defaults" simply deletes the org's
-- rows. `tab_key` matches the hideable sidebar keys (fosters, medical, sites,
-- requests, contacts, reports, adoptions); locked tabs (dashboard, animals,
-- recycle-bin, settings) are never stored here.

-- 1. Table -----------------------------------------------------------------
create table if not exists public.organization_navigation_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tab_key text not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tab_key)
);

create index if not exists organization_navigation_settings_org_idx
  on public.organization_navigation_settings (organization_id);

-- 2. RLS -------------------------------------------------------------------
alter table public.organization_navigation_settings enable row level security;
drop policy if exists "org members manage navigation settings"
  on public.organization_navigation_settings;
create policy "org members manage navigation settings"
  on public.organization_navigation_settings
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 3. updated_at trigger ----------------------------------------------------
drop trigger if exists organization_navigation_settings_set_updated_at
  on public.organization_navigation_settings;
create trigger organization_navigation_settings_set_updated_at
  before update on public.organization_navigation_settings
  for each row execute function public.set_updated_at();
