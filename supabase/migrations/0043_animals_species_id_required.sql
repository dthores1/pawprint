-- 0043_animals_species_id_required.sql
--
-- Step 1 of retiring the legacy animals.species text column. Makes species_id
-- authoritative: backfill any stragglers, require it, and relax the text column
-- so it can stop being written. SAFE to run against the CURRENTLY DEPLOYED app
-- (which still writes species text) AND the new app (which won't) — the text
-- column merely becomes optional here; it's dropped in 0044 after the new app
-- is live. Run this, deploy the app, then run 0044.

begin;

-- Backfill any rows still missing species_id (e.g. litter members created
-- before species_id was stamped) from the legacy text via the catalog slug.
update public.animals a
set species_id = s.id
from public.species s
where a.species_id is null
  and lower(a.species) = s.slug;

-- species_id is now the source of truth.
alter table public.animals alter column species_id set not null;

-- Let the app stop writing the legacy text column without tripping NOT NULL.
alter table public.animals alter column species drop not null;

commit;
