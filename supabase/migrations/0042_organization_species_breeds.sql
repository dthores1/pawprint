-- 0042_organization_species_breeds.sql
--
-- Phase 3 of the species/breeds rework: per-org enablement layer on top of the
-- GLOBAL species/breeds catalogs. This is passive — no app code reads these yet
-- (Settings UI = Phase 4, tenant-aware selectors = Phase 5). It just records,
-- per organization, which species it accepts and (optionally) which breeds.
--
-- Conventions match every other org-scoped table: organization_id NOT NULL FK to
-- organizations, RLS gated by is_org_member(organization_id).
--
-- Semantics:
--   * organization_species: EXPLICIT rows. Backfilled to "all active species
--     enabled" for every existing org, so current multi-species behavior is
--     unchanged. Phase 5 auto-defaults when exactly one species is enabled.
--   * organization_breeds: OPT-IN narrowing. NOT backfilled. No rows for a
--     species → "all breeds allowed"; rows exist only when an org restricts
--     (e.g. a pug-only rescue). Avoids fanning ~140 breeds out to every org.
--
-- Idempotent / guarded.

-- 1. organization_species --------------------------------------------------
create table if not exists public.organization_species (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  species_id uuid not null references public.species(id) on delete cascade,
  is_enabled boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists organization_species_org_species_key
  on public.organization_species (organization_id, species_id);

alter table public.organization_species enable row level security;
drop policy if exists "org members manage organization species" on public.organization_species;
create policy "org members manage organization species"
  on public.organization_species
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 2. organization_breeds ---------------------------------------------------
create table if not exists public.organization_breeds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  breed_id uuid not null references public.breeds(id) on delete cascade,
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists organization_breeds_org_breed_key
  on public.organization_breeds (organization_id, breed_id);

alter table public.organization_breeds enable row level security;
drop policy if exists "org members manage organization breeds" on public.organization_breeds;
create policy "org members manage organization breeds"
  on public.organization_breeds
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 3. Backfill organization_species: enable all active species per existing org
--    (mirrors current behavior). organization_breeds is intentionally left empty
--    (opt-in narrowing). sort_order seeded from the catalog's own ordering.
insert into public.organization_species (organization_id, species_id, is_enabled, sort_order)
select o.id, s.id, true, s.sort_order
from public.organizations o
cross join public.species s
where s.active = true
on conflict (organization_id, species_id) do nothing;

-- 4. Keep NEW orgs consistent: enable all active species on org creation, so a
--    freshly onboarded org isn't left with an empty species set once the
--    tenant-aware selectors (Phase 5) go live. Fires for both the direct-insert
--    and create-org RPC paths. SECURITY DEFINER so it can seed the rows during
--    org creation (before/independent of the creator's membership row).
create or replace function public.seed_org_species()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_species (organization_id, species_id, is_enabled, sort_order)
  select new.id, s.id, true, s.sort_order
  from public.species s
  where s.active = true
  on conflict (organization_id, species_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_org_species on public.organizations;
create trigger trg_seed_org_species
  after insert on public.organizations
  for each row execute function public.seed_org_species();
