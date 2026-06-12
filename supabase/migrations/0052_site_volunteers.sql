-- 0052_site_volunteers.sql
-- ============================================================
-- Site coordination people:
--   • sites.site_lead — the person coordinating a site (people.id). Defaults to
--     the creator (set app-side); editable by admins / MANAGE_SITES holders.
--   • site_volunteers — a many-to-many of people <-> sites with a free-text role
--     (e.g. "Feeder", "Trapper"). The Site Lead is surfaced at the top of the
--     volunteers list in the UI; it is NOT duplicated as a site_volunteers row.
--
-- Read for any org member; writes gated by MANAGE_SITES (admins included).
-- Depends on 0051 (sites, site_notes, MANAGE_SITES).
-- ============================================================

-- ---------- 1. sites.site_lead ----------
alter table public.sites
  add column if not exists site_lead uuid references public.people(id) on delete set null;
create index if not exists sites_site_lead_idx on public.sites (site_lead);

-- ---------- 2. site_volunteers ----------
create table if not exists public.site_volunteers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  contact_id uuid not null references public.people(id) on delete cascade,
  role text,
  added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- One row per person per site (re-adding a removed volunteer just re-inserts).
  unique (site_id, contact_id)
);

create index if not exists site_volunteers_org_idx
  on public.site_volunteers (organization_id);
create index if not exists site_volunteers_site_idx
  on public.site_volunteers (site_id);
create index if not exists site_volunteers_contact_idx
  on public.site_volunteers (contact_id);

-- ---------- 3. RLS ----------
alter table public.site_volunteers enable row level security;

drop policy if exists "org members read site volunteers" on public.site_volunteers;
create policy "org members read site volunteers"
  on public.site_volunteers for select
  using (is_org_member(organization_id));

drop policy if exists "site managers insert site volunteers" on public.site_volunteers;
create policy "site managers insert site volunteers"
  on public.site_volunteers for insert
  with check (has_member_permission(organization_id, 'MANAGE_SITES'));

drop policy if exists "site managers update site volunteers" on public.site_volunteers;
create policy "site managers update site volunteers"
  on public.site_volunteers for update
  using (has_member_permission(organization_id, 'MANAGE_SITES'))
  with check (has_member_permission(organization_id, 'MANAGE_SITES'));

drop policy if exists "site managers delete site volunteers" on public.site_volunteers;
create policy "site managers delete site volunteers"
  on public.site_volunteers for delete
  using (has_member_permission(organization_id, 'MANAGE_SITES'));
