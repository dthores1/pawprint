-- 0020_animal_photo_categories.sql
-- Collapse the animal_photos category taxonomy. Previously: intake, profile,
-- medical, foster, adoption, post_adoption, other. Now: intake, medical,
-- general, adoption_listing. The retired buckets fold into 'general' and
-- 'adoption' is renamed to 'adoption_listing' to match the UI label.

begin;

-- 1. Migrate existing rows to the new vocabulary.
update animal_photos
   set category = case category
     when 'adoption'      then 'adoption_listing'
     when 'profile'       then 'general'
     when 'foster'        then 'general'
     when 'post_adoption' then 'general'
     when 'other'         then 'general'
     else category
   end
 where category in ('adoption', 'profile', 'foster', 'post_adoption', 'other');

-- 2. Replace the CHECK constraint so only the new values are accepted.
alter table animal_photos
  drop constraint if exists animal_photos_category_check;

alter table animal_photos
  add constraint animal_photos_category_check
  check (category in (
    'intake',
    'medical',
    'general',
    'adoption_listing'
  ));

commit;
