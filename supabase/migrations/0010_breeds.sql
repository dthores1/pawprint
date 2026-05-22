-- 0010_breeds.sql
-- Global breed reference catalog — shared across all orgs, so it has NO
-- organization_id (unlike every other table). The app only READS breeds;
-- custom/unknown breeds are stored as free text in animals.breed_text, not here.
--
-- Created ad-hoc earlier; captured here for version control. All statements are
-- guarded so it is safe to run against an existing DB.

create table if not exists breeds (
  id uuid primary key default gen_random_uuid(),
  species text not null check (
    species in ('dog', 'cat', 'rabbit', 'bird', 'other')
  ),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists breeds_species_active_idx on breeds (species, active);

-- Read-only reference data: any signed-in user may read it, and there is no org
-- scoping. Seeding/edits are done via the SQL editor (service_role bypasses RLS),
-- so no insert/update/delete policy is exposed to the app.
alter table breeds enable row level security;
drop policy if exists "breeds are readable by everyone" on breeds;
create policy "breeds are readable by everyone"
  on breeds for select
  using (true);
