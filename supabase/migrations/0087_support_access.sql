-- 0087_support_access.sql
-- ============================================================
-- Temporary "support access": let the Whiskerville support team into a customer
-- org to investigate a reported issue, the modern-SaaS way — time-boxed, tied to
-- a ticket, audit-logged, and customer-revocable. NOT a permanent invite.
--
-- Model: support access = a normal `organization_members` row for a designated
-- support agent account, flagged `is_support` with an `expires_at`. The RLS
-- helpers `is_org_member` / `is_org_admin` now honor expiry, so access vanishes
-- automatically when the window passes — no cron required (a cleanup job can
-- hard-delete stale rows later, but it isn't load-bearing).
--
-- Safety properties:
--   * Created/extended ONLY via the SECURITY DEFINER RPCs below, and only by a
--     genuine (non-support) customer admin — support can't self-grant/extend.
--   * A guard trigger blocks customer admins from minting/altering is_support
--     rows directly; direct DELETE stays allowed as a customer kill-switch.
--   * Every grant/revoke/expiry writes an immutable audit_events row.
--
-- Idempotent DDL. Prefer idempotency since the live DB wasn't a clean replay.
-- ============================================================

-- ── 1. organization_members: expiry + support flag ──────────────────────────
alter table public.organization_members
  add column if not exists expires_at timestamptz,
  add column if not exists is_support boolean not null default false,
  add column if not exists support_ticket_id uuid
    references public.support_tickets(id) on delete set null;

create index if not exists organization_members_support_idx
  on public.organization_members (organization_id)
  where is_support;

-- ── 2. RLS helpers now honor expiry ─────────────────────────────────────────
-- A row with a past expires_at no longer counts as membership OR admin. Normal
-- rows have expires_at = null and are unaffected.
create or replace function public.is_org_member(org uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = org
      and user_id = auth.uid()
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = org
      and user_id = auth.uid()
      and role in ('owner', 'admin')
      and (expires_at is null or expires_at > now())
  );
$$;

-- ── 3. support_tickets: "support has requested access" flag ─────────────────
-- Set support-side (service_role / dashboard) when the team wants in; the
-- customer's Support page then shows a "Grant access" banner on that ticket.
alter table public.support_tickets
  add column if not exists support_access_requested boolean not null default false;

-- ── 4. Designated support agent accounts ────────────────────────────────────
-- Global (not org-scoped): the Whiskerville support team's auth users. Seeded
-- once by us after creating the support@whiskerville.app auth user (see
-- register_support_agent below). Table reads are locked to service_role; the
-- app asks `is_support_agent()` instead.
create table if not exists public.support_agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.support_agents enable row level security;
-- (no policies → only service_role / SECURITY DEFINER functions can read/write)

create or replace function public.is_support_agent()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from support_agents where user_id = auth.uid() and is_active
  );
$$;
grant execute on function public.is_support_agent() to authenticated;

