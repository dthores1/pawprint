-- 0041_species_custom_icon_names.sql
--
-- Point the less-common species at the custom glyphs added under
-- src/assets/icons/animals (rendered via src/lib/speciesIcons.tsx). Reptile was
-- seeded as 'turtle' and Farm Animal / Horse as the generic 'paw-print'; give
-- them dedicated icon_names so the catalog-driven UI shows the right glyph.
-- (Small Mammal already uses 'rat'.) Idempotent.

update public.species set icon_name = 'reptile', updated_at = now() where slug = 'reptile';
update public.species set icon_name = 'pig',     updated_at = now() where slug = 'farm_animal';
update public.species set icon_name = 'horse',   updated_at = now() where slug = 'horse';
