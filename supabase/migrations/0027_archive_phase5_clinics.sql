-- 0027_archive_phase5_clinics.sql
-- Phase 5 of the archive rollout: clinic events, slots, and procedures.
--
-- Rules:
--   * clinic_events — archivable when status is planning, completed, or
--     canceled. Scheduled / in_progress raises; user must cancel or finish
--     the clinic first.
--   * clinic_slots and clinic_slot_procedures — same rule applied to the
--     parent clinic_event. (You can prune a slot from a clinic in any state
--     except in_progress, but you can't yank rows while the clinic is
--     mid-flight.)
--
-- Cascade: archiving a clinic_event walks down to its slots and procedures,
-- all sharing the parent's deleted_at so restore_record can find them.
-- Archiving a slot walks down to its procedures.
--
-- Idempotent — replaces archive_record / restore_record / list_archived
-- defined in 0026.

-- ---------- archive_record ----------
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

  -- Pull org_id and the columns we need for permission + blocker checks.
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
    -- Slot's own status isn't the gate; the parent clinic's is.
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

  -- ---- Permission --------------------------------------------------------
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

  -- ---- Status blockers --------------------------------------------------
  if p_table = 'supply_requests' then
    if v_status not in ('fulfilled','cancelled','denied') then
      raise exception
        'supply request must be fulfilled, cancelled, or denied before archiving (currently %)',
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

  -- ---- Update the row itself --------------------------------------------
  execute format(
    'update %I set is_deleted = true, deleted_at = $1, deleted_by = $2 where id = $3',
    p_table
  ) using v_now, v_uid, p_id;

  -- ---- Cascade ----------------------------------------------------------
  if p_table = 'supply_requests' then
    update supply_request_items
       set is_deleted = true, deleted_at = v_now, deleted_by = v_uid
     where supply_request_id = p_id and is_deleted = false;
  elsif p_table = 'sitting_requests' then
    update sitting_request_placements
       set is_deleted = true, deleted_at = v_now, deleted_by = v_uid
     where sitting_request_id = p_id and is_deleted = false;
  elsif p_table = 'clinic_events' then
    -- Walk down two levels — slots then their procedures.
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

