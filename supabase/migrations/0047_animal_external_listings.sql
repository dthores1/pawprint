-- 0047_animal_external_listings.sql
--
-- External adoption listings: where an animal is posted online. Replaces the
-- single `animals.adoption_profile_url` field — orgs commonly post the same
-- animal to several platforms (Petfinder, Adopt-a-Pet, their own site, social),
-- so this is a one-to-many child table.
--
-- Org-scoped with the standard is_org_member RLS policy. Lightweight metadata,
-- so no soft-delete/Recycle-Bin columns — rows are hard-deleted. Groundwork for
-- future automated syncing (Petfinder); for now we just hold URLs + statuses.

-- 1. Table -----------------------------------------------------------------
create table if not exists public.animal_external_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  provider text not null check (
    provider in (
      'petfinder',
      'adopt_a_pet',
      'rescue_website',
      'facebook',
      'instagram',
      'other'
    )
  ),
  url text not null,
  status text not null default 'unknown' check (
    status in ('draft', 'published', 'removed', 'unknown')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists animal_external_listings_animal_idx
  on public.animal_external_listings (animal_id);

-- 2. RLS -------------------------------------------------------------------
alter table public.animal_external_listings enable row level security;
drop policy if exists "org members manage external listings"
  on public.animal_external_listings;
create policy "org members manage external listings"
  on public.animal_external_listings
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 3. updated_at trigger ----------------------------------------------------
drop trigger if exists animal_external_listings_set_updated_at
  on public.animal_external_listings;
create trigger animal_external_listings_set_updated_at
  before update on public.animal_external_listings
  for each row execute function public.set_updated_at();

-- 4. Backfill existing single URLs, then drop the legacy column -------------
-- Detect the provider from the URL host; everything else falls back to 'other'.
-- Existing URLs were live links, so they seed as 'published'.
insert into public.animal_external_listings
  (organization_id, animal_id, provider, url, status)
select
  organization_id,
  id,
  case
    when adoption_profile_url ilike '%petfinder.com%'  then 'petfinder'
    when adoption_profile_url ilike '%adoptapet.com%'  then 'adopt_a_pet'
    when adoption_profile_url ilike '%facebook.com%'   then 'facebook'
    when adoption_profile_url ilike '%instagram.com%'  then 'instagram'
    else 'other'
  end,
  adoption_profile_url,
  'published'
from public.animals
where adoption_profile_url is not null
  and btrim(adoption_profile_url) <> '';

alter table public.animals drop column if exists adoption_profile_url;
