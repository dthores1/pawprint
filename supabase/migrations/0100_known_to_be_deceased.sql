-- Post-adoption deaths — an adopted animal that later dies in its adopter's
-- home must NOT move to status 'deceased' (that conveys a death in the
-- rescue's care). Instead the status stays 'adopted' and this flag records
-- that the animal is known to be deceased (so staff don't follow up, and the
-- profile can show "Adopted (Deceased)").
--
-- For consistency the flag is also true for in-care deaths (status
-- 'deceased'), where the status already conveys it — hence the backfill.

-- ---------------------------------------------------------------------------
-- 0. Guard the foster-scope trigger for service contexts.
--
-- Supersedes the 0058 definition. The trigger fails closed when auth.uid() is
-- null: has_member_permission() and is_active_foster() are both false, so ANY
-- animals UPDATE run from the SQL editor or with the service_role key raises
-- "Not permitted to update this animal" — including this migration's backfill.
--
-- A null auth.uid() only occurs in contexts that bypass RLS entirely (SQL
-- editor, service_role); every PostgREST request carries anon/authenticated,
-- and non-members never reach the trigger because the UPDATE policy filters
-- their rows first. So short-circuiting on null uid opens nothing that isn't
-- already fully trusted — same reasoning as add_org_creator_as_owner (0001).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_foster_animal_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service contexts (SQL editor, service_role) have no JWT and already
  -- bypass RLS; the foster scope rules are for signed-in API users only.
  if auth.uid() is null then
    return NEW;
  end if;

  if has_member_permission(NEW.organization_id, 'MANAGE_ANIMALS') then
    return NEW;
  end if;

  -- Only an active foster can reach here (the UPDATE policy guarantees
  -- manager-or-foster); fail closed otherwise.
  if not is_active_foster(NEW.id) then
    raise exception 'Not permitted to update this animal'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_each(to_jsonb(OLD)) o
    join jsonb_each(to_jsonb(NEW)) n using (key)
    where o.value is distinct from n.value
      and o.key not in (
        'is_on_hold',
        'has_behavior_concern',
        'has_medical_concern',
        'primary_photo_url',
        'updated_at'
      )
  ) then
    raise exception
      'Fosters may only change care flags or the profile photo on this animal'
      using errcode = '42501';
  end if;

  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. The flag + backfill.
-- ---------------------------------------------------------------------------
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS known_to_be_deceased boolean NOT NULL DEFAULT false;

UPDATE animals
  SET known_to_be_deceased = true
  WHERE status = 'deceased' AND NOT known_to_be_deceased;
