-- Duplicate self-records, round two (supersedes re-running 0032).
--
-- Duplicate (organization_id, user_id) people rows resurfaced (e.g. Roman
-- Reigns in Pennsylvania Pug Rescue appears twice in pickers) — which means
-- 0032's guard index `people_one_self_per_org_user` is NOT present in the
-- live DB (schema drift), because with it a second self-row is impossible.
-- Without the index, AuthContext's find-or-create can double-insert (two
-- tabs, double-fired effect); its 23505 race handler only works when the
-- index exists to raise the conflict.
--
-- 0032 can no longer be re-run as-is: it updates
-- clinic_events.intake_coordinator_person_id (renamed by 0096 to
-- coordinator_person_id) and predates several newer people FKs. This is the
-- same dedupe with the FK list brought current:
--   + animals.current_foster_id        (people FK since 0014; missed by 0032)
--   + sites.contact_id                 (0051)
--   + sites.site_lead                  (0052)
--   + site_volunteers.contact_id       (0052; collision-safe — unique(site_id, contact_id))
--   + support_tickets.created_by_person_id (0086)
--   ~ clinic_events coordinator column handled under either pre/post-0096 name
--
-- Keeper choice prefers live rows over soft-deleted ones, then oldest.
--
-- Everything runs inside ONE DO block (a single statement, so a single
-- backend + transaction): the SQL editor executes through the connection
-- pooler in transaction mode, where temp tables and explicit BEGIN/COMMIT
-- don't survive across statements. Safe to re-run — every step is a no-op
-- when there are no dupes, and the index is `if not exists`.

do $$
begin
  create temp table _people_dupe_pairs on commit drop as
  with keepers as (
    select
      organization_id,
      user_id,
      (array_agg(id order by is_deleted, created_at))[1] as keep_id
    from people
    where user_id is not null
    group by organization_id, user_id
    having count(*) > 1
  )
  select p.id as dupe_id, k.keep_id
  from people p
  join keepers k
    on p.organization_id = k.organization_id
   and p.user_id = k.user_id
  where p.id <> k.keep_id;

  -- ---------- Reassign every people-id FK from dupe → keeper ----------

  update foster_placements set person_id = d.keep_id
    from _people_dupe_pairs d
    where foster_placements.person_id = d.dupe_id;

  update supply_requests set requester_person_id = d.keep_id
    from _people_dupe_pairs d
    where supply_requests.requester_person_id = d.dupe_id;
  update supply_requests set approved_by_person_id = d.keep_id
    from _people_dupe_pairs d
    where supply_requests.approved_by_person_id = d.dupe_id;
  update supply_requests set fulfilled_by_person_id = d.keep_id
    from _people_dupe_pairs d
    where supply_requests.fulfilled_by_person_id = d.dupe_id;

  update transport_requests set requested_by_person_id = d.keep_id
    from _people_dupe_pairs d
    where transport_requests.requested_by_person_id = d.dupe_id;
  update transport_requests set assigned_volunteer_person_id = d.keep_id
    from _people_dupe_pairs d
    where transport_requests.assigned_volunteer_person_id = d.dupe_id;

  update sitting_requests set requested_by_person_id = d.keep_id
    from _people_dupe_pairs d
    where sitting_requests.requested_by_person_id = d.dupe_id;
  update sitting_requests set sitter_person_id = d.keep_id
    from _people_dupe_pairs d
    where sitting_requests.sitter_person_id = d.dupe_id;

  update clinic_events set veterinarian_person_id = d.keep_id
    from _people_dupe_pairs d
    where clinic_events.veterinarian_person_id = d.dupe_id;
  update clinic_events set contact_person_id = d.keep_id
    from _people_dupe_pairs d
    where clinic_events.contact_person_id = d.dupe_id;
  update clinic_events set transport_coordinator_person_id = d.keep_id
    from _people_dupe_pairs d
    where clinic_events.transport_coordinator_person_id = d.dupe_id;

  -- Clinic coordinator — column name depends on whether 0096 has run.
  -- (plpgsql compiles statements lazily, so the branch that references a
  -- missing column is never compiled when the guard keeps it unexecuted.)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clinic_events'
      and column_name = 'coordinator_person_id'
  ) then
    update clinic_events set coordinator_person_id = d.keep_id
      from _people_dupe_pairs d
      where clinic_events.coordinator_person_id = d.dupe_id;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clinic_events'
      and column_name = 'intake_coordinator_person_id'
  ) then
    update clinic_events set intake_coordinator_person_id = d.keep_id
      from _people_dupe_pairs d
      where clinic_events.intake_coordinator_person_id = d.dupe_id;
  end if;

  update clinic_slots set reserved_by_person_id = d.keep_id
    from _people_dupe_pairs d
    where clinic_slots.reserved_by_person_id = d.dupe_id;

  update medical_records set provider_contact_id = d.keep_id
    from _people_dupe_pairs d
    where medical_records.provider_contact_id = d.dupe_id;

  update adoptions set adopter_id = d.keep_id
    from _people_dupe_pairs d
    where adoptions.adopter_id = d.dupe_id;

  update animals set adopted_by_id = d.keep_id
    from _people_dupe_pairs d
    where animals.adopted_by_id = d.dupe_id;
  update animals set current_foster_id = d.keep_id
    from _people_dupe_pairs d
    where animals.current_foster_id = d.dupe_id;

  update sites set contact_id = d.keep_id
    from _people_dupe_pairs d
    where sites.contact_id = d.dupe_id;
  update sites set site_lead = d.keep_id
    from _people_dupe_pairs d
    where sites.site_lead = d.dupe_id;

  -- site_volunteers has unique(site_id, contact_id): drop the dupe's row when
  -- the keeper already volunteers at that site, then repoint the rest.
  delete from site_volunteers sv
    using _people_dupe_pairs d
    where sv.contact_id = d.dupe_id
      and exists (
        select 1 from site_volunteers k
        where k.site_id = sv.site_id and k.contact_id = d.keep_id
      );
  update site_volunteers set contact_id = d.keep_id
    from _people_dupe_pairs d
    where site_volunteers.contact_id = d.dupe_id;

  update support_tickets set created_by_person_id = d.keep_id
    from _people_dupe_pairs d
    where support_tickets.created_by_person_id = d.dupe_id;

  -- ---------- Delete the dupes ----------
  delete from people
    where id in (select dupe_id from _people_dupe_pairs);
end $$;

-- ---------- Guard against recurrence (0032's index, evidently missing) ----------
create unique index if not exists people_one_self_per_org_user
  on people (organization_id, user_id)
  where user_id is not null;
