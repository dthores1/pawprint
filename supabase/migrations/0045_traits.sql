-- 0045_traits.sql
--
-- Animal traits: lightweight, reusable, per-org labels for an animal's
-- personality/behavior/placement needs (Dog Friendly, Shy, Litter Box Trained…).
--
-- `traits` are PER-ORG owned (each org has its own rows + can customize),
-- unlike the global species/breeds catalog. `animal_traits` is the junction.
-- Both carry organization_id and use the standard is_org_member RLS policy
-- (admin-only management is enforced in the Settings UI, consistent with the
-- rest of the app — there is no DB-level role gating here).

-- 1. traits ----------------------------------------------------------------
create table if not exists public.traits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  -- null = applies to all species; set = species-specific (e.g. Litter Box → Cat)
  species_id uuid references public.species(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique per org + name (case-insensitive) + species scope. The coalesce maps
-- the "all species" (null) case to a fixed sentinel so it participates in the
-- unique index (NULLs are otherwise distinct).
create unique index if not exists traits_org_name_species_unique
  on public.traits (
    organization_id,
    lower(name),
    coalesce(species_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists idx_traits_org_active on public.traits (organization_id, active);

alter table public.traits enable row level security;
drop policy if exists "org members manage traits" on public.traits;
create policy "org members manage traits"
  on public.traits
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 2. animal_traits (junction) ---------------------------------------------
create table if not exists public.animal_traits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  trait_id uuid not null references public.traits(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists animal_traits_animal_trait_unique
  on public.animal_traits (animal_id, trait_id);
create index if not exists idx_animal_traits_org on public.animal_traits (organization_id);
create index if not exists idx_animal_traits_trait on public.animal_traits (trait_id);

alter table public.animal_traits enable row level security;
drop policy if exists "org members manage animal traits" on public.animal_traits;
create policy "org members manage animal traits"
  on public.animal_traits
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 3. Default traits: seed per org (backfill existing + trigger for new) -----
create or replace function public.seed_org_traits(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.traits (organization_id, name, species_id)
  select p_org, d.name, s.id
  from (values
    -- General (all species)
    ('Affectionate', null::text), ('Playful', null), ('Shy', null),
    ('Independent', null), ('High Energy', null), ('Low Energy', null),
    ('Dog Friendly', null), ('Cat Friendly', null), ('Kid Friendly', null),
    ('Senior Friendly', null), ('Food Motivated', null),
    ('Needs Quiet Home', null), ('Needs Experienced Adopter', null),
    ('Bonded Pair', null), ('Special Needs', null),
    -- Species-specific
    ('House Trained', 'dog'), ('Crate Trained', 'dog'), ('Leash Trained', 'dog'),
    ('Litter Box Trained', 'cat')
  ) as d(name, species_slug)
  left join public.species s on s.slug = d.species_slug
  on conflict (
    organization_id,
    lower(name),
    coalesce(species_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) do nothing;
end;
$$;

-- Backfill every existing org.
select public.seed_org_traits(o.id) from public.organizations o;

-- Seed defaults for newly created orgs.
create or replace function public.seed_org_traits_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_org_traits(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_org_traits on public.organizations;
create trigger trg_seed_org_traits
  after insert on public.organizations
  for each row execute function public.seed_org_traits_on_insert();
