-- 0038_breeds_relax_species_text.sql
--
-- Phase 1b: prepare the breeds catalog for seeding the new species.
--
-- 0010 defined breeds.species as `text not null check (species in
-- ('dog','cat','rabbit','bird','other'))`. The new species catalog (0037) adds
-- reptile, small_mammal, farm_animal and horse, which that CHECK rejects and the
-- NOT NULL forbids leaving blank. Since `species_id` is now the source of truth
-- and the legacy `species` text column is on its way out, we:
--   1. drop the legacy CHECK,
--   2. make `species` nullable,
-- so 0039 can seed breeds for every species. Existing rows keep their species
-- text, so the current app (which still reads breeds by species text) is
-- unaffected.
--
-- Also dedupes the breeds read policy: 0010 created a "readable by everyone"
-- (anon-included) SELECT policy; 0037 added an authenticated-only one. Because
-- RLS policies are OR'd, the old one made the new restriction a no-op. Drop the
-- legacy one so breeds, like species, is authenticated-read only.
--
-- All statements are guarded / idempotent.

-- 1. Drop the legacy CHECK on breeds.species (auto-named by Postgres in 0010 —
--    resolve it by definition so we don't depend on the exact constraint name).
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.breeds'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%species in (%';
  if cname is not null then
    execute format('alter table public.breeds drop constraint %I', cname);
  end if;
end $$;

-- 2. Allow breeds.species to be null (species_id is now authoritative).
alter table public.breeds
  alter column species drop not null;

-- 3. Remove the redundant anon-inclusive read policy from 0010; the
--    authenticated-only policy from 0037 is the single source of truth.
drop policy if exists "breeds are readable by everyone" on public.breeds;
