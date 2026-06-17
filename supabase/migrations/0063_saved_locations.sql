-- 0063_saved_locations.sql
-- Reusable, per-org catalog of operational places ("ACP Clinic", "Melissa's
-- House") so transport pickup/dropoff can be a one-click saved location instead
-- of re-typing an address. Mirrors the Traits pattern (0045): per-org rows,
-- `is_org_member` RLS (admin-only management enforced in the Settings UI), and
-- the shared `location_*` structured-address column shape (see lib/address.ts
-- addressToColumns('location', …)).

create table if not exists public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- Structured address columns (addressToColumns('location', …)).
  location_google_place_id text,
  location_formatted text,
  location_street_1 text,
  location_street_2 text,
  location_city text,
  location_state text,
  location_postal_code text,
  location_country text,
  location_latitude numeric(10, 7),
  location_longitude numeric(10, 7),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One label per org (case-insensitive).
create unique index if not exists saved_locations_org_name_unique
  on public.saved_locations (organization_id, lower(name));
create index if not exists idx_saved_locations_org_active
  on public.saved_locations (organization_id, active);

alter table public.saved_locations enable row level security;
drop policy if exists "org members manage saved locations" on public.saved_locations;
create policy "org members manage saved locations"
  on public.saved_locations
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- Optional link from a transport leg to the saved location it came from, so the
-- card can show the friendly name while the copied pickup_*/dropoff_* columns
-- keep the address for maps/distance. SET NULL so deleting a saved location
-- doesn't orphan the request (its copied address remains).
alter table public.transport_requests
  add column if not exists pickup_saved_location_id uuid
    references public.saved_locations(id) on delete set null,
  add column if not exists dropoff_saved_location_id uuid
    references public.saved_locations(id) on delete set null;
