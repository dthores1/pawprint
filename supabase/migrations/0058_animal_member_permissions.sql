-- 0058_animal_member_permissions.sql
-- Gate animal/litter management behind explicit permissions, and grant ACTIVE
-- fosters a limited "care collaboration" scope on the animals assigned to them.
--
-- Authority model for every animal-related write:
--   admin/owner  OR  explicit MANAGE_* grant  OR  active-foster-of-this-animal
-- (Demo mode runs entirely in memory with no Supabase, so RLS never applies
--  there — the demo user is an owner and keeps full access.)
--
-- New permission types:
--   MANAGE_ANIMALS            full animal + litter create/update/delete + relationships
--   MANAGE_MEDICAL            medical_records writes (and Clinics, gated app-side)
--   MANAGE_EXTERNAL_LISTINGS  animal_external_listings writes
--
-- "Active foster" = a foster_placements row for the animal with
-- placement_status='active' whose person_id -> people.user_id = auth.uid().
-- Former fosters (completed/interrupted) keep read access but lose all writes.
--
-- Idempotent DDL throughout (create or replace / drop if exists / named
-- constraint drop+add) per the repo's "migrations are not a full replay" rule.

-- ---------- 1. Extend the permission_type CHECK ----------
alter table public.member_permissions
  drop constraint if exists member_permissions_permission_type_check;
alter table public.member_permissions
  add constraint member_permissions_permission_type_check check (
    permission_type in (
      'MANAGE_SUPPLY_REQUESTS',
      'MANAGE_SUPPLY_OPTIONS',
      'MANAGE_TRANSPORT_REQUESTS',
      'MANAGE_SITTING_REQUESTS',
      'MANAGE_SITES',
      'MANAGE_ANIMALS',
      'MANAGE_MEDICAL',
      'MANAGE_EXTERNAL_LISTINGS'
    )
  );

