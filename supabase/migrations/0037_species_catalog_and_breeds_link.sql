-- 0037_species_catalog_and_breeds_link.sql
--
-- Phase 1 of the species/breeds catalog rework: introduce a GLOBAL `species`
-- catalog table and link the existing global `breeds` table to it via
-- `species_id`. This is purely additive/behind-the-scenes — the app still reads
-- breeds by the legacy `breeds.species` text column, so behavior is unchanged.
--
-- Like `breeds` (0010), `species` is a global reference table with NO
-- organization_id: it's shared across all orgs and read-only to the app
-- (seeded/edited via the SQL editor; service_role bypasses RLS). Per-org
-- enablement (organization_species / organization_breeds) comes in a later phase.
--
-- These taxonomies model practical rescue ops, not biology: e.g. "Reptile" is a
-- species whose breeds are really types (Bearded Dragon, Snake, Turtle, …).
--
-- All statements are guarded so this is safe to (re-)run against a DB where the
-- ad-hoc version of this script has already been applied.

-- Enable UUID generation if not already enabled
create extension if not exists "pgcrypto";

-- 1. Create global species table
create table if not exists public.species (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon_name text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Seed species
insert into public.species (name, slug, icon_name, sort_order, active)
values
  ('Cat', 'cat', 'cat', 10, true),
  ('Dog', 'dog', 'dog', 20, true),
  ('Bird', 'bird', 'bird', 30, true),
  ('Rabbit', 'rabbit', 'rabbit', 40, true),
  ('Reptile', 'reptile', 'turtle', 50, true),
  ('Small Mammal', 'small_mammal', 'rat', 60, true),
  ('Other', 'other', 'paw-print', 999, true)
on conflict (slug) do update set
  name = excluded.name,
  icon_name = excluded.icon_name,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

-- 3. Add columns to existing breeds table
alter table public.breeds
  add column if not exists species_id uuid references public.species(id),
  add column if not exists slug text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- 4. Generate slugs for existing breeds
update public.breeds
set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
where slug is null;

-- 5. Link existing breeds to species table using existing text species field
update public.breeds b
set species_id = s.id
from public.species s
where lower(b.species) = s.slug
  and b.species_id is null;

-- 6. Make species_id required after backfill
alter table public.breeds
  alter column species_id set not null;

-- 7. Add uniqueness per species
create unique index if not exists breeds_species_id_slug_key
on public.breeds (species_id, slug);

-- 8. Add helpful indexes
create index if not exists idx_species_active_sort
on public.species (active, sort_order, name);

create index if not exists idx_breeds_species_active_sort
on public.breeds (species_id, active, sort_order, name);

-- 9. Enable RLS
alter table public.species enable row level security;
alter table public.breeds enable row level security;

-- 10. Allow authenticated users to read global config
drop policy if exists "Authenticated users can read species" on public.species;
create policy "Authenticated users can read species"
on public.species
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read breeds" on public.breeds;
create policy "Authenticated users can read breeds"
on public.breeds
for select
to authenticated
using (true);
