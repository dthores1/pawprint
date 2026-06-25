-- 0082_foster_adoption_permissions.sql
--
-- Two new team permissions, plus a one-directional implication.
--
--   MANAGE_FOSTERS    — manage foster placements (place / reassign / end).
--   MANAGE_ADOPTIONS  — manage the adoption workflow (start / complete / return).
--
-- IMPLICATION: holding either MANAGE_FOSTERS or MANAGE_ADOPTIONS also confers
-- MANAGE_ANIMALS. Managing placements/adoptions inevitably touches the animal
-- record (current_foster_id, status), so we make fosters/adoptions depend on
-- animals rather than allow the half-state. The reverse does NOT hold:
-- MANAGE_ANIMALS alone grants neither.
--
-- The implication lives in ONE place — has_member_permission() — so every RLS
-- policy that checks MANAGE_ANIMALS (animals, litters, relationships, notes,
-- photos, traits, ai_content; see 0058) honors it automatically.
--
-- Grant AUTHORITY is deliberately NOT subject to the implication (it uses a
-- direct check), so a foster manager can't escalate by granting MANAGE_ANIMALS
-- to others.
--
-- Idempotent DDL throughout. Demo mode has no Supabase, so RLS never applies
-- there — the demo user is an owner and keeps full access.

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
      'MANAGE_EXTERNAL_LISTINGS',
      'MANAGE_FOSTERS',
      'MANAGE_ADOPTIONS'
    )
  );

-- ---------- 2. Feature-access check, WITH the implication ----------
-- Used by every feature RLS policy. A request for MANAGE_ANIMALS is satisfied by
-- a direct MANAGE_ANIMALS grant OR by MANAGE_FOSTERS / MANAGE_ADOPTIONS.
create or replace function public.has_member_permission(org uuid, perm text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_org_admin(org) or exists (
    select 1
    from member_permissions mp
    join organization_members om on om.id = mp.member_id
    where mp.organization_id = org
      and om.user_id = auth.uid()
      and (
        mp.permission_type = perm
        or (
          perm = 'MANAGE_ANIMALS'
          and mp.permission_type in ('MANAGE_FOSTERS', 'MANAGE_ADOPTIONS')
        )
      )
      and mp.is_active
      and (mp.starts_at is null or mp.starts_at <= now())
      and (mp.ends_at is null or mp.ends_at >= now())
  );
$$;

-- ---------- 3. Direct (non-implied) check, for grant authority ----------
-- Identical to the pre-implication check. Granting/revoking a permission
-- requires admin OR holding that EXACT permission — the implication must not
-- let a MANAGE_FOSTERS holder hand out MANAGE_ANIMALS.
create or replace function public.has_member_permission_direct(org uuid, perm text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_org_admin(org) or exists (
    select 1
    from member_permissions mp
    join organization_members om on om.id = mp.member_id
    where mp.organization_id = org
      and om.user_id = auth.uid()
      and mp.permission_type = perm
      and mp.is_active
      and (mp.starts_at is null or mp.starts_at <= now())
      and (mp.ends_at is null or mp.ends_at >= now())
  );
$$;

-- ---------- 4. Grant / revoke RPCs ----------
-- Same bodies as 0058, but: the type allow-list gains the two new types, and the
-- authority check uses has_member_permission_DIRECT (no implication).
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
    'MANAGE_ANIMALS','MANAGE_MEDICAL','MANAGE_EXTERNAL_LISTINGS',
    'MANAGE_FOSTERS','MANAGE_ADOPTIONS'
  ) then
    raise exception 'Invalid permission type';
  end if;

  select organization_id into v_org from organization_members where id = p_member_id;
  if v_org is null then raise exception 'Member not found'; end if;

  if not public.has_member_permission_direct(v_org, p_permission_type) then
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

  if not public.has_member_permission_direct(v_org, p_permission_type) then
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

-- ---------- 5. RLS: foster_placements → MANAGE_FOSTERS ----------
-- SELECT stays open to any org member; writes (place / reassign / end / archive)
-- require MANAGE_FOSTERS. Animal-row side effects (current_foster_id) pass via
-- the MANAGE_ANIMALS implication.
drop policy if exists "org members manage placements" on public.foster_placements;
drop policy if exists "placements select org members" on public.foster_placements;
create policy "placements select org members"
  on public.foster_placements for select to authenticated
  using (is_org_member(organization_id));
drop policy if exists "placements write foster managers" on public.foster_placements;
create policy "placements write foster managers"
  on public.foster_placements for all to authenticated
  using (has_member_permission(organization_id, 'MANAGE_FOSTERS'))
  with check (has_member_permission(organization_id, 'MANAGE_FOSTERS'));

-- ---------- 6. RLS: adoptions → MANAGE_ADOPTIONS ----------
-- SELECT open to org members; writes (start / complete / return — returns are
-- columns on this table per 0029) require MANAGE_ADOPTIONS. Animal status side
-- effects pass via the MANAGE_ANIMALS implication.
drop policy if exists "org members manage adoptions" on public.adoptions;
drop policy if exists "adoptions select org members" on public.adoptions;
create policy "adoptions select org members"
  on public.adoptions for select to authenticated
  using (is_org_member(organization_id));
drop policy if exists "adoptions write managers" on public.adoptions;
create policy "adoptions write managers"
  on public.adoptions for all to authenticated
  using (has_member_permission(organization_id, 'MANAGE_ADOPTIONS'))
  with check (has_member_permission(organization_id, 'MANAGE_ADOPTIONS'));