-- ---------- 2. Extend the grant/revoke RPC allow-lists ----------
-- Same bodies as 0051, with the three new types added to each IN-list.
create or replace function public.grant_member_permission(
  p_member_id uuid,
  p_permission_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_permission_type not in (
    'MANAGE_SUPPLY_REQUESTS','MANAGE_SUPPLY_OPTIONS',
    'MANAGE_TRANSPORT_REQUESTS','MANAGE_SITTING_REQUESTS','MANAGE_SITES',
    'MANAGE_ANIMALS','MANAGE_MEDICAL','MANAGE_EXTERNAL_LISTINGS'
  ) then
    raise exception 'Invalid permission type';
  end if;

  select organization_id into v_org from organization_members where id = p_member_id;
  if v_org is null then raise exception 'Member not found'; end if;

  if not public.has_member_permission(v_org, p_permission_type) then
    raise exception 'Not allowed to manage this permission' using errcode = '42501';
  end if;

  select id into v_actor
  from organization_members
  where organization_id = v_org and user_id = auth.uid();

  insert into member_permissions (
    organization_id, member_id, permission_type,
    is_active, starts_at, ends_at, granted_by_member_id
  )
  values (v_org, p_member_id, p_permission_type, true, now(), null, v_actor)
  on conflict (member_id, permission_type) where is_active
  do update set
    is_active = true,
    ends_at = null,
    granted_by_member_id = v_actor,
    updated_at = now();
end;
$$;
grant execute on function public.grant_member_permission(uuid, text) to authenticated;

create or replace function public.revoke_member_permission(
  p_member_id uuid,
  p_permission_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select organization_id into v_org from organization_members where id = p_member_id;
  if v_org is null then raise exception 'Member not found'; end if;

  if not public.has_member_permission(v_org, p_permission_type) then
    raise exception 'Not allowed to manage this permission' using errcode = '42501';
  end if;

  update member_permissions
    set is_active = false, ends_at = now(), updated_at = now()
    where member_id = p_member_id
      and permission_type = p_permission_type
      and is_active;
end;
$$;
grant execute on function public.revoke_member_permission(uuid, text) to authenticated;

-- ---------- 3. is_active_foster helper ----------
-- True iff the calling user currently fosters this animal (active placement).
-- SECURITY DEFINER + pinned search_path, mirroring is_org_member/is_org_admin.
-- Safe from RLS recursion: foster_placements/people policies call only
-- is_org_member, never is_active_foster.
create or replace function public.is_active_foster(p_animal uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from foster_placements fp
    join people p on p.id = fp.person_id
    where fp.animal_id = p_animal
      and fp.placement_status = 'active'
      and p.user_id = auth.uid()
  );
$$;
grant execute on function public.is_active_foster(uuid) to authenticated;

-- ---------- 4. Column-scope trigger for foster-only animal updates ----------
-- RLS lets an active foster UPDATE their animal's row, but they may only change
-- care flags / the profile photo. This trigger enforces the column whitelist.
-- Full-permission actors (admin/owner or MANAGE_ANIMALS) bypass entirely.
--
-- Fail-closed allow-list via jsonb diff: any changed column NOT in the whitelist
-- is rejected, so a future column added to `animals` is denied to fosters by
-- default rather than silently writable. `updated_at` is whitelisted because the
-- existing set_updated_at trigger stamps it on every update.
create or replace function public.enforce_foster_animal_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists animals_enforce_foster_update_scope on public.animals;
create trigger animals_enforce_foster_update_scope
  before update on public.animals
  for each row execute function public.enforce_foster_animal_update_scope();

-- ---------- 5. Replace blanket FOR ALL policies with split policies ----------
-- SELECT stays open to any org member everywhere. Writes are gated per the
-- authority model. NOTE: before deploying to an org whose schema was applied by
-- hand, confirm via pg_policies that the only permissive policies on these
-- tables are the ones managed here — a stray FOR ALL policy would OR-widen.

-- animals --------------------------------------------------------------------
drop policy if exists "org members manage animals" on public.animals;

drop policy if exists "animals select org members" on public.animals;
create policy "animals select org members"
  on public.animals for select to authenticated
  using (is_org_member(organization_id));

drop policy if exists "animals insert managers" on public.animals;
create policy "animals insert managers"
  on public.animals for insert to authenticated
  with check (has_member_permission(organization_id, 'MANAGE_ANIMALS'));

drop policy if exists "animals delete managers" on public.animals;
create policy "animals delete managers"
  on public.animals for delete to authenticated
  using (has_member_permission(organization_id, 'MANAGE_ANIMALS'));

-- UPDATE: managers OR the active foster. Column scope for foster-only users is
-- enforced by animals_enforce_foster_update_scope (above).
drop policy if exists "animals update managers or foster" on public.animals;
create policy "animals update managers or foster"
  on public.animals for update to authenticated
  using (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(id)
  )
  with check (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(id)
  );

-- litters --------------------------------------------------------------------
drop policy if exists "org members manage litters" on public.litters;

drop policy if exists "litters select org members" on public.litters;
create policy "litters select org members"
  on public.litters for select to authenticated
  using (is_org_member(organization_id));

drop policy if exists "litters write managers" on public.litters;
create policy "litters write managers"
  on public.litters for all to authenticated
  using (has_member_permission(organization_id, 'MANAGE_ANIMALS'))
  with check (has_member_permission(organization_id, 'MANAGE_ANIMALS'));

-- medical_records ------------------------------------------------------------
drop policy if exists "org members manage medical" on public.medical_records;

drop policy if exists "medical select org members" on public.medical_records;
create policy "medical select org members"
  on public.medical_records for select to authenticated
  using (is_org_member(organization_id));

drop policy if exists "medical write managers" on public.medical_records;
create policy "medical write managers"
  on public.medical_records for all to authenticated
  using (has_member_permission(organization_id, 'MANAGE_MEDICAL'))
  with check (has_member_permission(organization_id, 'MANAGE_MEDICAL'));

-- animal_external_listings ---------------------------------------------------
drop policy if exists "org members manage external listings" on public.animal_external_listings;

drop policy if exists "listings select org members" on public.animal_external_listings;
create policy "listings select org members"
  on public.animal_external_listings for select to authenticated
  using (is_org_member(organization_id));

drop policy if exists "listings write managers" on public.animal_external_listings;
create policy "listings write managers"
  on public.animal_external_listings for all to authenticated
  using (has_member_permission(organization_id, 'MANAGE_EXTERNAL_LISTINGS'))
  with check (has_member_permission(organization_id, 'MANAGE_EXTERNAL_LISTINGS'));

-- animal_relationships -------------------------------------------------------
drop policy if exists "org members manage relationships" on public.animal_relationships;

drop policy if exists "relationships select org members" on public.animal_relationships;
create policy "relationships select org members"
  on public.animal_relationships for select to authenticated
  using (is_org_member(organization_id));

drop policy if exists "relationships write managers" on public.animal_relationships;
create policy "relationships write managers"
  on public.animal_relationships for all to authenticated
  using (has_member_permission(organization_id, 'MANAGE_ANIMALS'))
  with check (has_member_permission(organization_id, 'MANAGE_ANIMALS'));

-- Foster-collaboration child tables: managers OR active foster of the animal.
-- animal_notes ---------------------------------------------------------------
drop policy if exists "org members manage notes" on public.animal_notes;

drop policy if exists "notes select org members" on public.animal_notes;
create policy "notes select org members"
  on public.animal_notes for select to authenticated
  using (is_org_member(organization_id));

drop policy if exists "notes write managers or foster" on public.animal_notes;
create policy "notes write managers or foster"
  on public.animal_notes for all to authenticated
  using (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(animal_id)
  )
  with check (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(animal_id)
  );

-- animal_photos --------------------------------------------------------------
drop policy if exists "org members manage photos" on public.animal_photos;

drop policy if exists "photos select org members" on public.animal_photos;
create policy "photos select org members"
  on public.animal_photos for select to authenticated
  using (is_org_member(organization_id));

drop policy if exists "photos write managers or foster" on public.animal_photos;
create policy "photos write managers or foster"
  on public.animal_photos for all to authenticated
  using (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(animal_id)
  )
  with check (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(animal_id)
  );

-- animal_traits --------------------------------------------------------------
drop policy if exists "org members manage animal traits" on public.animal_traits;

drop policy if exists "traits select org members" on public.animal_traits;
create policy "traits select org members"
  on public.animal_traits for select to authenticated
  using (is_org_member(organization_id));

drop policy if exists "traits write managers or foster" on public.animal_traits;
create policy "traits write managers or foster"
  on public.animal_traits for all to authenticated
  using (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(animal_id)
  )
  with check (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(animal_id)
  );

-- animal_ai_content ----------------------------------------------------------
drop policy if exists "org members manage ai content" on public.animal_ai_content;

drop policy if exists "ai content select org members" on public.animal_ai_content;
create policy "ai content select org members"
  on public.animal_ai_content for select to authenticated
  using (is_org_member(organization_id));

drop policy if exists "ai content write managers or foster" on public.animal_ai_content;
create policy "ai content write managers or foster"
  on public.animal_ai_content for all to authenticated
  using (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(animal_id)
  )
  with check (
    has_member_permission(organization_id, 'MANAGE_ANIMALS')
    or is_active_foster(animal_id)
  );