-- ---------- restore_record ----------
create or replace function public.restore_record(
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
  v_deleted_by uuid;
  v_deleted_at timestamptz;
  v_is_deleted boolean;
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

  execute format(
    'select organization_id, deleted_by, deleted_at, is_deleted from %I where id = $1',
    p_table
  ) into v_org_id, v_deleted_by, v_deleted_at, v_is_deleted using p_id;

  if v_org_id is null then
    raise exception 'record not found' using errcode = 'P0002';
  end if;
  if not is_org_member(v_org_id) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if not v_is_deleted then
    return;
  end if;

  v_admin := is_org_admin(v_org_id);
  if not (v_admin or v_deleted_by = v_uid) then
    raise exception 'only an admin or the user who archived it can restore'
      using errcode = '42501';
  end if;

  execute format(
    'update %I set is_deleted = false, deleted_at = null, deleted_by = null where id = $1',
    p_table
  ) using p_id;

  -- Cascade-restore children that share the parent's deleted_at.
  if p_table = 'supply_requests' then
    update supply_request_items
       set is_deleted = false, deleted_at = null, deleted_by = null
     where supply_request_id = p_id
       and is_deleted = true and deleted_at = v_deleted_at;
  elsif p_table = 'sitting_requests' then
    update sitting_request_placements
       set is_deleted = false, deleted_at = null, deleted_by = null
     where sitting_request_id = p_id
       and is_deleted = true and deleted_at = v_deleted_at;
  elsif p_table = 'clinic_events' then
    update clinic_slots
       set is_deleted = false, deleted_at = null, deleted_by = null
     where clinic_event_id = p_id
       and is_deleted = true and deleted_at = v_deleted_at;
    update clinic_slot_procedures
       set is_deleted = false, deleted_at = null, deleted_by = null
     where is_deleted = true and deleted_at = v_deleted_at
       and clinic_slot_id in (
         select id from clinic_slots where clinic_event_id = p_id
       );
  elsif p_table = 'clinic_slots' then
    update clinic_slot_procedures
       set is_deleted = false, deleted_at = null, deleted_by = null
     where clinic_slot_id = p_id
       and is_deleted = true and deleted_at = v_deleted_at;
  end if;
end $$;

-- ---------- list_archived: also hide clinic slot/procedure children ----------
create or replace function public.list_archived(p_org_id uuid)
returns table (
  record_type text,
  record_id   uuid,
  parent_id   uuid,
  display_name text,
  deleted_at  timestamptz,
  deleted_by  uuid
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_since timestamptz := now() - interval '7 days';
begin
  if not is_org_member(p_org_id) then
    return;
  end if;

  return query
  select * from (
    select 'animal'::text, a.id, null::uuid,
           coalesce(a.name, 'Animal'), a.deleted_at, a.deleted_by
      from animals a
      where a.organization_id = p_org_id
        and a.is_deleted = true and a.deleted_at >= v_since
    union all
    select 'animal_note'::text, n.id, n.animal_id,
           coalesce(nullif(left(n.body, 80), ''), 'Note') ||
             case when length(n.body) > 80 then '…' else '' end,
           n.deleted_at, n.deleted_by
      from animal_notes n
      where n.organization_id = p_org_id
        and n.is_deleted = true and n.deleted_at >= v_since
    union all
    select 'animal_photo'::text, ap.id, ap.animal_id,
           coalesce(nullif(ap.caption, ''), 'Photo'),
           ap.deleted_at, ap.deleted_by
      from animal_photos ap
      where ap.organization_id = p_org_id
        and ap.is_deleted = true and ap.deleted_at >= v_since
    union all
    select 'animal_action_item'::text, ai.id, ai.animal_id,
           coalesce(nullif(left(ai.description, 80), ''), 'Action item') ||
             case when length(ai.description) > 80 then '…' else '' end,
           ai.deleted_at, ai.deleted_by
      from animal_action_items ai
      where ai.organization_id = p_org_id
        and ai.is_deleted = true and ai.deleted_at >= v_since
    union all
    select 'animal_relationship'::text, ar.id, ar.animal_id,
           coalesce(ar.relationship_type, 'Relationship'),
           ar.deleted_at, ar.deleted_by
      from animal_relationships ar
      where ar.organization_id = p_org_id
        and ar.is_deleted = true and ar.deleted_at >= v_since
    union all
    select 'person'::text, pe.id, null::uuid,
           trim(coalesce(pe.first_name, '') || ' ' || coalesce(pe.last_name, '')),
           pe.deleted_at, pe.deleted_by
      from people pe
      where pe.organization_id = p_org_id
        and pe.is_deleted = true and pe.deleted_at >= v_since
    union all
    select 'medical_record'::text, mr.id, mr.animal_id,
           coalesce(mr.procedure_name, 'Medical record'),
           mr.deleted_at, mr.deleted_by
      from medical_records mr
      where mr.organization_id = p_org_id
        and mr.is_deleted = true and mr.deleted_at >= v_since
    union all
    select 'foster_placement'::text, fp.id, fp.animal_id,
           'Placement', fp.deleted_at, fp.deleted_by
      from foster_placements fp
      where fp.organization_id = p_org_id
        and fp.is_deleted = true and fp.deleted_at >= v_since
    union all
    select 'clinic_event'::text, ce.id, null::uuid,
           coalesce(ce.location, 'Clinic') || ' — ' ||
             to_char(ce.date_time, 'Mon DD, YYYY'),
           ce.deleted_at, ce.deleted_by
      from clinic_events ce
      where ce.organization_id = p_org_id
        and ce.is_deleted = true and ce.deleted_at >= v_since
    union all
    -- Slot is hidden when its parent clinic is also archived (cascade group).
    select 'clinic_slot'::text, cs.id, cs.clinic_event_id,
           'Slot', cs.deleted_at, cs.deleted_by
      from clinic_slots cs
      where cs.organization_id = p_org_id
        and cs.is_deleted = true and cs.deleted_at >= v_since
        and not exists (
          select 1 from clinic_events pce
          where pce.id = cs.clinic_event_id and pce.is_deleted = true
        )
    union all
    -- Procedure is hidden when its parent slot OR grandparent clinic is archived.
    select 'clinic_slot_procedure'::text, csp.id, csp.clinic_slot_id,
           coalesce(csp.procedure_type, 'Procedure'),
           csp.deleted_at, csp.deleted_by
      from clinic_slot_procedures csp
      where csp.organization_id = p_org_id
        and csp.is_deleted = true and csp.deleted_at >= v_since
        and not exists (
          select 1 from clinic_slots pcs
          where pcs.id = csp.clinic_slot_id and pcs.is_deleted = true
        )
        and not exists (
          select 1
          from clinic_slots pcs2
          join clinic_events pce2 on pce2.id = pcs2.clinic_event_id
          where pcs2.id = csp.clinic_slot_id and pce2.is_deleted = true
        )
    union all
    select 'litter'::text, l.id, null::uuid,
           coalesce(nullif(l.name, ''), 'Litter'),
           l.deleted_at, l.deleted_by
      from litters l
      where l.organization_id = p_org_id
        and l.is_deleted = true and l.deleted_at >= v_since
    union all
    select 'adoption'::text, ad.id, ad.animal_id,
           'Adoption', ad.deleted_at, ad.deleted_by
      from adoptions ad
      where ad.organization_id = p_org_id
        and ad.is_deleted = true and ad.deleted_at >= v_since
    union all
    select 'product'::text, pr.id, null::uuid,
           coalesce(pr.name, 'Product'), pr.deleted_at, pr.deleted_by
      from products pr
      where pr.organization_id = p_org_id
        and pr.is_deleted = true and pr.deleted_at >= v_since
    union all
    select 'supply_request'::text, sr.id, null::uuid,
           'Supply request', sr.deleted_at, sr.deleted_by
      from supply_requests sr
      where sr.organization_id = p_org_id
        and sr.is_deleted = true and sr.deleted_at >= v_since
    union all
    select 'supply_request_item'::text, sri.id, sri.supply_request_id,
           coalesce(nullif(sri.custom_item_name, ''), 'Item'),
           sri.deleted_at, sri.deleted_by
      from supply_request_items sri
      where sri.organization_id = p_org_id
        and sri.is_deleted = true and sri.deleted_at >= v_since
        and not exists (
          select 1 from supply_requests psr
          where psr.id = sri.supply_request_id and psr.is_deleted = true
        )
    union all
    select 'transport_request'::text, tr.id, null::uuid,
           coalesce(tr.pickup_location, 'Transport') || ' → ' ||
             coalesce(tr.dropoff_location, ''),
           tr.deleted_at, tr.deleted_by
      from transport_requests tr
      where tr.organization_id = p_org_id
        and tr.is_deleted = true and tr.deleted_at >= v_since
    union all
    select 'sitting_request'::text, sit.id, null::uuid,
           'Sitting request', sit.deleted_at, sit.deleted_by
      from sitting_requests sit
      where sit.organization_id = p_org_id
        and sit.is_deleted = true and sit.deleted_at >= v_since
    union all
    select 'sitting_request_placement'::text, srp.id, srp.sitting_request_id,
           'Sitting placement', srp.deleted_at, srp.deleted_by
      from sitting_request_placements srp
      where srp.organization_id = p_org_id
        and srp.is_deleted = true and srp.deleted_at >= v_since
        and not exists (
          select 1 from sitting_requests psit
          where psit.id = srp.sitting_request_id and psit.is_deleted = true
        )
  ) rows (record_type, record_id, parent_id, display_name, deleted_at, deleted_by)
  order by rows.deleted_at desc nulls last;
end $$;
