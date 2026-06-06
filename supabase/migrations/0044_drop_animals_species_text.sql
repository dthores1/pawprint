-- 0044_drop_animals_species_text.sql
--
-- Step 2: drop the legacy animals.species text column for good. Run this AFTER
-- 0043 and after the app that no longer reads/writes animals.species is
-- deployed (it derives the species name from species_id via the species
-- catalog). species_id is already NOT NULL (0043) and FK-indexed (0040).

alter table public.animals drop column species;
