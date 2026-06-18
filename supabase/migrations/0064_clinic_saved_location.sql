-- 0064_clinic_saved_location.sql
-- Let a clinic's Location be a reusable Saved Location ("ABC Clinic") instead of
-- re-typing the address each time — mirroring transport_requests. The existing
-- location_* columns still hold the copied address (for maps); this FK links the
-- saved location so the friendly name can be shown. SET NULL on delete so the
-- clinic keeps its copied address if the saved location is later removed.
alter table public.clinic_events
  add column if not exists location_saved_location_id uuid
    references public.saved_locations(id) on delete set null;
