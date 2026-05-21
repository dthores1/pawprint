-- ============================================================
-- Pawprint schema: organizations, members, animals, notes, photos
-- Multi-tenant with Supabase RLS.
-- ============================================================

-- ---------- Tables ----------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Maps Supabase auth users to orgs. Required so RLS knows which org(s) a
-- signed-in user may touch. `role` drives admin-only actions.
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table animals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  name text not null,
  species text not null check (species in ('Dog', 'Cat', 'Other')),
  sex text not null check (sex in ('Male', 'Female', 'Unknown')),

  estimated_birth_date date,
  intake_date date,
  intake_source text,

  status text not null check (
    status in ('intake', 'medical', 'hold', 'fostered', 'adoptable', 'adopted', 'hospice', 'deceased')
  ),
  priority text not null default 'normal' check (
    priority in ('normal', 'needs_attention', 'urgent', 'critical')
  ),

  action_needed text,
  description text,
  microchip_number text,
  primary_photo_url text,
  adoption_profile_url text,

  internal_notes text,
  current_foster_id uuid,  -- FK deferred until foster_parents exists (see below)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Add the FK once foster_parents exists:
--   alter table animals
--     add constraint animals_current_foster_fk
--     foreign key (current_foster_id) references foster_parents(id) on delete set null;

create table animal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,

  note_type text not null check (
    note_type in ('behavior', 'medical', 'foster_update', 'adoption', 'general')
  ),
  body text not null,

  created_by uuid references auth.users(id) on delete set null,  -- replaces author_name

  created_at timestamptz not null default now()
);

create table animal_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,

  category text not null check (
    category in ('intake', 'profile', 'medical', 'foster', 'adoption', 'post_adoption', 'other')
  ),
  storage_path text not null,
  public_url text,
  caption text,

  created_at timestamptz not null default now()  -- app's `uploaded_at` maps here
);

-- ---------- Indexes (Postgres does NOT auto-index FK columns) ----------

create index on organization_members (user_id);
create index on animals (organization_id);
create index on animal_notes (organization_id);
create index on animal_notes (animal_id);
create index on animal_photos (organization_id);
create index on animal_photos (animal_id);

-- ---------- updated_at trigger (default now() only fires on INSERT) ----------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function public.set_updated_at();

create trigger animals_set_updated_at
  before update on animals
  for each row execute function public.set_updated_at();

-- ---------- Membership helpers ----------
-- security definer so the lookups bypass RLS on organization_members and
-- don't recurse when used inside that table's own policies.

create or replace function public.is_org_member(org uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = org and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = org and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- When a user creates an org through the API, make them its owner so they
-- can see it immediately. Guarded so SQL-editor/service-role inserts
-- (where auth.uid() is null) don't fail.
create or replace function public.add_org_creator_as_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into organization_members (organization_id, user_id, role)
    values (new.id, auth.uid(), 'owner');
  end if;
  return new;
end;
$$;

create trigger organizations_add_creator
  after insert on organizations
  for each row execute function public.add_org_creator_as_owner();

-- ---------- Enable RLS ----------

alter table organizations        enable row level security;
alter table organization_members enable row level security;
alter table animals              enable row level security;
alter table animal_notes         enable row level security;
alter table animal_photos        enable row level security;

-- ---------- Policies ----------

-- organizations
create policy "members read their orgs"
  on organizations for select using (is_org_member(id));
create policy "authenticated can create orgs"
  on organizations for insert with check (auth.uid() is not null);
create policy "admins update their org"
  on organizations for update using (is_org_admin(id)) with check (is_org_admin(id));
create policy "admins delete their org"
  on organizations for delete using (is_org_admin(id));

-- organization_members (members can see the roster; only admins change it)
create policy "members read co-members"
  on organization_members for select using (is_org_member(organization_id));
create policy "admins manage members"
  on organization_members for all
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

-- animals / notes / photos: any member has full access within their own org
create policy "org members manage animals"
  on animals for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org members manage notes"
  on animal_notes for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org members manage photos"
  on animal_photos for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
