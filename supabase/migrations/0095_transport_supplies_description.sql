-- 0095_transport_supplies_description.sql
-- Supplies transport requests never said WHAT was being moved — animal
-- requests require the animals, but picking "Supplies" required nothing.
-- Adds a free-text description ("What needs to be transported?"), required
-- by the form for type='supplies' (not constrained here: legacy rows are
-- null, and the type can change). Shown as the card title the way animal
-- names are. Idempotent.

alter table public.transport_requests
  add column if not exists supplies_description text;
