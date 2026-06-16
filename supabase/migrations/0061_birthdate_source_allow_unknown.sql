-- 0061_birthdate_source_allow_unknown.sql
-- Allow `birthdate_source = 'unknown'` so an animal's age can be recorded as
-- Unknown at intake (common for trapped/feral animals) and filled in later
-- (e.g. during clinic completion).
--
-- The CHECK constraint on animals.birthdate_source was added directly in the
-- live database (it isn't in the migration files — see the "migrations are not a
-- full replay" note), so this drops it by its conventional name and recreates it
-- with 'unknown' included. Idempotent and safe to re-run; existing rows already
-- use the previously-allowed values, so re-validation passes.
alter table public.animals
  drop constraint if exists animals_birthdate_source_check;

alter table public.animals
  add constraint animals_birthdate_source_check check (
    birthdate_source is null or
    birthdate_source in (
      'exact_birthdate',
      'estimated_birthdate',
      'estimated_age',
      'unknown'
    )
  );
