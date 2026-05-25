-- Fix animals whose updated_at is in the future (seed/testing artifact).
-- Pulls those rows back to roughly a week ago so they sort sensibly when the
-- Animals list defaults to ORDER BY updated_at DESC.
--
-- A small random offset (0–24h) is added so rows don't all collapse to the
-- exact same timestamp, which would make the relative ordering arbitrary.
--
-- Safe to re-run: it only touches rows that are still in the future.

BEGIN;

-- Preview what will change (optional — comment out if you just want to run it):
SELECT id, name, updated_at AS current_updated_at
FROM public.animals
WHERE updated_at > now()
ORDER BY updated_at DESC;

UPDATE public.animals
SET updated_at = now() - interval '7 days' - (random() * interval '24 hours')
WHERE updated_at > now();

-- Sanity check: should return 0 rows.
SELECT count(*) AS still_in_future
FROM public.animals
WHERE updated_at > now();

COMMIT;
