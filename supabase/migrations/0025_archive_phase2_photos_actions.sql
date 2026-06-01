-- 0025_archive_phase2_photos_actions.sql
-- Phase 2 of the soft-delete rollout. Promotes animal_photos and
-- animal_action_items to the "low-risk creator-owned" tier alongside
-- animal_notes:
--   * Adds `created_by` (auth.users) to both tables so the archive_record RPC
--     can authorise a non-admin uploader / submitter to archive their own row.
--   * Replaces archive_record to read created_by from any of the three
--     low-risk tables and apply the creator-OR-admin rule across them.
-- Idempotent — re-running is a no-op.

-- ---------- created_by columns ----------
alter table animal_photos
  add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table animal_action_items
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ---------- archive_record: extend low-risk allowlist ----------
create or replace function public.archive_record(
  p_table text,
  p_id    uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_created_by uuid;
  v_admin boolean;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if p_table not in (
    'animals','animal_notes','animal_photos','animal_action_items',
    'animal_relationships','people','medical_records','foster_placements',
    'clinic_events','clinic_slots','clinic_slot_procedures','litters',
    'adoptions','products','supply_requests','supply_request_items',
    'transport_requests','sitting_requests','sitting_request_placements'
  ) then
    raise exception 'table % is not archive-supporting', p_table
      using errcode = '22023';
  end if;

  -- Pull org_id and creator-column where present. The three low-risk tables
  -- all carry `created_by`; everything else returns null::uuid so the var
  -- is unset and the creator-or-admin check below short-circuits to admin.
  execute format($q$
    select organization_id, %s from %I where id = $1 and is_deleted = false
  $q$,
    case p_table
      when 'animal_notes' then 'created_by'
      when 'animal_photos' then 'created_by'
      when 'animal_action_items' then 'created_by'
      else 'null::uuid'
    end,
    p_table
  ) into v_org_id, v_created_by using p_id;

  if v_org_id is null then
    raise exception 'record not found (or already archived)'
      using errcode = 'P0002';
  end if;
  if not is_org_member(v_org_id) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  v_admin := is_org_admin(v_org_id);

  if p_table in ('animal_notes','animal_photos','animal_action_items') then
    if not (v_admin or v_created_by = v_uid) then
      raise exception 'only the creator or an admin can archive this'
        using errcode = '42501';
    end if;
  else
    if not v_admin then
      raise exception 'admin role required to archive %', p_table
        using errcode = '42501';
    end if;
  end if;

  perform public._archive_blockers(p_table, p_id, v_org_id);

  execute format(
    'update %I set is_deleted = true, deleted_at = now(), deleted_by = $1 where id = $2',
    p_table
  ) using v_uid, p_id;
end $$;
