-- 0024_archive_support.sql
-- Soft-delete / archive infrastructure. Originally added directly via the
-- Supabase SQL editor; this captures the schema in version control so demo
-- seeds + future deploys stay in sync. All ALTERs are idempotent.
--
-- Pattern: every archive-supporting table gets `is_deleted boolean default
-- false`, `deleted_at timestamptz`, `deleted_by uuid -> auth.users`. List
-- views filter on `is_deleted = false`; the Recycle Bin reads through the
-- list_archived() function. Mutations go through two RPCs:
--   archive_record(table, id)  — enforces permission + active-obligation
--                                blocks in one place
--   restore_record(table, id)  — undoes archive (original archiver or admin)
--
-- foster_parents was retired in 0012 (data lives in `people` now); it is
-- intentionally NOT in the archive list.

-- ---------- Archive columns on every supported table ----------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'animals',
      'animal_notes',
      'animal_photos',
      'animal_action_items',
      'animal_relationships',
      'people',
      'medical_records',
      'foster_placements',
      'clinic_events',
      'clinic_slots',
      'clinic_slot_procedures',
      'litters',
      'adoptions',
      'products',
      'supply_requests',
      'supply_request_items',
      'transport_requests',
      'sitting_requests',
      'sitting_request_placements'
    ])
  loop
    execute format($f$
      alter table %I
        add column if not exists is_deleted boolean not null default false,
        add column if not exists deleted_at timestamptz,
        add column if not exists deleted_by uuid references auth.users(id) on delete set null
    $f$, t);
    -- Partial index on the active subset — keeps the hot-path list queries
    -- (which all filter is_deleted = false) from scanning archived rows.
    execute format(
      'create index if not exists %I on %I (organization_id) where is_deleted = false',
      t || '_active_org_idx', t
    );
  end loop;
end $$;

