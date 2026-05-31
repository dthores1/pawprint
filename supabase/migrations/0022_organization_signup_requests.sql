-- Organization signup / beta access requests.
--
-- Backs the public "Request Beta Access" page (src/pages/RequestAccessPage.tsx).
-- Anonymous visitors may INSERT a request (status must be 'New' and the review
-- fields must be null); they cannot read existing requests. Reviewing/converting
-- is done by staff in the Supabase dashboard for now.
--
-- NOTE: this mirrors the table already created in the live project; it's added
-- here so the schema stays under version control with the rest of the migrations.

create table if not exists public.organization_signup_requests (
  id uuid primary key default gen_random_uuid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  organization_name text not null,
  organization_type text not null,

  contact_first_name text not null,
  contact_last_name text not null,
  contact_email text not null,
  contact_phone text,

  city text not null,
  state text not null,
  website text,

  animal_count_range text,
  notes text,

  status text not null default 'New',

  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  organization_id uuid references public.organizations(id),

  constraint organization_signup_requests_status_check
    check (status in ('New', 'Contacted', 'Approved', 'Rejected', 'Converted')),

  constraint organization_signup_requests_organization_type_check
    check (organization_type in (
      'Animal Rescue',
      'Shelter',
      'Foster-Based Rescue',
      'TNR Organization',
      'Other'
    )),

  constraint organization_signup_requests_animal_count_range_check
    check (
      animal_count_range is null
      or animal_count_range in ('1-25', '26-50', '51-100', '100+')
    ),

  constraint organization_signup_requests_contact_email_check
    check (position('@' in contact_email) > 1)
);

-- Useful indexes

create index if not exists idx_org_signup_requests_status
  on public.organization_signup_requests(status);

create index if not exists idx_org_signup_requests_created_at
  on public.organization_signup_requests(created_at desc);

create index if not exists idx_org_signup_requests_contact_email
  on public.organization_signup_requests(lower(contact_email));

-- Auto-update updated_at

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_org_signup_requests_updated_at
on public.organization_signup_requests;

create trigger trg_org_signup_requests_updated_at
before update on public.organization_signup_requests
for each row
execute function public.set_updated_at();

-- RLS

alter table public.organization_signup_requests enable row level security;

-- Allow public visitors to submit beta access requests.
-- They can insert, but they cannot read existing requests.

drop policy if exists "Allow public signup request submissions"
  on public.organization_signup_requests;
create policy "Allow public signup request submissions"
on public.organization_signup_requests
for insert
to anon
with check (
  status = 'New'
  and reviewed_at is null
  and reviewed_by is null
  and organization_id is null
);

-- Optional: allow authenticated users to submit too, in case someone signs in
-- first and then requests access.

drop policy if exists "Allow authenticated signup request submissions"
  on public.organization_signup_requests;
create policy "Allow authenticated signup request submissions"
on public.organization_signup_requests
for insert
to authenticated
with check (
  status = 'New'
  and reviewed_at is null
  and reviewed_by is null
  and organization_id is null
);
