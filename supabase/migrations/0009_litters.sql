-- 0009_litters.sql
-- Litters group animals that share intake/age/origin metadata. Members link via
-- animals.litter_id; littermates are derived from that shared id (not from
-- AnimalRelationship rows).
--
-- The table + column were created ad-hoc earlier; this migration captures them
-- for version control and, importantly, adds the org-scoped RLS policy that was
-- missing (inserts were failing with "violates row-level security policy").
-- All statements are guarded so it is safe to run against an existing DB.

create table if not exists litters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text,
  species text not null,
  breed_id uuid references breeds(id),
  breed_text text,
  estimated_birth_date date,
  intake_date date not null,
  intake_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table animals
  add column if not exists litter_id uuid references litters(id) on delete set null;

create index if not exists litters_organization_id_idx on litters (organization_id);
create index if not exists animals_litter_id_idx on animals (litter_id);

-- updated_at trigger (reuse public.set_updated_at from 0001)
drop trigger if exists litters_set_updated_at on litters;
create trigger litters_set_updated_at
  before update on litters
  for each row execute function public.set_updated_at();

-- RLS — the missing piece that was blocking inserts.
alter table litters enable row level security;
drop policy if exists "org members manage litters" on litters;
create policy "org members manage litters"
  on litters for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
