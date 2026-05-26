-- ============================================================
-- Pawprint: foster parents + placements
-- Depends on 0001_init.sql (organizations, animals, helpers, set_updated_at).
-- ============================================================

-- ---------- Tables ----------

create table foster_parents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  address text,
  max_capacity integer not null default 1 check (max_capacity >= 0),
  -- text[] of species; `<@` ensures every element is in the allowed set.
  preferred_species text[] not null default '{}'::text[]
    check (preferred_species <@ array['Dog', 'Cat', 'Other']::text[]),
  notes text,
  active boolean not null default true,
  photo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table foster_placements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  foster_parent_id uuid not null references foster_parents(id) on delete cascade,

  start_date timestamptz not null default now(),
  end_date timestamptz,
  placement_status text not null default 'active'
    check (placement_status in ('active', 'completed', 'interrupted')),
  placement_type text not null default 'foster'
    check (placement_type in ('foster', 'medical_foster', 'trial_adoption')),
  reason_ended text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce the core invariant: at most one ACTIVE placement per animal.
-- (Reassignment must close the old placement before opening the new one.)
create unique index foster_placements_one_active_per_animal
  on foster_placements (animal_id)
  where placement_status = 'active';

-- ---------- Wire up the deferred animals.current_foster_id FK ----------
-- If this fails because existing rows hold non-foster ids, null them first:
--   update animals set current_foster_id = null where current_foster_id is not null;
alter table animals
  add constraint animals_current_foster_fk
  foreign key (current_foster_id) references foster_parents(id)
  on delete set null;

-- ---------- Indexes ----------

create index on foster_parents (organization_id);
create index on foster_placements (organization_id);
create index on foster_placements (animal_id);
create index on foster_placements (foster_parent_id);

-- ---------- updated_at triggers (reuse public.set_updated_at from 0001) ----------

create trigger foster_parents_set_updated_at
  before update on foster_parents
  for each row execute function public.set_updated_at();

create trigger foster_placements_set_updated_at
  before update on foster_placements
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------

alter table foster_parents    enable row level security;
alter table foster_placements enable row level security;

create policy "org members manage fosters"
  on foster_parents for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy "org members manage placements"
  on foster_placements for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));
