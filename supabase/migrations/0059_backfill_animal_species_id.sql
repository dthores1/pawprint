-- 0059_backfill_animal_species_id.sql
-- The legacy `animals.species` text column was retired (0044) and the display
-- name is now derived from `species_id` via the global catalog. Some rows —
-- typically legacy imports — carry a `breed_id` but never had `species_id`
-- backfilled, so their species renders blank. A breed always belongs to exactly
-- one species, so we can recover the missing FK from the breed.
--
-- Idempotent: only touches rows whose species_id is still NULL, and only when
-- the breed resolves a species. Safe to re-run.
update public.animals a
set species_id = b.species_id
from public.breeds b
where a.breed_id = b.id
  and a.species_id is null
  and b.species_id is not null;
