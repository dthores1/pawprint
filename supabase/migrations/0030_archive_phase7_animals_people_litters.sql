-- 0030_archive_phase7_animals_people_litters.sql
-- Phase 7 — the final batch of operational entities. These are the ones
-- with rich cross-table obligations, so the server enforces every blocker
-- explicitly.
--
-- Per the spec:
--   * animals      — block on active foster placement, any non-archived
--                    relationship row (either direction), an in-flight
--                    adoption, status='adopted' (audit history), any
--                    upcoming clinic slot, or an active sitting / transport /
--                    supply request that references this animal.
--                    Relationships are intentionally NOT cascade-archived;
--                    the user has to remove them first.
--   * people       — block on active foster placement (as foster), in-flight
--                    adoption (as adopter), or any active sitting / transport
--                    / supply request where this person is the requester,
--                    sitter, or assigned volunteer.
--   * litters      — block if any non-archived animal still references this
--                    litter (animals.litter_id). Archived animals can stay
--                    linked historically — the check only counts active ones.
--
-- No cascade for animals/people/litters — sub-records remain in place. An
-- archived animal becomes unreachable from list views and its profile route,
-- but its notes / photos / medical / etc. stay in the DB so a restore brings
-- everything back.
--
-- Idempotent. Replaces archive_record defined in 0029.

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

  -- Per-table column fetch. Tables with their own blockers grab the
  -- relevant status column up front; the rest fall through to the generic
  -- branch that just reads org_id (+ created_by for low-risk tables).
  if p_table in ('supply_requests','sitting_requests','transport_requests',
                 'adoptions') then
    execute format($q$
      select organization_id, status::text from %I
      where id = $1 and is_deleted = false
    $q$, p_table) into v_org_id, v_status using p_id;
  elsif p_table = 'foster_placements' then
    select fp.organization_id, fp.placement_status::text
      into v_org_id, v_status
      from foster_placements fp
      where fp.id = p_id and fp.is_deleted = false;
  elsif p_table = 'animals' then
    select a.organization_id, a.status::text
      into v_org_id, v_status
      from animals a where a.id = p_id and a.is_deleted = false;
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

  -- Status / cross-table blockers per table.
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
  elsif p_table = 'adoptions' then
    if v_status <> 'cancelled' then
      raise exception
        'adoption must be cancelled before archiving (currently %)',
        v_status using errcode = '23000';
    end if;
  elsif p_table = 'foster_placements' then
    if v_status = 'active' then
      raise exception
        'cannot archive an active foster placement — close it first (reassign or end the placement)'
        using errcode = '23000';
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

  -- ---------- animals -------------------------------------------------
  elsif p_table = 'animals' then
    if v_status = 'adopted' then
      raise exception
        'cannot archive an adopted animal — this record is tracked history'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from foster_placements fp
      where fp.animal_id = p_id
        and fp.placement_status = 'active'
        and fp.is_deleted = false
    ) then
      raise exception
        'cannot archive: animal has an active foster placement'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from animal_relationships ar
      where (ar.animal_id = p_id or ar.related_animal_id = p_id)
        and ar.is_deleted = false
    ) then
      raise exception
        'cannot archive: animal has active relationships — remove them from the Relationships card first'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from adoptions ad
      where ad.animal_id = p_id
        and ad.status not in ('completed','cancelled','returned')
        and ad.is_deleted = false
    ) then
      raise exception
        'cannot archive: animal has a pending adoption — cancel it first'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from clinic_slots cs
      join clinic_events ce on ce.id = cs.clinic_event_id
      where cs.animal_id = p_id
        and cs.is_deleted = false
        and ce.is_deleted = false
        and cs.status not in ('canceled','no_show')
        and ce.status not in ('completed','canceled')
    ) then
      raise exception
        'cannot archive: animal has an upcoming clinic slot — remove the slot or cancel the clinic first'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from sitting_request_placements srp
      join sitting_requests sit on sit.id = srp.sitting_request_id
      join foster_placements fp on fp.id = srp.foster_placement_id
      where fp.animal_id = p_id
        and srp.is_deleted = false
        and sit.is_deleted = false
        and sit.status not in ('completed','canceled')
    ) then
      raise exception
        'cannot archive: animal is covered by an active sitting request'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from transport_requests tr
      where tr.animal_id = p_id
        and tr.is_deleted = false
        and tr.status not in ('completed','canceled')
    ) then
      raise exception
        'cannot archive: animal has an active transport request'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from supply_requests sr
      where sr.requested_for_animal_id = p_id
        and sr.is_deleted = false
        and sr.status not in ('fulfilled','cancelled','denied')
    ) then
      raise exception
        'cannot archive: animal has an open supply request'
        using errcode = '23000';
    end if;

  -- ---------- people --------------------------------------------------
  elsif p_table = 'people' then
    if exists (
      select 1 from foster_placements fp
      where fp.person_id = p_id
        and fp.placement_status = 'active'
        and fp.is_deleted = false
    ) then
      raise exception
        'cannot archive: person is the foster on an active placement'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from adoptions ad
      where ad.adopter_id = p_id
        and ad.status not in ('completed','cancelled','returned')
        and ad.is_deleted = false
    ) then
      raise exception
        'cannot archive: person is the adopter on a pending adoption'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from sitting_requests sit
      where (sit.requested_by_person_id = p_id or sit.sitter_person_id = p_id)
        and sit.is_deleted = false
        and sit.status not in ('completed','canceled')
    ) then
      raise exception
        'cannot archive: person is on an active sitting request'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from transport_requests tr
      where (tr.requested_by_person_id = p_id
             or tr.assigned_volunteer_person_id = p_id)
        and tr.is_deleted = false
        and tr.status not in ('completed','canceled')
    ) then
      raise exception
        'cannot archive: person is on an active transport request'
        using errcode = '23000';
    end if;
    if exists (
      select 1 from supply_requests sr
      where sr.requester_person_id = p_id
        and sr.is_deleted = false
        and sr.status not in ('fulfilled','cancelled','denied')
    ) then
      raise exception
        'cannot archive: person has an open supply request'
        using errcode = '23000';
    end if;

  -- ---------- litters -------------------------------------------------
  elsif p_table = 'litters' then
    if exists (
      select 1 from animals a
      where a.litter_id = p_id and a.is_deleted = false
    ) then
      raise exception
        'cannot archive: litter still has active animals linked — archive (or unlink) those animals first'
        using errcode = '23000';
    end if;
  end if;

  perform public._archive_blockers(p_table, p_id, v_org_id);

  execute format(
    'update %I set is_deleted = true, deleted_at = $1, deleted_by = $2 where id = $3',
    p_table
  ) using v_now, v_uid, p_id;

  -- Cascade for request/clinic parents (unchanged from previous phases).
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
