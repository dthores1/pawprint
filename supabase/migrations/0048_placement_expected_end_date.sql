-- 0048_placement_expected_end_date.sql
--
-- Temporary foster stays (emergency, holding-until-clinic, transport staging,
-- quarantine, trial-with-a-companion…) are still foster care — same model, just
-- time-boxed. Rather than a separate "temporary foster" concept, we add an
-- optional expected end date to the placement: "Current Foster: Jane · expected
-- through Jun 23". `end_date` stays the *actual* close date; this is the planned
-- one, set at placement time and never required.

alter table public.foster_placements
  add column if not exists expected_end_date date;
