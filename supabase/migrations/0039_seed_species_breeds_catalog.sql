-- 0039_seed_species_breeds_catalog.sql
--
-- Phase 2 (data): populate the global species catalog and the per-species breed
-- catalog. Requires 0037 (species table + breeds.species_id) and 0038 (relaxed
-- breeds.species text) to have run first.
--
-- Taxonomy is rescue-ops oriented, not biological: each "breed" row is really a
-- breed OR a type (e.g. Reptile → Bearded Dragon, Snake). Every species includes
-- an "Unknown" row — incomplete intake data is better recorded as Unknown than
-- guessed. Catch-alls ("Mixed Breed", "Unknown") sort to the bottom (sort_order
-- 900/1000); specific breeds sort by name.
--
-- Idempotent: species upsert on slug; breeds insert on (species_id, slug) do
-- nothing, so existing rows are preserved and re-runs are safe.

-- 1. Species catalog — authoritative seed of all nine species, with final
--    ordering (Rabbit before Bird) and the two new ones (Farm Animal, Horse).
insert into public.species (name, slug, icon_name, sort_order, active)
values
  ('Cat',          'cat',          'cat',       10,  true),
  ('Dog',          'dog',          'dog',       20,  true),
  ('Rabbit',       'rabbit',       'rabbit',    30,  true),
  ('Bird',         'bird',         'bird',      40,  true),
  ('Reptile',      'reptile',      'turtle',    50,  true),
  ('Small Mammal', 'small_mammal', 'rat',       60,  true),
  ('Farm Animal',  'farm_animal',  'paw-print', 70,  true),
  ('Horse',        'horse',        'paw-print', 80,  true),
  ('Other',        'other',        'paw-print', 999, true)
on conflict (slug) do update set
  name       = excluded.name,
  icon_name  = excluded.icon_name,
  sort_order = excluded.sort_order,
  active     = excluded.active,
  updated_at = now();

