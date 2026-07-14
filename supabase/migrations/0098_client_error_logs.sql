-- 0098: Client error logs — silent capture of failed writes from the app.
--
-- The app intercepts failed Supabase mutations (REST + storage, via the shared
-- client's fetch wrapper in src/lib/supabase.ts) and fire-and-forget inserts a
-- row here, so we learn about write failures even when users don't report
-- them. Users see a generic "Something went wrong" toast pointing at the
-- Report a Bug form; this table is the operator-side record.
--
-- Access: authenticated users may only INSERT (their own rows); reads are
-- platform-admin only (owner console / SQL editor via service role). No
-- UPDATE/DELETE policies — rows are immutable from the app. There's no
-- automatic retention/purge yet; prune manually if it grows.

create table if not exists public.client_error_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  method text,
  endpoint text,      -- request path + query (ids/filters only, no bodies)
  status_code int,
  error_code text,    -- PostgREST/Postgres code when parseable (e.g. 23502)
  message text,
  context jsonb,      -- app-side breadcrumbs, e.g. { "route": "/animals/…" }
  user_agent text
);

alter table public.client_error_logs enable row level security;

-- Any signed-in user can log an error attributed to themselves (or anonymous).
drop policy if exists client_error_logs_insert on public.client_error_logs;
create policy client_error_logs_insert on public.client_error_logs
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

-- Reads are for the platform team only (is_platform_admin() from 0090).
drop policy if exists client_error_logs_admin_read on public.client_error_logs;
create policy client_error_logs_admin_read on public.client_error_logs
  for select to authenticated
  using (public.is_platform_admin());

create index if not exists client_error_logs_occurred_at_idx
  on public.client_error_logs (occurred_at desc);
create index if not exists client_error_logs_org_idx
  on public.client_error_logs (organization_id, occurred_at desc);
