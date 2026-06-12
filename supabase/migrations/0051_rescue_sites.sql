-- 0051_rescue_sites.sql
-- ============================================================
-- Rescue Sites — a physical location reported to the rescue (e.g. a community
-- cat colony) that animals are taken from. A site has an address (map pin), a
-- point-of-contact person, a status lifecycle, free-form notes, and a roster of
-- animals (via animals.site_id).
--
-- Access model: every org member can READ sites (and site notes). Creating /
-- editing / deleting a site requires the new MANAGE_SITES permission — admins
-- always have it (has_member_permission returns true for admins). Site notes
-- are readable + writable by any org member (parallel to animal_notes).
--
-- Depends on 0001 (orgs/animals/helpers), 0004 (people), 0050 (member_permissions).
-- ============================================================

-- ---------- 1. sites ----------
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  notes text,

  -- Point of contact (the person who reported / manages the site).
  contact_id uuid references public.people(id) on delete set null,

  -- Structured address (prefix `address_*`, round-trips through
  -- addressToColumns/addressFromColumns in src/lib/address.ts). The map pin and
  -- "distance from you" come from address_latitude / address_longitude.
  address_google_place_id text,
  address_formatted text,
  address_street_1 text,
  address_street_2 text,
  address_city text,
  address_state text,
  address_postal_code text,
  address_country text,
  address_latitude double precision,
  address_longitude double precision,

  status text not null default 'reported' check (
    status in ('reported', 'assessing', 'active', 'monitoring', 'closed')
  ),

  -- Soft-delete (matches the coordination tables; loadCoordination filters
  -- is_deleted = false). Sites are not yet wired into the Recycle Bin RPCs;
  -- deletion is a direct RLS-gated soft update by a MANAGE_SITES holder.
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sites_org_status_idx
  on public.sites (organization_id, status);
create index if not exists sites_active_org_idx
  on public.sites (organization_id) where is_deleted = false;

create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

-- ---------- 2. site_notes (parallel to animal_notes) ----------
create table if not exists public.site_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,

  body text not null,

  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists site_notes_site_idx on public.site_notes (site_id);
create index if not exists site_notes_active_org_idx
  on public.site_notes (organization_id) where is_deleted = false;

-- ---------- 3. animals.site_id ----------
alter table public.animals
  add column if not exists site_id uuid references public.sites(id) on delete set null;
create index if not exists animals_site_idx on public.animals (site_id);

-- ---------- 4. RLS ----------
alter table public.sites      enable row level security;
alter table public.site_notes enable row level security;

-- sites: read for any org member; write gated by MANAGE_SITES (admins included).
drop policy if exists "org members read sites" on public.sites;
create policy "org members read sites"
  on public.sites for select
  using (is_org_member(organization_id));

drop policy if exists "site managers insert sites" on public.sites;
create policy "site managers insert sites"
  on public.sites for insert
  with check (has_member_permission(organization_id, 'MANAGE_SITES'));

drop policy if exists "site managers update sites" on public.sites;
create policy "site managers update sites"
  on public.sites for update
  using (has_member_permission(organization_id, 'MANAGE_SITES'))
  with check (has_member_permission(organization_id, 'MANAGE_SITES'));

drop policy if exists "site managers delete sites" on public.sites;
create policy "site managers delete sites"
  on public.sites for delete
  using (has_member_permission(organization_id, 'MANAGE_SITES'));

-- site_notes: any org member may read + add notes (like animal_notes).
drop policy if exists "org members manage site notes" on public.site_notes;
create policy "org members manage site notes"
  on public.site_notes for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- ---------- 5. MANAGE_SITES permission type ----------
alter table public.member_permissions
  drop constraint if exists member_permissions_permission_type_check;
alter table public.member_permissions
  add constraint member_permissions_permission_type_check check (
    permission_type in (
      'MANAGE_SUPPLY_REQUESTS',
      'MANAGE_SUPPLY_OPTIONS',
      'MANAGE_TRANSPORT_REQUESTS',
      'MANAGE_SITTING_REQUESTS',
      'MANAGE_SITES'
    )
  );

-- Re-create the grant/revoke RPCs (defined originally in 0050) to (a) accept
-- MANAGE_SITES and (b) generalize the authority check: you may delegate a
-- permission you hold — admin OR an active grant of the SAME permission type.
-- This preserves existing supply behavior (admin OR MANAGE_SUPPLY_REQUESTS
-- holder grants MANAGE_SUPPLY_REQUESTS) and enables site delegation.
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
    'MANAGE_TRANSPORT_REQUESTS','MANAGE_SITTING_REQUESTS','MANAGE_SITES'
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
