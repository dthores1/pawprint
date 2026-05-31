-- ============================================================
-- Whiskerville: backfill May 2026 adoptions
-- Run in the Supabase SQL editor (service_role bypasses RLS).
--
--   • 20 COMPLETED adoptions
--       - animal.status        → 'adopted'
--       - adoption.status      → 'completed'
--       - completed_at spread across May 1 – May 20, 2026
--         (all before May 24, with one per day starting May 1)
--       - full timeline stamped: submitted / paperwork sent /
--         paperwork completed / approved / completed
--       - foster_placements that were 'active' are closed
--
--   • 15 IN-PROGRESS adoptions
--       - animal.status        → 'adoption_pending'
--       - adoption.status      → spread across:
--           application_submitted (4) / meet_and_greet (4)
--           / pending_paperwork  (4) / ready_for_placement (3)
--       - timestamps stamped to match each status's progress
--         ('inquiry' is intentionally skipped — that status
--          keeps the animal as 'adoptable', not pending)
--
-- A short-lived scratch table holds the (animal, adopter, date, status)
-- picks so each subsequent INSERT/UPDATE operates on the same set. This
-- uses a regular table instead of a TEMP table because the Supabase SQL
-- editor may not keep TEMP tables alive across every statement it runs.
-- ============================================================

BEGIN;

-- 0. Set the org to backfill. CHANGE this UUID before running.
--    This value is used only while building the scratch table below.
DROP TABLE IF EXISTS public._adoption_picks;

-- 1. Pick 35 (animal, adopter) pairs into a scratch table.
CREATE TABLE public._adoption_picks (
  pick_no         int PRIMARY KEY,
  organization_id uuid NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('completed','pending')),
  animal_id       uuid NOT NULL,
  adopter_id      uuid NOT NULL,
  base_date       date NOT NULL,            -- completed: completion date; pending: anchor date
  adoption_status text NOT NULL,
  donation_amount numeric(10,2)
);

WITH
params AS (
  SELECT 'ba7403e4-d70b-4fcf-9b3e-5a1c0d821032'::uuid AS org_id
),
eligible_animals AS (
  -- Animals that can plausibly start/finish an adoption right now:
  -- not already in a terminal state, not already pending, no active adoption.
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM animals
  CROSS JOIN params
  WHERE organization_id = params.org_id
    AND status NOT IN ('adopted','adoption_pending','deceased','released','hospice')
    AND NOT EXISTS (
      SELECT 1 FROM adoptions ad
      WHERE ad.animal_id = animals.id
        AND ad.status NOT IN ('completed','cancelled')
    )
),
eligible_people AS (
  -- People who can be adopters: org-scoped, active, and not an account
  -- self-record (those have user_id set and are hidden from contacts).
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM people
  CROSS JOIN params
  WHERE organization_id = params.org_id
    AND user_id IS NULL
    AND active = true
)
INSERT INTO public._adoption_picks
  (pick_no, organization_id, kind, animal_id, adopter_id, base_date, adoption_status, donation_amount)
SELECT
  a.rn,
  params.org_id,
  CASE WHEN a.rn <= 20 THEN 'completed' ELSE 'pending' END,
  a.id,
  p.id,
  -- Completed: May 1..20 (one per day).  Pending: May 5..19.
  CASE
    WHEN a.rn <= 20 THEN (DATE '2026-05-01' + (a.rn - 1)  * INTERVAL '1 day')::date
    ELSE              (DATE '2026-05-05' + (a.rn - 21) * INTERVAL '1 day')::date
  END,
  CASE
    WHEN a.rn <= 20 THEN 'completed'
    -- Round-robin across the 4 non-terminal, non-inquiry statuses.
    ELSE (ARRAY['application_submitted','meet_and_greet','pending_paperwork','ready_for_placement'])
         [((a.rn - 21) % 4) + 1]
  END,
  -- Completed: $75–$550 spread.  Pending: filled in below for ready_for_placement.
  CASE WHEN a.rn <= 20 THEN (50 + a.rn * 25)::numeric(10,2) ELSE NULL END
FROM eligible_animals a
JOIN eligible_people  p USING (rn)
CROSS JOIN params
WHERE a.rn <= 35;

-- Donations get recorded when paperwork is done, so only ready_for_placement
-- on the pending side carries an amount.
UPDATE public._adoption_picks
SET donation_amount = (100 + pick_no * 10)::numeric(10,2)
WHERE kind = 'pending' AND adoption_status = 'ready_for_placement';

-- Fail loudly if there aren't enough eligible animals/people in this org.
DO $$
DECLARE
  n_done int;
  n_pend int;