-- Seed helper: run `select public.register_support_agent('support@whiskerville.app')`
-- in the SQL editor AFTER creating that auth user. Resolves the uuid by email.
create or replace function public.register_support_agent(p_email text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email = p_email;
  if v_uid is null then raise exception 'No auth user with email %', p_email; end if;
  insert into support_agents (user_id, email, is_active)
  values (v_uid, p_email, true)
  on conflict (user_id) do update set is_active = true, email = excluded.email;
  return v_uid;
end;
$$;

-- ── 5. Audit log ────────────────────────────────────────────────────────────
-- Append-only org activity. First use is support-access events; reusable for
-- other sensitive actions later. Admins read; writes only via definer code.
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text,                 -- denormalized name/email at the time
  action text not null,             -- e.g. 'support_access.granted'
  ticket_id uuid references public.support_tickets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_org_idx
  on public.audit_events (organization_id, created_at desc);

alter table public.audit_events enable row level security;
drop policy if exists "admins read audit" on public.audit_events;
create policy "admins read audit"
  on public.audit_events for select
  using (is_org_admin(organization_id));
-- No insert/update/delete policy: immutable, written by definer functions only.

-- ── 6. Guard: is_support rows are managed only by the RPCs ──────────────────
-- The RPCs set `app.support_ctx = 'on'` (txn-local) before writing. Any other
-- INSERT of an is_support row, or UPDATE that touches the support flag / expiry
-- / ticket link, is rejected — so a customer admin can't mint or extend support
-- access by hand. (Plain member writes and DELETE are untouched.)
create or replace function public.guard_support_membership()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.support_ctx', true), '') = 'on' then
    return NEW;
  end if;
  if (TG_OP = 'INSERT' and NEW.is_support)
     or (TG_OP = 'UPDATE'
         and (NEW.is_support or OLD.is_support)
         and (NEW.is_support      is distinct from OLD.is_support
           or NEW.expires_at      is distinct from OLD.expires_at
           or NEW.support_ticket_id is distinct from OLD.support_ticket_id))
  then
    raise exception 'Support memberships are managed via the support-access RPCs'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;
drop trigger if exists organization_members_guard_support on public.organization_members;
create trigger organization_members_guard_support
  before insert or update on public.organization_members
  for each row execute function public.guard_support_membership();

-- ── 7. Grant / revoke RPCs ──────────────────────────────────────────────────
-- Duration → expiry. 'until_resolved' leaves expires_at null and relies on the
-- ticket-resolve trigger (section 8) to end access.
create or replace function public._support_access_expiry(p_duration text)
returns timestamptz language sql immutable as $$
  select case p_duration
    when '24h' then now() + interval '24 hours'
    when '7d'  then now() + interval '7 days'
    when 'until_resolved' then null
    else null
  end;
$$;

create or replace function public.grant_support_access(
  p_org_id uuid,
  p_duration text,
  p_ticket_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor_member uuid;
  v_actor_label text;
  v_expires timestamptz;
  v_agent record;
  v_count int := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_duration not in ('24h','7d','until_resolved') then
    raise exception 'Invalid duration';
  end if;

  -- Authority: a genuine, non-support customer admin must consent.
  select id into v_actor_member
  from organization_members
  where organization_id = p_org_id
    and user_id = auth.uid()
    and role in ('owner','admin')
    and not is_support
    and (expires_at is null or expires_at > now());
  if v_actor_member is null then
    raise exception 'Only an organization admin can grant support access'
      using errcode = '42501';
  end if;

  v_expires := public._support_access_expiry(p_duration);

  -- Actor display label for the audit trail.
  select coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), u.email)
    into v_actor_label
  from auth.users u
  left join people p on p.user_id = u.id and p.organization_id = p_org_id
  where u.id = auth.uid();

  perform set_config('app.support_ctx', 'on', true);

  -- One support membership per active agent (usually exactly one).
  for v_agent in select user_id from support_agents where is_active loop
    insert into organization_members (
      organization_id, user_id, role, is_support, support_ticket_id, expires_at
    )
    values (p_org_id, v_agent.user_id, 'admin', true, p_ticket_id, v_expires)
    on conflict (organization_id, user_id) do update set
      role = 'admin',
      is_support = true,
      support_ticket_id = coalesce(excluded.support_ticket_id, organization_members.support_ticket_id),
      expires_at = excluded.expires_at;
    v_count := v_count + 1;
  end loop;

  -- Clear the request flag now that it's been granted.
  if p_ticket_id is not null then
    update support_tickets set support_access_requested = false where id = p_ticket_id;
  end if;

  insert into audit_events (organization_id, actor_user_id, actor_label, action, ticket_id, metadata)
  values (
    p_org_id, auth.uid(), v_actor_label, 'support_access.granted', p_ticket_id,
    jsonb_build_object('duration', p_duration, 'expires_at', v_expires, 'agents', v_count)
  );
end;
$$;
grant execute on function public.grant_support_access(uuid, text, uuid) to authenticated;

create or replace function public.revoke_support_access(p_org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor_label text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  -- An active admin (the customer; support itself may also end its session).
  if not public.is_org_admin(p_org_id) then
    raise exception 'Only an organization admin can revoke support access'
      using errcode = '42501';
  end if;

  select coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), u.email)
    into v_actor_label
  from auth.users u
  left join people p on p.user_id = u.id and p.organization_id = p_org_id
  where u.id = auth.uid();

  perform set_config('app.support_ctx', 'on', true);
  -- End access immediately; keep the row (expired) for history/visibility.
  update organization_members
    set expires_at = now()
    where organization_id = p_org_id
      and is_support
      and (expires_at is null or expires_at > now());

  insert into audit_events (organization_id, actor_user_id, actor_label, action, metadata)
  values (p_org_id, auth.uid(), v_actor_label, 'support_access.revoked', '{}'::jsonb);
end;
$$;
grant execute on function public.revoke_support_access(uuid) to authenticated;

-- ── 8. Auto-expire support access when its ticket resolves ──────────────────
create or replace function public.expire_support_access_on_resolve()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status in ('resolved','closed') and OLD.status not in ('resolved','closed') then
    perform set_config('app.support_ctx', 'on', true);
    update organization_members
      set expires_at = now()
      where support_ticket_id = NEW.id
        and is_support
        and (expires_at is null or expires_at > now());
    if found then
      insert into audit_events (organization_id, action, ticket_id, metadata)
      values (NEW.organization_id, 'support_access.expired', NEW.id,
              jsonb_build_object('reason', 'ticket_' || NEW.status));
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists support_tickets_expire_access on public.support_tickets;
create trigger support_tickets_expire_access
  after update of status on public.support_tickets
  for each row execute function public.expire_support_access_on_resolve();
