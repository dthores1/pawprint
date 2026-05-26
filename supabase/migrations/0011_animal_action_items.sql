create table animal_action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,

  description text not null,
  priority text not null default 'needs_attention'
    check (priority in ('needs_attention', 'urgent', 'critical')),

  status text not null default 'open'
    check (status in ('open', 'completed', 'cancelled')),

  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  completed_by uuid null,
  completion_note text null
);

create index if not exists animal_action_items_organization_id_idx
  on animal_action_items (organization_id);
create index if not exists animal_action_items_animal_id_idx
  on animal_action_items (animal_id);
-- At most one open action item per animal.
create unique index if not exists animal_action_items_one_open_per_animal
  on animal_action_items (animal_id) where (status = 'open');

alter table animal_action_items enable row level security;
drop policy if exists "org members manage animal_action_items" on animal_action_items;
create policy "org members manage animal_action_items"
  on animal_action_items for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));