BEGIN
  SELECT count(*) INTO n_done FROM public._adoption_picks WHERE kind = 'completed';
  SELECT count(*) INTO n_pend FROM public._adoption_picks WHERE kind = 'pending';
  IF n_done < 20 OR n_pend < 15 THEN
    RAISE EXCEPTION
      'Org % does not have enough eligible animals/people (got % completed, % pending; need 20 / 15)',
      (SELECT organization_id FROM public._adoption_picks LIMIT 1), n_done, n_pend;
  END IF;
END $$;

-- 2. Insert adoption rows for both batches.
INSERT INTO adoptions
  (organization_id, animal_id, adopter_id, status,
   submitted_at, approved_at, paperwork_sent_at, paperwork_completed_at,
   completed_at, donation_amount, notes, created_at, updated_at)
SELECT
  p.organization_id,
  p.animal_id,
  p.adopter_id,
  p.adoption_status,

  -- submitted_at: set on every status here (we don't insert any 'inquiry' rows).
  ((p.base_date - 10) + TIME '14:30')::timestamptz,

  -- approved_at: completed adoptions, or pending ones at ready_for_placement.
  CASE
    WHEN p.kind = 'completed'                      THEN ((p.base_date - 1) + TIME '11:00')::timestamptz
    WHEN p.adoption_status = 'ready_for_placement' THEN ((p.base_date + 5) + TIME '11:00')::timestamptz
    ELSE NULL
  END,

  -- paperwork_sent_at: pending_paperwork onward, plus every completed.
  CASE
    WHEN p.kind = 'completed'
      THEN ((p.base_date - 5) + TIME '09:00')::timestamptz
    WHEN p.adoption_status IN ('pending_paperwork','ready_for_placement')
      THEN ((p.base_date + 3) + TIME '09:00')::timestamptz
    ELSE NULL
  END,

  -- paperwork_completed_at: ready_for_placement, plus every completed.
  CASE
    WHEN p.kind = 'completed'                      THEN ((p.base_date - 1) + TIME '10:30')::timestamptz
    WHEN p.adoption_status = 'ready_for_placement' THEN ((p.base_date + 5) + TIME '10:30')::timestamptz
    ELSE NULL
  END,

  -- completed_at: only on the completed batch.
  CASE WHEN p.kind = 'completed' THEN (p.base_date + TIME '15:00')::timestamptz ELSE NULL END,

  p.donation_amount,

  CASE WHEN p.kind = 'completed'
       THEN 'Backfilled — finalized adoption.'
       ELSE 'Backfilled — in-progress adoption.'
  END,

  -- created_at: 14 days before completion for completed; 7 days before anchor for pending.
  CASE
    WHEN p.kind = 'completed' THEN ((p.base_date - 14) + TIME '10:00')::timestamptz
    ELSE                            ((p.base_date - 7)  + TIME '10:00')::timestamptz
  END,
  CASE
    WHEN p.kind = 'completed' THEN ((p.base_date - 14) + TIME '10:00')::timestamptz
    ELSE                            ((p.base_date - 7)  + TIME '10:00')::timestamptz
  END
FROM public._adoption_picks p;

-- 3. Advance the animals' lifecycle status.
UPDATE animals a
SET status            = 'adopted',
    adopted_by_id     = p.adopter_id,
    adopted_at        = (p.base_date + TIME '15:00')::timestamptz,
    current_foster_id = NULL
FROM public._adoption_picks p
WHERE p.animal_id = a.id AND p.kind = 'completed';

UPDATE animals a
SET status = 'adoption_pending'
FROM public._adoption_picks p
WHERE p.animal_id = a.id AND p.kind = 'pending';

-- 4. Close any active foster placements for the now-adopted animals.
--    (The partial unique index allows at most one active placement per animal,
--    so closing them is enough — no orphan rows left behind.)
UPDATE foster_placements fp
SET placement_status = 'completed',
    end_date         = (p.base_date + TIME '15:00')::timestamptz,
    reason_ended     = 'Adopted'
FROM public._adoption_picks p
WHERE fp.animal_id        = p.animal_id
  AND fp.placement_status = 'active'
  AND p.kind              = 'completed';

-- 5. Make sure every adopter carries the 'adopter' role (idempotent).
UPDATE people
SET roles = array_append(roles, 'adopter')
WHERE id IN (SELECT DISTINCT adopter_id FROM public._adoption_picks)
  AND NOT ('adopter' = ANY (roles));

-- 6. Eyeball the result before committing.
SELECT kind,
       adoption_status,
       count(*) AS n,
       min(base_date) AS first_date,
       max(base_date) AS last_date
FROM public._adoption_picks
GROUP BY kind, adoption_status
ORDER BY kind, adoption_status;

DROP TABLE IF EXISTS public._adoption_picks;

COMMIT;
