-- 0080_org_show_all_reports.sql
--
-- Org-level "Show All Reports to Everyone" setting. Default OFF: report sections
-- (and supply financial data) follow each member's permissions. ON: full
-- transparency — every member sees all report sections, including Rescue Sites
-- and Supply spend. Edited on Settings → General (admin-gated by the existing
-- organizations RLS, same as timezone). Idempotent; safe to re-run.

alter table public.organizations
  add column if not exists show_all_reports boolean not null default false;
