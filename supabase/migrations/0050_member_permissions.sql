-- 0050_member_permissions.sql
--
-- Per-member permission grants. A restricted action is allowed when the member
-- is an org admin/owner OR holds an active grant for the relevant permission.
-- First use: MANAGE_SUPPLY_REQUESTS (approve/fulfill supply requests, manage
-- supply options, and delegate the permission to others). The other types are
-- reserved for future Transport/Sitting gating — defined now, not yet enforced.
--
-- Grants attach to organization_members.id (a membership), not the user — if
-- someone leaves and rejoins, that's a fresh membership with no carried grants.
-- Reads are open to org members (so the client can resolve its own access + the
-- management UI can list grants); all WRITES go through SECURITY DEFINER RPCs.

-- 1. Table -----------------------------------------------------------------
create table if not exists public.member_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.organization_members(id) on delete cascade,
  permission_type text not null check (
    permission_type in (
      'MANAGE_SUPPLY_REQUESTS',
      'MANAGE_SUPPLY_OPTIONS',
      'MANAGE_TRANSPORT_REQUESTS',
      'MANAGE_SITTING_REQUESTS'
    )
  ),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by_member_id uuid references public.organization_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one ACTIVE grant per member+type (revoked rows stay for history).
create unique index if not exists member_permissions_active_unique
  on public.member_permissions (member_id, permission_type)
  where is_active;
create index if not exists member_permissions_org_idx
  on public.member_permissions (organization_id);

-- 2. RLS — read for org members; writes only via the RPCs below -------------
alter table public.member_permissions enable row level security;
drop policy if exists "org members read permissions" on public.member_permissions;
create policy "org members read permissions"
  on public.member_permissions
  for select
  using (is_org_member(organization_id));

-- 3. updated_at trigger ----------------------------------------------------
drop trigger if exists member_permissions_set_updated_at on public.member_permissions;
create trigger member_permissions_set_updated_at
  before update on public.member_permissions
  for each row execute function public.set_updated_at();

-- 4. Permission check — admin OR an active grant for the calling user -------
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
      and mp.permission_type = perm
      and mp.is_active
      and (mp.starts_at is null or mp.starts_at <= now())
      and (mp.ends_at is null or mp.ends_at >= now())
  );
$$;

-- 5. Grant / revoke RPCs ---------------------------------------------------
-- Authority to manage supply permissions = admin OR holder of
-- MANAGE_SUPPLY_REQUESTS (delegated granting). Adjust per-type later if the
-- other permission types start being enforced.
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
    'MANAGE_TRANSPORT_REQUESTS','MANAGE_SITTING_REQUESTS'
  ) then
    raise exception 'Invalid permission type';
  end if;

  select organization_id into v_org from organization_members where id = p_member_id;
  if v_org is null then raise exception 'Member not found'; end if;

  if not public.has_member_permission(v_org, 'MANAGE_SUPPLY_REQUESTS') then
    raise exception 'Not allowed to manage supply permissions' using errcode = '42501';
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

  if not public.has_member_permission(v_org, 'MANAGE_SUPPLY_REQUESTS') then
    raise exception 'Not allowed to manage supply permissions' using errcode = '42501';
  end if;

  update member_permissions
    set is_active = false, ends_at = now(), updated_at = now()
    where member_id = p_member_id
      and permission_type = p_permission_type
      and is_active;
end;
$$;
grant execute on function public.revoke_member_permission(uuid, text) to authenticated;
