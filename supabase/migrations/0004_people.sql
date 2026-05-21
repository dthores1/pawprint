-- ============================================================
-- Pawprint: people (contacts) — vets, rescue staff, volunteers, adopters.
-- Depends on 0001_init.sql (organizations, helpers, set_updated_at).
-- Note: distinct from foster_parents. The coordination tables (supply,
-- transport, sitting, clinics) will FK to this table when they're ported.
-- ============================================================

create table people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  role text not null check (
    role in ('vet', 'rescue_staff', 'volunteer', 'adopter')
  ),
  volunteer_type text check (
    volunteer_type in (
      'foster_parent', 'administrative', 'trapper', 'transport',
      'event_support', 'social_media', 'other'
    )
  ),
  organization_name text,
  notes text,
  photo_url text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on people (organization_id);

create trigger people_set_updated_at
  before update on people
  for each row execute function public.set_updated_at();

alter table people enable row level security;

create policy "org members manage people"
  on people for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));
