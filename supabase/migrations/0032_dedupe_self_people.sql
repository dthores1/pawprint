-- 0032_dedupe_self_people.sql
-- Fixes the cascading-self-record bug. AuthContext used .maybeSingle()
-- when looking up an org member's self person row by (organization_id,
-- user_id). PostgREST raises an error from that helper when ≥2 rows match,
-- which the caller interpreted as "no existing record" — so it inserted
-- another one. Each page load after that produced another dupe.
--
-- This migration does three things:
--   1. Reassigns every foreign key that points at a dupe self-record onto
--      the oldest row in the (organization_id, user_id) group ("the keeper").
--   2. Deletes the dupe rows.
--   3. Adds a partial UNIQUE index on (organization_id, user_id) where
--      user_id IS NOT NULL, so the race cannot recur regardless of the
--      app-side lookup.
--
-- Steps 1+2 run in a single transaction so the deletion never leaves
-- orphaned FKs. Safe to re-run — step 1 is a no-op when there are no
-- dupes, and the index uses `if not exists`.

begin;

-- Snapshot the dupe → keeper pairs once so every UPDATE/DELETE below
-- works off a consistent set.
create temp table _people_dupe_pairs on commit drop as
with keepers as (
  select
    organization_id,
    user_id,
    (array_agg(id order by created_at))[1] as keep_id
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
-- This list mirrors every ... references people(id) in the schema. If
-- a new table picks up a people FK in the future, add it here.

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
update clinic_events set intake_coordinator_person_id = d.keep_id
  from _people_dupe_pairs d
  where clinic_events.intake_coordinator_person_id = d.dupe_id;

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

-- ---------- Delete the dupes ----------
delete from people
  where id in (select dupe_id from _people_dupe_pairs);

commit;

-- ---------- Guard against recurrence ----------
-- Partial index — only `user_id IS NOT NULL` rows participate, so adding
-- multiple foster parents / contacts with NULL user_id remains fine.
create unique index if not exists people_one_self_per_org_user
  on people (organization_id, user_id)
  where user_id is not null;
