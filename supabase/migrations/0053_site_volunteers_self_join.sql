-- 0053_site_volunteers_self_join.sql
-- ============================================================
-- Let any org member join/leave a site as a volunteer themselves — not just
-- MANAGE_SITES holders. Self-service: a member may insert/delete a
-- site_volunteers row ONLY for their own person record (the people row whose
-- user_id = auth.uid()). Managing OTHER people's volunteer rows still requires
-- MANAGE_SITES. (Update stays managers-only.)
--
-- Depends on 0052 (site_volunteers).
-- ============================================================

drop policy if exists "site managers insert site volunteers" on public.site_volunteers;
create policy "members join or managers add site volunteers"
  on public.site_volunteers for insert
  with check (
    has_member_permission(organization_id, 'MANAGE_SITES')
    or exists (
      select 1 from public.people p
      where p.id = contact_id
        and p.user_id = auth.uid()
        and p.organization_id = site_volunteers.organization_id
    )
  );

drop policy if exists "site managers delete site volunteers" on public.site_volunteers;
create policy "members leave or managers remove site volunteers"
  on public.site_volunteers for delete
  using (
    has_member_permission(organization_id, 'MANAGE_SITES')
    or exists (
      select 1 from public.people p
      where p.id = contact_id
        and p.user_id = auth.uid()
        and p.organization_id = site_volunteers.organization_id
    )
  );
