-- 0081_guidance.sql
--
-- In-app guidance system. Designed to stay OUT of the way on screens users hit
-- thousands of times: instead of a large banner card, each page shows a tiny
-- inline "Learn how it works" link that opens a right-side help drawer. The
-- Dashboard gets a dismissible "Getting Started" checklist, and empty screens
-- get contextual copy.
--
--   * guidance_messages   — GLOBAL, org-agnostic content catalog. Authenticated-
--                           read; curated by us via the SQL editor.
--                             placement 'page'  → inline link (`link_label`) +
--                                                 drawer (`title` + `body`).
--                             placement 'empty' → empty-state copy.
--                           `enabled` is the per-message kill switch; `version`
--                           drives the "New" affordance on the inline link
--                           (bump it and the link re-flags as new for everyone).
--   * user_guidance_state — per-user "seen" markers, one row per (user, key,
--                           version). A row exists once the user has opened the
--                           drawer / clicked "Got It" at that version.
--   * user_guidance_prefs — per-user switches: `banners_hidden` is the global
--                           "Hide Tips" toggle (reset from the user menu via
--                           "Show Tips"); `checklist_dismissed` hides the
--                           onboarding checklist.
--   * organizations.show_guidance — org-wide kill switch (admin-gated by the
--                           existing organizations RLS), default ON.
--
-- Idempotent: safe to run on a fresh DB OR to re-run after an earlier version of
-- this migration (the alters/seed upsert reconcile the older shape).

-- ── Content catalog (global) ────────────────────────────────────────────────
create table if not exists public.guidance_messages (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  placement text not null default 'page',
  -- Informational route/page grouping (for a future Help Center); the inline
  -- link itself is wired per-page in code by `key`.
  page text,
  -- For 'page': drawer heading. For 'empty': empty-state heading.
  title text not null,
  -- Drawer / empty-state body. Plain text; line breaks render as written.
  body text not null,
  -- Inline link text for 'page' rows (e.g. "Learn how it works"); null → default.
  link_label text,
  -- Icon-registry name; null → default glyph.
  icon text,
  variant text not null default 'info' check (variant in ('info', 'success', 'warning')),
  enabled boolean not null default true,
  version integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reconcile an older shape (earlier 0081 had no link_label and a placement
-- check that allowed 'banner' but not 'page').
alter table public.guidance_messages
  add column if not exists link_label text;
alter table public.guidance_messages
  drop constraint if exists guidance_messages_placement_check;
update public.guidance_messages set placement = 'page' where placement = 'banner';
alter table public.guidance_messages
  add constraint guidance_messages_placement_check
  check (placement in ('page', 'empty'));

alter table public.guidance_messages enable row level security;
drop policy if exists "authenticated read guidance_messages" on public.guidance_messages;
create policy "authenticated read guidance_messages"
  on public.guidance_messages for select
  to authenticated
  using (true);

-- ── Per-user "seen" markers ─────────────────────────────────────────────────
create table if not exists public.user_guidance_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  guidance_key text not null,
  version integer not null default 1,
  dismissed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, guidance_key, version)
);

alter table public.user_guidance_state enable row level security;
drop policy if exists "users read own guidance state" on public.user_guidance_state;
create policy "users read own guidance state"
  on public.user_guidance_state for select
  using (user_id = auth.uid());
drop policy if exists "users insert own guidance state" on public.user_guidance_state;
create policy "users insert own guidance state"
  on public.user_guidance_state for insert
  with check (user_id = auth.uid());
-- Delete allowed so a future "reset tips" can clear a user's seen markers.
drop policy if exists "users delete own guidance state" on public.user_guidance_state;
create policy "users delete own guidance state"
  on public.user_guidance_state for delete
  using (user_id = auth.uid());

-- ── Per-user switches ───────────────────────────────────────────────────────
create table if not exists public.user_guidance_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banners_hidden boolean not null default false,
  checklist_dismissed boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Reconcile an older shape (earlier 0081 had no checklist_dismissed).
alter table public.user_guidance_prefs
  add column if not exists checklist_dismissed boolean not null default false;

alter table public.user_guidance_prefs enable row level security;
drop policy if exists "users manage own guidance prefs" on public.user_guidance_prefs;
create policy "users manage own guidance prefs"
  on public.user_guidance_prefs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Org-wide kill switch ─────────────────────────────────────────────────────
alter table public.organizations
  add column if not exists show_guidance boolean not null default true;

-- ── Seed guidance ────────────────────────────────────────────────────────────
-- Upsert content so re-running this migration refreshes copy in place, while
-- preserving each row's `enabled` and `version` (so admin toggles and the
-- versioned "New" state survive a re-run). Bump `version` by hand to re-flag a
-- message as new after a redesign.
insert into public.guidance_messages (key, placement, page, title, body, link_label, icon, variant, version, sort_order)
values
  ('animals_intro', 'page', 'animals', 'How Animals work',
   E'Animals are the pets currently in your organization''s care.\n\nTypical lifecycle:\nIntake → Medical care → Foster placement → Adoption\n\nFrom an animal''s profile you can:\n• Track medical records\n• Manage foster placements\n• Record adoptions\n• Upload photos and files',
   'Learn how it works', 'PawPrint', 'info', 1, 0),

  ('fosters_intro', 'page', 'fosters', 'How Fosters work',
   E'Fosters are the volunteers caring for animals in their homes.\n\nOpen a foster to see their:\n• Current placements and capacity\n• Species preferences\n• Contact details\n\nAssign an animal to a foster from the animal''s profile.',
   'Learn how it works', 'Home', 'info', 1, 0),

  ('adoptions_intro', 'page', 'adoptions', 'How Adoptions work',
   E'Adoptions track animals moving toward their forever homes.\n\nTypical flow:\nApplication → Meet & greet → Approval → Finalized\n\nStart an adoption from this page or an animal''s profile.',
   'Learn how it works', 'Heart', 'info', 1, 0),

  ('requests_intro', 'page', 'requests', 'How Requests work',
   E'Requests coordinate the logistics of rescue work, in three types:\n• Supply — food, litter, medication, and other items\n• Transport — getting animals from one place to another\n• Sitting — short-term care when a foster is away\n\nA volunteer creates a request; a teammate claims and fulfills it.',
   'Learn how it works', 'Inbox', 'info', 1, 0),

  ('sites_intro', 'page', 'sites', 'How Rescue Sites work',
   E'Sites are the physical locations your rescue operates — shelters, colonies, and care stations.\n\nFor each site you can:\n• Assign volunteers\n• Track activity and notes\n• Link animals and clinic visits',
   'Learn how it works', 'MapPin', 'info', 1, 0),

  ('medical_intro', 'page', 'medical', 'How Medical works',
   E'Medical helps track animal care from planning through completion.\n\n• Clinics — schedule appointments, reserve slots, and plan procedures\n• Medical Records — track completed care and medical history\n\nCompleting a clinic creates medical records automatically and can update missing animal information.',
   'Learn how it works', 'Stethoscope', 'info', 1, 0),

  ('supply_empty', 'empty', 'requests', 'No supply requests yet',
   E'Supply requests help volunteers ask for food, litter, medication, and other items needed for animals in care. Create one to get started.',
   null, 'Package', 'info', 1, 0)
on conflict (key) do update set
  placement = excluded.placement,
  page = excluded.page,
  title = excluded.title,
  body = excluded.body,
  link_label = excluded.link_label,
  icon = excluded.icon,
  variant = excluded.variant,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Remove the old dashboard banner row (the Dashboard now uses the checklist).
delete from public.guidance_messages where key = 'dashboard_intro';
