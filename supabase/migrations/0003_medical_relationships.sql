-- ============================================================
-- Whiskerville: medical records + animal relationships
-- Depends on 0001_init.sql (organizations, animals, helpers, set_updated_at).
-- ============================================================

-- ---------- Medical records ----------

create table medical_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,

  procedure_type text not null check (
    procedure_type in (
      'vaccine', 'exam', 'spay_neuter', 'medication',
      'surgery', 'microchip', 'deworming', 'test'
    )
  ),
  procedure_name text not null,
  performed_date date,
  due_date date,
  status text not null check (
    status in ('completed', 'due', 'scheduled', 'overdue', 'canceled')
  ),
  provider_name text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Animal relationships ----------
-- Stored one-directional (animal_id → related_animal_id with a type), rendered
-- bidirectionally in the app. See README §8.

create table animal_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  related_animal_id uuid not null references animals(id) on delete cascade,

  relationship_type text not null check (
    relationship_type in (
      'mother', 'father', 'sibling', 'child', 'bonded_pair', 'littermate'
    )
  ),
  notes text,

  created_at timestamptz not null default now(),

  -- An animal can't relate to itself, and the same exact link can't be added
  -- twice (the reverse direction is a different row and is allowed).
  constraint animal_relationships_not_self check (animal_id <> related_animal_id),
  constraint animal_relationships_unique
    unique (animal_id, related_animal_id, relationship_type)
);

-- ---------- Indexes ----------

create index on medical_records (organization_id);
create index on medical_records (animal_id);
create index on animal_relationships (organization_id);
-- Relationships are queried from both ends (the card derives the inverse).
create index on animal_relationships (animal_id);
create index on animal_relationships (related_animal_id);

-- ---------- updated_at trigger (reuse public.set_updated_at from 0001) ----------

create trigger medical_records_set_updated_at
  before update on medical_records
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------

alter table medical_records       enable row level security;
alter table animal_relationships  enable row level security;

create policy "org members manage medical"
  on medical_records for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy "org members manage relationships"
  on animal_relationships for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));
