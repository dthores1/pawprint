-- ============================================================
-- Pawprint: coordination tables — products, supply requests, transports,
-- sitting requests, clinics. Plus people.user_id to link an auth user to
-- their own person record (so "requested by" can be the signed-in user).
-- Depends on 0001 (orgs/animals/helpers), 0002 (foster_placements),
-- 0004 (people).
-- ============================================================

-- Link the signed-in auth user to a person record (their "self" contact).
alter table people add column user_id uuid references auth.users(id) on delete set null;
create index on people (user_id);

-- ---------- Products (org catalog) ----------

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text not null check (
    category in ('food', 'litter', 'medical', 'bedding', 'enrichment', 'cleaning', 'other')
  ),
  default_unit text not null default 'each',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Supply requests ----------

create table supply_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  requester_person_id uuid references people(id) on delete set null,
  requested_for_animal_id uuid references animals(id) on delete set null,
  status text not null default 'submitted' check (
    status in ('submitted', 'reviewing', 'approved', 'ordered',
               'ready_for_pickup', 'delivered', 'completed', 'canceled')
  ),
  priority text not null default 'normal' check (
    priority in ('normal', 'urgent', 'critical')
  ),
  requested_date timestamptz not null default now(),
  needed_by_date timestamptz,
  approved_by_person_id uuid references people(id) on delete set null,
  fulfilled_by_person_id uuid references people(id) on delete set null,
  fulfilled_date timestamptz,
  delivery_method text check (delivery_method in ('pickup', 'drop_off', 'shipped')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supply_request_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supply_request_id uuid not null references supply_requests(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  custom_item_name text,
  quantity numeric not null default 1,
  unit text not null default 'each',
  notes text
);

-- ---------- Clinics ----------

create table clinic_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  date_time timestamptz not null,
  location text not null,
  veterinarian_person_id uuid references people(id) on delete set null,
  contact_person_id uuid references people(id) on delete set null,
  slot_capacity integer not null default 1 check (slot_capacity >= 0),
  transport_coordinator_person_id uuid references people(id) on delete set null,
  intake_coordinator_person_id uuid references people(id) on delete set null,
  notes text,
  status text not null default 'planning' check (
    status in ('planning', 'scheduled', 'in_progress', 'completed', 'canceled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clinic_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  clinic_event_id uuid not null references clinic_events(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  procedure_type text not null check (
    procedure_type in ('spay_neuter', 'vaccines', 'dental', 'exam', 'recheck', 'other')
  ),
  reserved_by_person_id uuid references people(id) on delete set null,
  status text not null default 'reserved' check (
    status in ('reserved', 'confirmed', 'completed', 'no_show', 'canceled')
  ),
  notes text
);

-- ---------- Transports (refs clinic_events + supply_requests) ----------

create table transport_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null check (type in ('animal', 'supplies', 'emergency')),
  status text not null default 'open' check (
    status in ('open', 'claimed', 'in_progress', 'completed', 'canceled')
  ),
  requested_by_person_id uuid references people(id) on delete set null,
  assigned_volunteer_person_id uuid references people(id) on delete set null,
  animal_id uuid references animals(id) on delete set null,
  clinic_event_id uuid references clinic_events(id) on delete set null,
  supply_request_id uuid references supply_requests(id) on delete set null,
  pickup_location text not null,
  dropoff_location text not null,
  requested_pickup_time timestamptz not null,
  completed_at timestamptz,
  notes text,
  urgency text not null default 'normal' check (
    urgency in ('normal', 'urgent', 'critical')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Sitting requests ----------

create table sitting_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  requested_by_person_id uuid references people(id) on delete set null,
  sitter_person_id uuid references people(id) on delete set null,
  coverage_scope text not null default 'all_current_placements' check (
    coverage_scope in ('all_current_placements', 'selected_placements')
  ),
  start_date date not null,
  end_date date not null,
  notes text,
  medication_required boolean not null default false,
  foster_provides_supplies boolean not null default true,
  transport_needed boolean not null default false,
  status text not null default 'open' check (
    status in ('open', 'claimed', 'in_progress', 'completed', 'canceled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sitting_request_placements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sitting_request_id uuid not null references sitting_requests(id) on delete cascade,
  foster_placement_id uuid not null references foster_placements(id) on delete cascade
);

-- ---------- Indexes ----------

create index on products (organization_id);
create index on supply_requests (organization_id);
create index on supply_request_items (organization_id);
create index on supply_request_items (supply_request_id);
create index on clinic_events (organization_id);
create index on clinic_slots (organization_id);
create index on clinic_slots (clinic_event_id);
create index on clinic_slots (animal_id);
create index on transport_requests (organization_id);
create index on sitting_requests (organization_id);
create index on sitting_request_placements (organization_id);
create index on sitting_request_placements (sitting_request_id);

-- ---------- updated_at triggers (reuse public.set_updated_at from 0001) ----------

create trigger products_set_updated_at
  before update on products
  for each row execute function public.set_updated_at();
create trigger supply_requests_set_updated_at
  before update on supply_requests
  for each row execute function public.set_updated_at();
create trigger clinic_events_set_updated_at
  before update on clinic_events
  for each row execute function public.set_updated_at();
create trigger transport_requests_set_updated_at
  before update on transport_requests
  for each row execute function public.set_updated_at();
create trigger sitting_requests_set_updated_at
  before update on sitting_requests
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------

alter table products                   enable row level security;
alter table supply_requests            enable row level security;
alter table supply_request_items       enable row level security;
alter table clinic_events              enable row level security;
alter table clinic_slots               enable row level security;
alter table transport_requests         enable row level security;
alter table sitting_requests           enable row level security;
alter table sitting_request_placements enable row level security;

create policy "org members manage products"
  on products for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org members manage supply requests"
  on supply_requests for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org members manage supply items"
  on supply_request_items for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org members manage clinic events"
  on clinic_events for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org members manage clinic slots"
  on clinic_slots for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org members manage transports"
  on transport_requests for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org members manage sitting requests"
  on sitting_requests for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org members manage sitting placements"
  on sitting_request_placements for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
