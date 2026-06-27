-- 0083_expand_breeds_catalog.sql
--
-- Expand the GLOBAL breeds catalog (seeded in 0039) with breeds that were
-- missing from the original list. These are catalog-level additions, so they
-- become available to EVERY org immediately: organization_breeds is opt-in
-- narrowing (no rows for a species = all breeds allowed), so nothing per-org
-- needs backfilling.
--
-- Same shape as 0039: slug derived with the same normalizer, `species` text set
-- to the slug for back-compat, specific breeds sort_order 0 (Mixed/Unknown keep
-- their 900/1000 buckets but none are added here). Idempotent via
-- ON CONFLICT (species_id, slug) DO NOTHING, so re-runs and overlap with any
-- hand-added rows are safe.

-- Dog
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       0,
       true
from public.species s
cross join (values
  ('Akita'), ('Basset Hound'), ('Bichon Frise'), ('Black Mouth Cur'),
  ('Bloodhound'), ('Blue Heeler'), ('Cane Corso'), ('Chow Chow'), ('Collie'),
  ('Dalmatian'), ('English Bulldog'), ('English Springer Spaniel'),
  ('Greyhound'), ('Havanese'), ('Lhasa Apso'), ('Maltese'),
  ('Miniature Pinscher'), ('Papillon'), ('Pekingese'), ('Pointer'),
  ('Poodle Mix'), ('Pug'), ('Rat Terrier'), ('Retriever Mix'),
  ('Rhodesian Ridgeback'), ('Schnauzer'), ('Shar Pei'), ('Sheltie'),
  ('Spaniel Mix'), ('Vizsla'), ('Weimaraner'), ('Whippet')
) as v(name)
where s.slug = 'dog'
on conflict (species_id, slug) do nothing;

-- Cat
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       0,
       true
from public.species s
cross join (values
  ('Abyssinian'), ('American Bobtail'), ('American Curl'),
  ('American Shorthair'), ('Balinese'), ('Birman'), ('Bombay'), ('Burmese'),
  ('Devon Rex'), ('Exotic Shorthair'), ('Himalayan'), ('Manx'),
  ('Oriental Shorthair'), ('Savannah'), ('Siberian'), ('Snowshoe'),
  ('Tonkinese'), ('Turkish Angora'), ('Turkish Van')
) as v(name)
where s.slug = 'cat'
on conflict (species_id, slug) do nothing;

-- Bird
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       0,
       true
from public.species s
cross join (values
  ('Budgie'), ('Cockatoo'), ('Eclectus'), ('Parrot'), ('Quaker Parrot'),
  ('Ringneck Parakeet')
) as v(name)
where s.slug = 'bird'
on conflict (species_id, slug) do nothing;

-- Reptile
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       0,
       true
from public.species s
cross join (values
  ('Boa'), ('King Snake'), ('Milk Snake'), ('Monitor Lizard'),
  ('Sulcata Tortoise'), ('Uromastyx')
) as v(name)
where s.slug = 'reptile'
on conflict (species_id, slug) do nothing;

-- Small Mammal
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       0,
       true
from public.species s
cross join (values
  ('Degu')
) as v(name)
where s.slug = 'small_mammal'
on conflict (species_id, slug) do nothing;

-- Horse
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       0,
       true
from public.species s
cross join (values
  ('Clydesdale'), ('Morgan'), ('Paso Fino'), ('Percheron'), ('Saddlebred'),
  ('Tennessee Walking Horse'), ('Warmblood')
) as v(name)
where s.slug = 'horse'
on conflict (species_id, slug) do nothing;
