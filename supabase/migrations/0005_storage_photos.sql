-- ============================================================
-- Pawprint: photo storage policies for the `animal-photos` bucket.
-- Depends on 0001_init.sql (animal_photos table, is_org_member helper).
-- Prereq: create a PUBLIC bucket named `animal-photos` in the dashboard.
-- ============================================================

-- URL-mode photos (external links) have no storage object, so the path is
-- optional. (0001 created it NOT NULL.)
alter table animal_photos alter column storage_path drop not null;

-- ---------- Storage object policies ----------
-- The bucket being "public" only makes objects readable via their public URL.
-- Writes (and API reads) still go through RLS on storage.objects, which has
-- no policies by default — so uploads would fail without these.
--
-- We scope writes to the uploader's org by parsing the first path segment:
-- the app uploads to `<organization_id>/<animal_id>/<file>`.

create policy "animal-photos read"
  on storage.objects for select to authenticated
  using (bucket_id = 'animal-photos');

create policy "animal-photos insert (own org)"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'animal-photos'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );

create policy "animal-photos update (own org)"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'animal-photos'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );

create policy "animal-photos delete (own org)"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'animal-photos'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );
