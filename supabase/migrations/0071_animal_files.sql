-- 0071_animal_files.sql
-- ============================================================
-- Animal Files: document attachments on an animal (spay certs, adoption
-- applications, intake paperwork, legacy exports, etc.). Mirrors animal_photos
-- but the bucket is PRIVATE — files can hold PII, so reads are gated by org
-- membership and the app serves them via short-lived signed URLs.
--
-- Idempotent DDL.
-- ============================================================

create table if not exists animal_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,

  file_name text not null,
  file_type text,            -- MIME type
  file_size bigint,          -- bytes
  storage_path text not null,
  category text not null check (
    category in ('medical_record', 'adoption_application', 'legacy_export', 'intake_document', 'other')
  ),
  notes text,

  created_at timestamptz not null default now()
);

create index if not exists animal_files_organization_id_idx on animal_files (organization_id);
create index if not exists animal_files_animal_id_idx on animal_files (animal_id);

alter table animal_files enable row level security;
drop policy if exists "org members manage animal files" on animal_files;
create policy "org members manage animal files"
  on animal_files for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- ---------- Private storage bucket ----------
-- public=false so objects are NOT readable by URL; reads go through the
-- org-scoped select policy below (the app generates signed URLs). 25 MB cap.
insert into storage.buckets (id, name, public, file_size_limit)
values ('animal-files', 'animal-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- ---------- Storage object policies ----------
-- Path convention: `<organization_id>/<animal_id>/<uuid>.<ext>`. Every op
-- (including SELECT, unlike the public animal-photos bucket) is org-scoped by
-- parsing the first path segment.
drop policy if exists "animal-files read (own org)" on storage.objects;
create policy "animal-files read (own org)"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'animal-files'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );

drop policy if exists "animal-files insert (own org)" on storage.objects;
create policy "animal-files insert (own org)"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'animal-files'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );

drop policy if exists "animal-files update (own org)" on storage.objects;
create policy "animal-files update (own org)"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'animal-files'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );

drop policy if exists "animal-files delete (own org)" on storage.objects;
create policy "animal-files delete (own org)"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'animal-files'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );
