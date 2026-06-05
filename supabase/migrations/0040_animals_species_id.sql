-- 0040_animals_species_id.sql
--
-- Phase 2 step 0: give animals a foreign key into the species catalog, pairing
-- with the existing animals.breed_id. This is the schema foundation that lets
-- the app read/write species from the catalog (and unlocks icons,
-- species-specific UI, org enablement, cleaner reporting down the line).
--
-- Deliberately additive and non-breaking:
--   * species_id is NULLABLE for now. The current app only writes the legacy
--     `species` text; requiring species_id would break inserts until the Phase 2
--     app code writes it. A later migration sets NOT NULL once that's in place.
--   * The legacy `species` text column is kept (still the app's read path during
--     the transition) and stays in sync going forward; it's retired later.
--
-- Requires 0037 (species catalog). Idempotent / guarded.

begin;

-- 1. Add the nullable FK to the species catalog.
alter table public.animals
  add column if not exists species_id uuid references public.species(id);

-- 2. Backfill from the legacy species text. The old CHECK guaranteed
--    species ∈ {Dog, Cat, Other}, all of which exist in the catalog, so this
--    covers every existing row. (slug match: lower('Dog') = 'dog', etc.)
update public.animals a
set species_id = s.id
from public.species s
where lower(a.species) = s.slug
  and a.species_id is null;

-- 3. Drop the legacy CHECK that pinned species to Dog/Cat/Other so the app can
--    persist the full catalog in Phase 2. The species_id FK is the real guard;
--    `species` text remains (unconstrained) for back-compat until retired.
--    Resolved by definition so we don't depend on the auto-generated name.
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.animals'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%species in (%';
  if cname is not null then
    execute format('alter table public.animals drop constraint %I', cname);
  end if;
end $$;

-- 4. Index for species filtering / joins.
create index if not exists idx_animals_species_id
on public.animals (species_id);

commit;
