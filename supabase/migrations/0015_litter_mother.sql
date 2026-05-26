-- 0015_litter_mother.sql
-- A litter is a durable grouping object (a case), not just a sibling graph.
-- Record the mother directly on the litter so "Mother, if known" is a stable
-- field rather than something inferred from animal_relationships.
--
-- The mother is an existing animal (often kept after the litter is weaned), so
-- this references animals(id); ON DELETE SET NULL keeps the litter if she's removed.

ALTER TABLE litters
  ADD COLUMN IF NOT EXISTS mother_animal_id uuid REFERENCES animals(id) ON DELETE SET NULL;
