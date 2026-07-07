-- 0093_foster_management_toggle.sql
--
-- Org-level "Enable Foster Management" switch. Foster-style rescues (the
-- default) keep everything; brick-and-mortar shelters / humane societies can
-- turn the foster workflows off, which hides the Foster Network tab, foster
-- placement actions, foster stats/filters/exports, and the (placement-based)
-- Sitting workflow.
--
-- UI-LEVEL ONLY, like show_all_reports / show_guidance: no RLS, permission,
-- or data changes. foster_placements rows, the MANAGE_FOSTERS permission
-- implication, and notification triggers are untouched — flipping the toggle
-- back on restores the full workflow over existing data.
--
-- Idempotent DDL.

alter table public.organizations
  add column if not exists foster_management_enabled boolean not null default true;
