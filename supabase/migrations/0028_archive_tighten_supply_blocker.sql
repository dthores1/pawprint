-- 0028_archive_tighten_supply_blocker.sql
-- Tighten the supply-request archive rule: Fulfilled is now treated as
-- audit history and cannot be archived. Only Cancelled and Denied requests
-- are archivable. Everything else in archive_record (clinic blockers,
-- sitting/transport blockers, low-risk creator-or-admin rules, cascades)
-- is unchanged — this just shifts the supply_requests check.
--
-- Idempotent — replaces archive_record defined in 0027.

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
  v_status text;
  v_parent_status text;
  v_clinic_event_id uuid;
  v_clinic_slot_id uuid;
  v_now timestamptz := now();
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

  if p_table in ('supply_requests','sitting_requests','transport_requests') then
    execute format($q$
      select organization_id, status::text from %I
      where id = $1 and is_deleted = false
    $q$, p_table) into v_org_id, v_status using p_id;
  elsif p_table = 'clinic_events' then
    select ce.organization_id, ce.status
      into v_org_id, v_status
      from clinic_events ce where ce.id = p_id and ce.is_deleted = false;
  elsif p_table = 'clinic_slots' then
    select cs.organization_id, cs.clinic_event_id, ce.status
      into v_org_id, v_clinic_event_id, v_parent_status
      from clinic_slots cs
      join clinic_events ce on ce.id = cs.clinic_event_id
      where cs.id = p_id and cs.is_deleted = false;
  elsif p_table = 'clinic_slot_procedures' then
    select csp.organization_id, csp.clinic_slot_id, cs.clinic_event_id, ce.status
      into v_org_id, v_clinic_slot_id, v_clinic_event_id, v_parent_status
      from clinic_slot_procedures csp
      join clinic_slots cs on cs.id = csp.clinic_slot_id
      join clinic_events ce on ce.id = cs.clinic_event_id
      where csp.id = p_id and csp.is_deleted = false;
  else
    execute format($q$
      select organization_id, %s from %I
      where id = $1 and is_deleted = false
    $q$,
      case p_table
        when 'animal_notes' then 'created_by'
        when 'animal_photos' then 'created_by'
        when 'animal_action_items' then 'created_by'
        else 'null::uuid'
      end,
      p_table
    ) into v_org_id, v_created_by using p_id;
  end if;

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

  -- Status blockers. Fulfilled supply requests are intentionally NOT
  -- archivable — they're audit history once the items have shipped.
  if p_table = 'supply_requests' then
    if v_status not in ('cancelled','denied') then
      raise exception
        'supply request must be cancelled or denied before archiving (currently %)',
        v_status using errcode = '23000';
    end if;
  elsif p_table = 'sitting_requests' then
    if v_status not in ('completed','canceled') then
      raise exception
        'sitting request must be completed or cancelled before archiving (currently %)',
        v_status using errcode = '23000';
    end if;
  elsif p_table = 'transport_requests' then
    if v_status not in ('completed','canceled') then
      raise exception
        'transport request must be completed or cancelled before archiving (currently %)',
        v_status using errcode = '23000';
    end if;
  elsif p_table = 'clinic_events' then
    if v_status in ('scheduled','in_progress') then
      raise exception
        'clinic must be in Planning, Completed, or Cancelled before archiving (currently %)',
        v_status using errcode = '23000';
    end if;
  elsif p_table in ('clinic_slots','clinic_slot_procedures') then
    if v_parent_status = 'in_progress' then
      raise exception
        'cannot archive while the clinic is in progress'
        using errcode = '23000';
    end if;
  end if;

  perform public._archive_blockers(p_table, p_id, v_org_id);

  execute format(
    'update %I set is_deleted = true, deleted_at = $1, deleted_by = $2 where id = $3',
    p_table
  ) using v_now, v_uid, p_id;

  if p_table = 'supply_requests' then
    update supply_request_items
       set is_deleted = true, deleted_at = v_now, deleted_by = v_uid
     where supply_request_id = p_id and is_deleted = false;
  elsif p_table = 'sitting_requests' then
    update sitting_request_placements
       set is_deleted = true, deleted_at = v_now, deleted_by = v_uid
     where sitting_request_id = p_id and is_deleted = false;
  elsif p_table = 'clinic_events' then
    update clinic_slot_procedures
       set is_deleted = true, deleted_at = v_now, deleted_by = v_uid
     where is_deleted = false
       and clinic_slot_id in (
         select id from clinic_slots where clinic_event_id = p_id
       );
    update clinic_slots
       set is_deleted = true, deleted_at = v_now, deleted_by = v_uid
     where clinic_event_id = p_id and is_deleted = false;
  elsif p_table = 'clinic_slots' then
    update clinic_slot_procedures
       set is_deleted = true, deleted_at = v_now, deleted_by = v_uid
     where clinic_slot_id = p_id and is_deleted = false;
  end if;
end $$;
