-- 0067_notify_animal_status.sql
-- ============================================================
-- Notify an animal's current active foster when its lifecycle `status` changes
-- (e.g. adoptable -> adopted). This complements the adoption-workflow trigger
-- in 0066 (which keys off the separate `adoptions` table); fosters care about
-- the animal's own status moving too, not just an adoption record.
--
-- Reuses the create_notification() / notif_active_foster_user() helpers and the
-- 'animal' navigation target from 0066. Idempotent.
-- ============================================================

create or replace function public.notify_animal_status_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_foster_user uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_foster_user := public.notif_active_foster_user(new.id);
  if v_foster_user is null then return new; end if;

  perform public.create_notification(
    new.organization_id,
    'foster_animal_status_changed',
    'Animal status updated',
    coalesce(new.name, 'An animal you foster') ||
      '''s status changed to ' || replace(new.status, '_', ' ') || '.',
    'animal', new.id, v_actor,
    jsonb_build_object('animal_name', new.name, 'status', new.status),
    array[v_foster_user]
  );
  return new;
end;
$$;

drop trigger if exists animals_status_notify on animals;
create trigger animals_status_notify
  after update on animals
  for each row execute function public.notify_animal_status_changed();
