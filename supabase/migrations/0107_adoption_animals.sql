-- 0107_adoption_animals.sql
--
-- Multi-animal adoptions, so a Bonded Pair moves through ONE application
-- rather than two parallel records. Mirrors the transport_request_animals
-- pattern (0085), with one difference: adoptions.animal_id is KEPT as the
-- "primary" animal — every existing reader (reports, notifications 0066,
-- archive blockers) stays valid, and single-animal adoptions are unchanged.
-- The child table carries every animal on the record (primary included).
--
-- The app enforces the pairing rules (bonded partner auto-included, one
-- active adoption per animal); the DB provides the storage + uniqueness.
-- Idempotent; safe to re-run.

-- 1. Child table -----------------------------------------------------------
create table if not exists public.adoption_animals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  adoption_id uuid not null references public.adoptions(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists adoption_animals_adoption_animal_key
  on public.adoption_animals (adoption_id, animal_id);
create index if not exists adoption_animals_animal_idx
  on public.adoption_animals (animal_id);
create index if not exists adoption_animals_organization_idx
  on public.adoption_animals (organization_id);

alter table public.adoption_animals enable row level security;
drop policy if exists "org members manage adoption animals" on public.adoption_animals;
create policy "org members manage adoption animals"
  on public.adoption_animals
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 2. Backfill: every existing adoption covers its primary animal ------------
insert into public.adoption_animals (organization_id, adoption_id, animal_id)
select a.organization_id, a.id, a.animal_id
from public.adoptions a
on conflict (adoption_id, animal_id) do nothing;
