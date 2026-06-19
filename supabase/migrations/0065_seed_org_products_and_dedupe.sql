-- 0065 — Seed default products for new orgs + dedupe existing products.
--
-- Context: products were never seeded for real orgs (only demo mode had a
-- starter list), and the products table had no uniqueness guard — so a default
-- list inserted by hand more than once left orgs with stacks of identical
-- products (e.g. four "Cat Toy Set" rows). This migration:
--   1. De-duplicates existing products per (org, lower(name)), keeping the
--      oldest row and repointing any supply-request line items to it.
--   2. Adds a unique index on (organization_id, lower(name)) so it can't recur.
--   3. Seeds a curated starter catalog for every new org (trigger), mirroring
--      the seed_org_species() pattern from 0042.
--   4. Backfills that catalog into existing orgs that have NO products yet
--      (orgs with an existing list are left alone — their curation is kept).
--
-- Idempotent: safe to re-run. The only FK into products is
-- supply_request_items.product_id (on delete set null), handled in step 1.

-- ---------- 1. De-duplicate existing products ----------

-- Repoint line items from duplicate products to the keeper (oldest per
-- org + case-insensitive name) so no supply request loses its product link.
with ranked as (
  select
    id,
    first_value(id) over (
      partition by organization_id, lower(name)
      order by created_at asc, id asc
    ) as keeper_id,
    row_number() over (
      partition by organization_id, lower(name)
      order by created_at asc, id asc
    ) as rn
  from public.products
)
update public.supply_request_items sri
set product_id = r.keeper_id
from ranked r
where sri.product_id = r.id
  and r.rn > 1;

-- Delete the duplicates (everything but the keeper for each org + name).
with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id, lower(name)
      order by created_at asc, id asc
    ) as rn
  from public.products
)
delete from public.products p
using ranked r
where p.id = r.id
  and r.rn > 1;

-- ---------- 2. Uniqueness guard ----------

create unique index if not exists products_org_lower_name_key
  on public.products (organization_id, lower(name));

-- ---------- 3. Seed curated starter catalog for new orgs ----------

create or replace function public.seed_org_products()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.products (organization_id, name, category, default_unit)
  values
    (new.id, 'Kitten Formula',          'food',       'can'),
    (new.id, 'Wet Cat Food',            'food',       'case'),
    (new.id, 'Dry Cat Food',            'food',       'lb'),
    (new.id, 'Wet Dog Food',            'food',       'case'),
    (new.id, 'Dry Dog Food',            'food',       'lb'),
    (new.id, 'Clumping Cat Litter',     'litter',     'box'),
    (new.id, 'Pee Pads',                'bedding',    'pack'),
    (new.id, 'Dewormer',                'medical',    'dose'),
    (new.id, 'Flea & Tick Treatment',   'medical',    'dose'),
    (new.id, 'Cat Toy Set',             'enrichment', 'set'),
    (new.id, 'Disinfectant Cleaner',    'cleaning',   'bottle'),
    (new.id, 'Pet Carrier',             'other',      'each')
  on conflict (organization_id, lower(name)) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_org_products on public.organizations;
create trigger trg_seed_org_products
  after insert on public.organizations
  for each row execute function public.seed_org_products();

-- ---------- 4. Backfill orgs that have no products yet ----------

insert into public.products (organization_id, name, category, default_unit)
select o.id, v.name, v.category, v.default_unit
from public.organizations o
cross join (values
  ('Kitten Formula',        'food',       'can'),
  ('Wet Cat Food',          'food',       'case'),
  ('Dry Cat Food',          'food',       'lb'),
  ('Wet Dog Food',          'food',       'case'),
  ('Dry Dog Food',          'food',       'lb'),
  ('Clumping Cat Litter',   'litter',     'box'),
  ('Pee Pads',              'bedding',    'pack'),
  ('Dewormer',              'medical',    'dose'),
  ('Flea & Tick Treatment', 'medical',    'dose'),
  ('Cat Toy Set',           'enrichment', 'set'),
  ('Disinfectant Cleaner',  'cleaning',   'bottle'),
  ('Pet Carrier',           'other',      'each')
) as v(name, category, default_unit)
where not exists (
  select 1 from public.products p where p.organization_id = o.id
)
on conflict (organization_id, lower(name)) do nothing;
