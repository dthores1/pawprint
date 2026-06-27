-- 0086_support_tickets.sql
-- ============================================================
-- Support tickets: members report bugs, suggest features, or contact the
-- Whiskerville support team. Each submission becomes a tracked ticket (rather
-- than a fire-and-forget email) so the reporter can see its status under
-- "My Support Requests".
--
-- Triage in v1 is OUT OF BAND: the support team works tickets via the Supabase
-- dashboard / email replies (the service_role bypasses RLS). The customer UI is
-- read-only over its own tickets; status is set support-side. A future phase
-- ties a temporary "support access" grant to a ticket — that's why the FK exists
-- here in skeleton (support_access tables land in a later migration).
--
-- Email-on-submit is best-effort via the `send-support-email` edge function;
-- the row is the source of truth even if the email send fails.
--
-- Idempotent DDL.
-- ============================================================

-- Global, human-friendly ticket number ("Ticket #482") — shared across orgs so
-- support references are unambiguous. A dedicated sequence (not bigserial) so
-- it survives table edits and is easy to reason about.
create sequence if not exists public.support_ticket_number_seq;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint not null default nextval('public.support_ticket_number_seq'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Reporter: both the people-row (for in-app attribution) and the auth user
  -- (for RLS "my tickets" scoping). Either may go null if the record is removed.
  created_by_person_id uuid references public.people(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,

  category text not null check (category in ('bug', 'feature', 'question')),
  subject text not null,
  description text not null,
  steps_to_reproduce text,

  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),

  -- Auto-attached client context (best-effort, supplied by the browser). Helps
  -- support reproduce without a back-and-forth.
  page_path text,
  user_agent text,
  app_version text,

  -- Set support-side when a member's reply is awaited / the ticket resolves.
  -- (Customer UI only reads these.)
  resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists support_tickets_number_idx
  on public.support_tickets (ticket_number);
create index if not exists support_tickets_org_idx
  on public.support_tickets (organization_id);
create index if not exists support_tickets_creator_idx
  on public.support_tickets (created_by_user_id);

-- ---------- Attachments (optional screenshot / file per ticket) ----------
-- Mirrors animal_files: metadata row + bytes in a PRIVATE bucket (screenshots
-- can contain PII). The app serves them via short-lived signed URLs and the
-- support email embeds a longer-lived signed link.
create table if not exists public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,

  file_name text not null,
  file_type text,            -- MIME type
  file_size bigint,          -- bytes
  storage_path text not null,

  created_at timestamptz not null default now()
);

create index if not exists support_ticket_attachments_ticket_idx
  on public.support_ticket_attachments (ticket_id);
create index if not exists support_ticket_attachments_org_idx
  on public.support_ticket_attachments (organization_id);

-- ---------- RLS ----------
-- A member reads the tickets THEY filed; org admins/owners read every ticket in
-- their org (so they can help triage / see what their team reported). Inserts
-- must be self-attributed within an org the caller belongs to. Updates are
-- support-side only (service_role), so no member update/delete policy exists.
alter table public.support_tickets enable row level security;

drop policy if exists "read own or admin tickets" on public.support_tickets;
create policy "read own or admin tickets"
  on public.support_tickets for select
  using (
    is_org_member(organization_id)
    and (is_org_admin(organization_id) or created_by_user_id = auth.uid())
  );

drop policy if exists "members create own tickets" on public.support_tickets;
create policy "members create own tickets"
  on public.support_tickets for insert
  with check (
    is_org_member(organization_id)
    and created_by_user_id = auth.uid()
  );

alter table public.support_ticket_attachments enable row level security;

drop policy if exists "read own or admin ticket attachments" on public.support_ticket_attachments;
create policy "read own or admin ticket attachments"
  on public.support_ticket_attachments for select
  using (
    is_org_member(organization_id)
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (is_org_admin(t.organization_id) or t.created_by_user_id = auth.uid())
    )
  );

drop policy if exists "members create ticket attachments" on public.support_ticket_attachments;
create policy "members create ticket attachments"
  on public.support_ticket_attachments for insert
  with check (
    is_org_member(organization_id)
    and uploaded_by_user_id = auth.uid()
  );

-- ---------- updated_at trigger ----------
drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- ---------- Private storage bucket ----------
-- public=false; path convention `<organization_id>/<ticket_id>/<uuid>.<ext>`.
-- 25 MB cap (screenshots / short clips). Every op is org-scoped by parsing the
-- first path segment, like the animal-files bucket.
insert into storage.buckets (id, name, public, file_size_limit)
values ('support-attachments', 'support-attachments', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "support-attachments read (own org)" on storage.objects;
create policy "support-attachments read (own org)"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );

drop policy if exists "support-attachments insert (own org)" on storage.objects;
create policy "support-attachments insert (own org)"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );

drop policy if exists "support-attachments delete (own org)" on storage.objects;
create policy "support-attachments delete (own org)"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'support-attachments'
    and is_org_member( ((storage.foldername(name))[1])::uuid )
  );
