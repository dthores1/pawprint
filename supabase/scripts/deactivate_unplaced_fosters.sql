-- deactivate_unplaced_fosters.sql
-- One-off cleanup. Marks foster_parent people who currently have no ACTIVE
-- foster placement as inactive (people.active = false), so they stop padding
-- the "Total Capacity" / "Available Spots" tiles on the Dashboard and Reports
-- pages without losing their records.
--
-- Run sections individually in the Supabase SQL editor. Step 1 is a dry-run
-- preview; step 2 is the actual update. If you want to keep a handful active
-- for realism, use step 2b instead (random subset).
--
-- NOTE: not parked in migrations/ on purpose — this is data, not schema, and
-- should not run automatically on a fresh DB.

-- ─────────────────────────────────────────────────────────────────────────
-- (Optional) Scope to a single organization. Find your org id:
--   select id, name from organizations;
-- Then either substitute the literal in the WHERE clauses below, or leave
-- them off to apply across every org you have access to.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Preview: foster_parents who would be flagged inactive.
select
  p.id,
  p.organization_id,
  p.first_name,
  p.last_name,
  p.max_capacity,
  p.active
from people p
where 'foster_parent' = any(p.roles)
  and p.active is true
  and not exists (
    select 1
      from foster_placements fp
     where fp.person_id = p.id
       and fp.placement_status = 'active'
  )
  -- and p.organization_id = '<your-org-id>'
order by p.last_name, p.first_name;

-- 2. Deactivate ALL matching foster_parents.
update people
   set active     = false,
       updated_at = now()
 where id in (
   select p.id
     from people p
    where 'foster_parent' = any(p.roles)
      and p.active is true
      and not exists (
        select 1
          from foster_placements fp
         where fp.person_id = p.id
           and fp.placement_status = 'active'
      )
   -- and p.organization_id = '<your-org-id>'
 );

-- 2b. (Alternative) Deactivate a random ~80% of the matching fosters,
--     leaving roughly one in five active for realism. Change the 0.2 below
--     to tune the share you want to keep active.
-- update people
--    set active     = false,
--        updated_at = now()
--  where id in (
--    select p.id
--      from people p
--     where 'foster_parent' = any(p.roles)
--       and p.active is true
--       and not exists (
--         select 1
--           from foster_placements fp
--          where fp.person_id = p.id
--            and fp.placement_status = 'active'
--       )
--       and random() > 0.2
--    -- and p.organization_id = '<your-org-id>'
--  );
