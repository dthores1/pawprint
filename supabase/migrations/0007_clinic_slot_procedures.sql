-- 0007_clinic_slot_procedures.sql
-- A clinic slot is one animal's appointment; an animal commonly gets several
-- procedures in a single visit (e.g. spay/neuter + vaccines + flea treatment).
-- Procedures move to a child table; clinic_slots.procedure_type is retired.
--
-- NOTE: organization_id is carried on this child table (like every other table
-- in the schema) so it can be loaded with `.eq('organization_id', …)` and gated
-- by the same is_org_member RLS policy as everything else.

create table clinic_slot_procedures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  clinic_slot_id uuid not null references clinic_slots(id) on delete cascade,
  procedure_type text not null check (
    procedure_type in (
      'spay_neuter',
      'vaccines',
      'dental',
      'exam',
      'recheck',
      'flea_treatment',
      'deworming',
      'microchip',
      'other'
    )
  ),
  notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_slot_id, procedure_type)
);

create index on clinic_slot_procedures (organization_id);
create index on clinic_slot_procedures (clinic_slot_id);

create trigger clinic_slot_procedures_set_updated_at
  before update on clinic_slot_procedures
  for each row execute function public.set_updated_at();

alter table clinic_slot_procedures enable row level security;
create policy "org members manage clinic slot procedures"
  on clinic_slot_procedures for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- Retire the single procedure_type on slots. Made nullable now so the app can
-- stop writing it immediately; drop the column once the new flow is verified:
--   alter table clinic_slots drop column procedure_type;
alter table clinic_slots alter column procedure_type drop not null;