-- ---------- archive_record(table, id) ----------
-- Single source of truth for who-can-archive-what and the active-obligation
-- guards. Tables not yet wired in the app simply don't get an Archive button;
-- adding a new entity to the flow is a matter of (1) wiring the UI and
-- (2) extending the per-table permission/blocker logic below.

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

  -- Pull org_id (+ creator where the table has one). Dynamic SQL is used
  -- because the table name is variable; p_id is parameter-bound to keep the
  -- statement safe.
  execute format($q$
    select organization_id, %s from %I where id = $1 and is_deleted = false
  $q$,
    case p_table
      when 'animal_notes' then 'created_by'
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

  -- ---- Permission rule per table -------------------------------------
  -- Low-risk creator-owned: creator OR admin.
  -- Everything else: admin-only. (Extend this set as more low-risk
  -- entities pick up a `created_by` column.)
  if p_table in ('animal_notes') then
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

  -- ---- Active-obligation blockers ------------------------------------
  -- Phase 1 wires only animal_notes (no blockers). Other entities will
  -- have their guards added as they pick up Archive UI in later phases;
  -- until then their UI doesn't expose the action.
  perform public._archive_blockers(p_table, p_id, v_org_id);

  execute format(
    'update %I set is_deleted = true, deleted_at = now(), deleted_by = $1 where id = $2',
    p_table
  ) using v_uid, p_id;
end $$;

-- Per-table blocking rules. Returns void; raises on block.
create or replace function public._archive_blockers(
  p_table text,
  p_id    uuid,
  p_org_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- animal_notes: no blockers.
  -- Other entities: add their checks here as they get wired up.
  --
  -- Sketch of the rules from the product spec (left commented; activate
  -- when wiring each entity's UI in later phases):
  --
  -- adoptions: block if status in ('completed').
  -- animals: block if active foster placement / pending adoption /
  --   upcoming clinic slot / open sitting / transport / supply.
  -- clinic_events: if scheduled/in_progress and any active slot remains.
  -- foster_placements: block if placement_status = 'active'.
  -- litters: block if any non-archived animal still linked.
  -- people: block if linked active obligations.
  -- supply_requests / sitting_requests / transport_requests: block if
  --   status in active/in-progress.
  return;
end $$;

-- ---------- restore_record(table, id) ----------
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
    'select organization_id, deleted_by, is_deleted from %I where id = $1',
    p_table
  ) into v_org_id, v_deleted_by, v_is_deleted using p_id;

  if v_org_id is null then
    raise exception 'record not found' using errcode = 'P0002';
  end if;
  if not is_org_member(v_org_id) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if not v_is_deleted then
    -- Idempotent no-op for restore on an active row.
    return;
  end if;

  v_admin := is_org_admin(v_org_id);
  -- Restore policy: original archiver or admin.
  if not (v_admin or v_deleted_by = v_uid) then
    raise exception 'only an admin or the user who archived it can restore'
      using errcode = '42501';
  end if;

  execute format(
    'update %I set is_deleted = false, deleted_at = null, deleted_by = null where id = $1',
    p_table
  ) using p_id;
end $$;

-- ---------- list_archived(org) ----------
-- Unified feed for the Recycle Bin. One row per archived record across all
-- supported tables, ordered newest-first. display_name is best-effort from
-- columns the table already has; the UI can enrich with collections that
-- are already loaded (e.g. resolving the animal name for a note).

create or replace function public.list_archived(p_org_id uuid)
returns table (
  record_type text,
  record_id   uuid,
  parent_id   uuid,    -- e.g. animal_id for notes/photos, null when n/a
  display_name text,
  deleted_at  timestamptz,
  deleted_by  uuid
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_org_member(p_org_id) then
    return;
  end if;

  -- Every reference is table-qualified (a.deleted_at, n.deleted_by, …) so
  -- the inner column references don't collide with the same-named OUT
  -- parameters from RETURNS TABLE — Postgres treats unqualified
  -- `deleted_at`/`deleted_by` as ambiguous in that case.
  return query
  select * from (
    select 'animal'::text, a.id, null::uuid,
           coalesce(a.name, 'Animal'), a.deleted_at, a.deleted_by
      from animals a
      where a.organization_id = p_org_id and a.is_deleted = true
    union all
    select 'animal_note'::text, n.id, n.animal_id,
           coalesce(nullif(left(n.body, 80), ''), 'Note') ||
             case when length(n.body) > 80 then '…' else '' end,
           n.deleted_at, n.deleted_by
      from animal_notes n
      where n.organization_id = p_org_id and n.is_deleted = true
    union all
    select 'animal_photo'::text, ap.id, ap.animal_id,
           coalesce(nullif(ap.caption, ''), 'Photo'),
           ap.deleted_at, ap.deleted_by
      from animal_photos ap
      where ap.organization_id = p_org_id and ap.is_deleted = true
    union all
    select 'animal_action_item'::text, ai.id, ai.animal_id,
           coalesce(nullif(left(ai.description, 80), ''), 'Action item') ||
             case when length(ai.description) > 80 then '…' else '' end,
           ai.deleted_at, ai.deleted_by
      from animal_action_items ai
      where ai.organization_id = p_org_id and ai.is_deleted = true
    union all
    select 'animal_relationship'::text, ar.id, ar.animal_id,
           coalesce(ar.relationship_type, 'Relationship'),
           ar.deleted_at, ar.deleted_by
      from animal_relationships ar
      where ar.organization_id = p_org_id and ar.is_deleted = true
    union all
    select 'person'::text, pe.id, null::uuid,
           trim(coalesce(pe.first_name, '') || ' ' || coalesce(pe.last_name, '')),
           pe.deleted_at, pe.deleted_by
      from people pe
      where pe.organization_id = p_org_id and pe.is_deleted = true
    union all
    select 'medical_record'::text, mr.id, mr.animal_id,
           coalesce(mr.procedure_name, 'Medical record'),
           mr.deleted_at, mr.deleted_by
      from medical_records mr
      where mr.organization_id = p_org_id and mr.is_deleted = true
    union all
    select 'foster_placement'::text, fp.id, fp.animal_id,
           'Placement', fp.deleted_at, fp.deleted_by
      from foster_placements fp
      where fp.organization_id = p_org_id and fp.is_deleted = true
    union all
    select 'clinic_event'::text, ce.id, null::uuid,
           coalesce(ce.location, 'Clinic') || ' — ' ||
             to_char(ce.date_time, 'Mon DD, YYYY'),
           ce.deleted_at, ce.deleted_by
      from clinic_events ce
      where ce.organization_id = p_org_id and ce.is_deleted = true
    union all
    select 'clinic_slot'::text, cs.id, cs.clinic_event_id,
           'Slot', cs.deleted_at, cs.deleted_by
      from clinic_slots cs
      where cs.organization_id = p_org_id and cs.is_deleted = true
    union all
    select 'clinic_slot_procedure'::text, csp.id, csp.clinic_slot_id,
           coalesce(csp.procedure_type, 'Procedure'),
           csp.deleted_at, csp.deleted_by
      from clinic_slot_procedures csp
      where csp.organization_id = p_org_id and csp.is_deleted = true
    union all
    select 'litter'::text, l.id, null::uuid,
           coalesce(nullif(l.name, ''), 'Litter'),
           l.deleted_at, l.deleted_by
      from litters l
      where l.organization_id = p_org_id and l.is_deleted = true
    union all
    select 'adoption'::text, ad.id, ad.animal_id,
           'Adoption', ad.deleted_at, ad.deleted_by
      from adoptions ad
      where ad.organization_id = p_org_id and ad.is_deleted = true
    union all
    select 'product'::text, pr.id, null::uuid,
           coalesce(pr.name, 'Product'), pr.deleted_at, pr.deleted_by
      from products pr
      where pr.organization_id = p_org_id and pr.is_deleted = true
    union all
    select 'supply_request'::text, sr.id, null::uuid,
           'Supply request', sr.deleted_at, sr.deleted_by
      from supply_requests sr
      where sr.organization_id = p_org_id and sr.is_deleted = true
    union all
    select 'supply_request_item'::text, sri.id, sri.supply_request_id,
           coalesce(nullif(sri.custom_item_name, ''), 'Item'),
           sri.deleted_at, sri.deleted_by
      from supply_request_items sri
      where sri.organization_id = p_org_id and sri.is_deleted = true
    union all
    select 'transport_request'::text, tr.id, null::uuid,
           coalesce(tr.pickup_location, 'Transport') || ' → ' ||
             coalesce(tr.dropoff_location, ''),
           tr.deleted_at, tr.deleted_by
      from transport_requests tr
      where tr.organization_id = p_org_id and tr.is_deleted = true
    union all
    select 'sitting_request'::text, sit.id, null::uuid,
           'Sitting request', sit.deleted_at, sit.deleted_by
      from sitting_requests sit
      where sit.organization_id = p_org_id and sit.is_deleted = true
    union all
    select 'sitting_request_placement'::text, srp.id, srp.sitting_request_id,
           'Sitting placement', srp.deleted_at, srp.deleted_by
      from sitting_request_placements srp
      where srp.organization_id = p_org_id and srp.is_deleted = true
  ) rows (record_type, record_id, parent_id, display_name, deleted_at, deleted_by)
  order by rows.deleted_at desc nulls last;
end $$;

grant execute on function public.archive_record(text, uuid) to authenticated;
grant execute on function public.restore_record(text, uuid) to authenticated;
grant execute on function public.list_archived(uuid)         to authenticated;
