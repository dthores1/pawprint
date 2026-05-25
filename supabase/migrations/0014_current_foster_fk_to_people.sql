-- 0014_current_foster_fk_to_people.sql
-- After 0012 consolidated fosters into `people`, the denormalized cache
-- animals.current_foster_id now holds a people.id. But its FK constraint
-- (animals_current_foster_fk, added in 0002) still pointed at foster_parents(id)
-- — which 0012 emptied — so every write of a people.id was rejected by the FK
-- and placeAnimal/reassignFoster silently failed to persist the cache.
--
-- Re-point the FK at people, then backfill the cache from the authoritative
-- active placements so existing fostered animals get a value immediately.

BEGIN;

ALTER TABLE animals
  DROP CONSTRAINT IF EXISTS animals_current_foster_fk;

ALTER TABLE animals
  ADD CONSTRAINT animals_current_foster_fk
  FOREIGN KEY (current_foster_id) REFERENCES people(id)
  ON DELETE SET NULL;

-- Backfill the denormalized cache from the active placement (one per animal,
-- enforced by the partial unique index).
UPDATE animals a
SET current_foster_id = fp.person_id
FROM foster_placements fp
WHERE fp.animal_id = a.id
  AND fp.placement_status = 'active'
  AND fp.person_id IS NOT NULL;

COMMIT;
