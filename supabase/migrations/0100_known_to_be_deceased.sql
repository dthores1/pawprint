-- Post-adoption deaths — an adopted animal that later dies in its adopter's
-- home must NOT move to status 'deceased' (that conveys a death in the
-- rescue's care). Instead the status stays 'adopted' and this flag records
-- that the animal is known to be deceased (so staff don't follow up, and the
-- profile can show "Adopted (Deceased)").
--
-- For consistency the flag is also true for in-care deaths (status
-- 'deceased'), where the status already conveys it — hence the backfill.

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS known_to_be_deceased boolean NOT NULL DEFAULT false;

UPDATE animals
  SET known_to_be_deceased = true
  WHERE status = 'deceased' AND NOT known_to_be_deceased;
