-- 0084_supply_product_default_units.sql
--
-- Adjust default units for two seeded starter products: Dewormer and
-- Flea & Tick Treatment now default to 'pack' (were 'dose'). Two parts:
--   1. Redefine seed_org_products() so NEW orgs get the corrected defaults
--      (0065 created the original; create-or-replace updates it in place — the
--      existing trigger keeps calling it by name).
--   2. Update EXISTING orgs' rows, but only where the unit is still the old
--      seeded default ('dose'), so any org that intentionally customized its
--      unit is left untouched.
--
-- Wet Cat Food / Wet Dog Food are intentionally NOT changed — they already
-- default to 'case' (see 0065).
--
-- Idempotent: re-running re-applies the same function body and the UPDATE is a
-- no-op once units are already 'pack'.

-- 1. New orgs ---------------------------------------------------------------
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
    (new.id, 'Dewormer',                'medical',    'pack'),
    (new.id, 'Flea & Tick Treatment',   'medical',    'pack'),
    (new.id, 'Cat Toy Set',             'enrichment', 'set'),
    (new.id, 'Disinfectant Cleaner',    'cleaning',   'bottle'),
    (new.id, 'Pet Carrier',             'other',      'each')
  on conflict (organization_id, lower(name)) do nothing;
  return new;
end;
$$;

-- 2. Existing orgs (only rows still at the old default) ---------------------
-- (products has a set_updated_at trigger, so updated_at refreshes on its own.)
update public.products
set default_unit = 'pack'
where lower(name) in ('dewormer', 'flea & tick treatment')
  and default_unit = 'dose';
