-- 0092_remove_bonded_pair_trait.sql
-- ============================================================
-- Remove "Bonded Pair" from the trait catalog.
--
-- Bonded pairs are modeled as animal RELATIONSHIPS (relationship_type
-- 'bonded_pair', migration 0003), and the UI already derives the "Bonded
-- Pair" chip from those records. Having it *also* exist as a free-floating
-- trait invites inconsistency: a tag that says "bonded" without saying with
-- whom, or an animal tagged bonded with no relationship (and vice versa).
--
-- Two changes:
--   1. seed_org_traits() no longer includes it, so new orgs (via the
--      organizations insert trigger) and any future re-seed don't get it.
--   2. Existing 'Bonded Pair' trait rows are deleted — including any an org
--      created by hand under the same name, since the concept shouldn't be a
--      tag at all. animal_traits assignments disappear with them
--      (trait_id FK is ON DELETE CASCADE). No information is lost that the
--      relationship model doesn't carry better.
--
-- Idempotent: re-running re-replaces the function and the delete finds 0 rows.
-- ============================================================

-- 1. Re-seed function without 'Bonded Pair' (otherwise identical to 0045).
create or replace function public.seed_org_traits(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.traits (organization_id, name, species_id)
  select p_org, d.name, s.id
  from (values
    -- General (all species)
    ('Affectionate', null::text), ('Playful', null), ('Shy', null),
    ('Independent', null), ('High Energy', null), ('Low Energy', null),
    ('Dog Friendly', null), ('Cat Friendly', null), ('Kid Friendly', null),
    ('Senior Friendly', null), ('Food Motivated', null),
    ('Needs Quiet Home', null), ('Needs Experienced Adopter', null),
    ('Special Needs', null),
    -- Species-specific
    ('House Trained', 'dog'), ('Crate Trained', 'dog'), ('Leash Trained', 'dog'),
    ('Litter Box Trained', 'cat')
  ) as d(name, species_slug)
  left join public.species s on s.slug = d.species_slug
  on conflict (
    organization_id,
    lower(name),
    coalesce(species_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) do nothing;
end;
$$;

-- 2. Drop existing Bonded Pair traits (cascades to animal_traits assignments).
delete from public.traits where lower(name) = 'bonded pair';