-- 2. Breeds per species. Slug is derived with the same normalizer as 0037 so it
--    matches any already-seeded rows (and they're skipped via ON CONFLICT).
--    `species` text is set to the slug for back-compat with the current app.

-- Cat
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       case v.name when 'Unknown' then 1000 when 'Mixed Breed' then 900 else 0 end,
       true
from public.species s
cross join (values
  ('Bengal'), ('British Shorthair'), ('Domestic Longhair'),
  ('Domestic Medium Hair'), ('Domestic Shorthair'), ('Maine Coon'),
  ('Mixed Breed'), ('Norwegian Forest Cat'), ('Persian'), ('Ragdoll'),
  ('Russian Blue'), ('Scottish Fold'), ('Siamese'), ('Sphynx'), ('Unknown')
) as v(name)
where s.slug = 'cat'
on conflict (species_id, slug) do nothing;

-- Dog
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       case v.name when 'Unknown' then 1000 when 'Mixed Breed' then 900 else 0 end,
       true
from public.species s
cross join (values
  ('American Staffordshire Terrier'), ('Australian Cattle Dog'),
  ('Australian Shepherd'), ('Beagle'), ('Border Collie'), ('Boston Terrier'),
  ('Boxer'), ('Bulldog'), ('Catahoula Leopard Dog'), ('Chihuahua'),
  ('Chihuahua Mix'), ('Cocker Spaniel'), ('Corgi'), ('Dachshund'),
  ('Doberman Pinscher'), ('French Bulldog'), ('German Shepherd'),
  ('German Shepherd Mix'), ('Golden Retriever'), ('Golden Retriever Mix'),
  ('Great Pyrenees'), ('Hound Mix'), ('Husky'), ('Husky Mix'),
  ('Jack Russell Terrier'), ('Labrador Mix'), ('Labrador Retriever'),
  ('Mastiff'), ('Miniature Poodle'), ('Mixed Breed'), ('Pit Bull'),
  ('Pit Bull Mix'), ('Pomeranian'), ('Poodle'), ('Rottweiler'),
  ('Shepherd Mix'), ('Shih Tzu'), ('Staffordshire Bull Terrier'),
  ('Standard Poodle'), ('Terrier Mix'), ('Unknown'), ('Yorkshire Terrier')
) as v(name)
where s.slug = 'dog'
on conflict (species_id, slug) do nothing;

-- Rabbit
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       case v.name when 'Unknown' then 1000 when 'Mixed Breed' then 900 else 0 end,
       true
from public.species s
cross join (values
  ('Dutch'), ('Flemish Giant'), ('Holland Lop'), ('Lionhead'), ('Mini Rex'),
  ('Mixed Breed'), ('Netherland Dwarf'), ('Rex'), ('Unknown')
) as v(name)
where s.slug = 'rabbit'
on conflict (species_id, slug) do nothing;

-- Bird
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       case v.name when 'Unknown' then 1000 when 'Mixed Breed' then 900 else 0 end,
       true
from public.species s
cross join (values
  ('African Grey'), ('Canary'), ('Cockatiel'), ('Conure'), ('Dove'),
  ('Finch'), ('Lovebird'), ('Macaw'), ('Parakeet'), ('Unknown')
) as v(name)
where s.slug = 'bird'
on conflict (species_id, slug) do nothing;

-- Reptile
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       case v.name when 'Unknown' then 1000 when 'Mixed Breed' then 900 else 0 end,
       true
from public.species s
cross join (values
  ('Ball Python'), ('Bearded Dragon'), ('Box Turtle'), ('Chameleon'),
  ('Corn Snake'), ('Crested Gecko'), ('Gecko'), ('Green Iguana'), ('Iguana'),
  ('Leopard Gecko'), ('Python'), ('Red-Eared Slider'), ('Snake'), ('Tegu'),
  ('Tortoise'), ('Turtle'), ('Unknown')
) as v(name)
where s.slug = 'reptile'
on conflict (species_id, slug) do nothing;

-- Small Mammal
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       case v.name when 'Unknown' then 1000 when 'Mixed Breed' then 900 else 0 end,
       true
from public.species s
cross join (values
  ('Chinchilla'), ('Ferret'), ('Gerbil'), ('Guinea Pig'), ('Hamster'),
  ('Hedgehog'), ('Mouse'), ('Rat'), ('Sugar Glider'), ('Unknown')
) as v(name)
where s.slug = 'small_mammal'
on conflict (species_id, slug) do nothing;

-- Farm Animal
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       case v.name when 'Unknown' then 1000 when 'Mixed Breed' then 900 else 0 end,
       true
from public.species s
cross join (values
  ('Alpaca'), ('Chicken'), ('Cow'), ('Donkey'), ('Duck'), ('Goat'),
  ('Llama'), ('Pig'), ('Sheep'), ('Turkey'), ('Unknown')
) as v(name)
where s.slug = 'farm_animal'
on conflict (species_id, slug) do nothing;

-- Horse
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       case v.name when 'Unknown' then 1000 when 'Mixed Breed' then 900 else 0 end,
       true
from public.species s
cross join (values
  ('Appaloosa'), ('Arabian'), ('Draft Horse'), ('Miniature Horse'),
  ('Mixed Breed'), ('Mustang'), ('Paint'), ('Pony'), ('Quarter Horse'),
  ('Thoroughbred'), ('Unknown')
) as v(name)
where s.slug = 'horse'
on conflict (species_id, slug) do nothing;

-- Other
insert into public.breeds (species_id, species, name, slug, sort_order, active)
select s.id, s.slug, v.name,
       lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '_', 'g')),
       case v.name when 'Unknown' then 1000 when 'Mixed Breed' then 900 else 0 end,
       true
from public.species s
cross join (values
  ('Mixed Breed'), ('Unknown')
) as v(name)
where s.slug = 'other'
on conflict (species_id, slug) do nothing;
