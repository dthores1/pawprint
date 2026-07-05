-- 0090_platform_admins.sql
-- ============================================================
-- Whiskerville Owner Console (admin.whiskerville.app): a READ-ONLY,
-- platform-wide view for the people who run Whiskerville itself.
--
-- Model mirrors support_agents (0087):
--   * `platform_admins` is GLOBAL (not org-scoped). RLS is enabled with no
--     policies, so only service_role / SECURITY DEFINER functions touch it.
--   * Seeding happens once, by us, via `register_platform_admin(email)` in the
--     SQL editor (service_role) — it is NOT callable from the app.
--   * The console never uses direct table reads: every query it needs is a
--     SECURITY DEFINER RPC below that first asserts `is_platform_admin()`.
--     That keeps all cross-org aggregation server-side; the anon-key client
--     only ever calls `rpc(...)` and RLS on the underlying tables is never
--     widened.
--
-- Deliberately absent: any write/RPC that mutates customer data. The console
-- is observational only — no impersonation, no editing, no destructive ops.
--
-- Idempotent DDL (the live DB is not a clean replay).
-- ============================================================

-- ── 1. Who is a platform admin ───────────────────────────────────────────────
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- (no policies → only service_role / SECURITY DEFINER functions can read/write)

create or replace function public.is_platform_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from platform_admins where user_id = auth.uid() and is_active
  );
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- Seed helper: run `select public.register_platform_admin('you@whiskerville.app')`
-- in the SQL editor AFTER that auth user exists. Locked away from the app —
-- default PUBLIC execute is revoked so only service_role can call it.
create or replace function public.register_platform_admin(p_email text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email = p_email;
  if v_uid is null then raise exception 'No auth user with email %', p_email; end if;
  insert into platform_admins (user_id, email, is_active)
  values (v_uid, p_email, true)
  on conflict (user_id) do update set is_active = true, email = excluded.email;
  return v_uid;
end;
$$;
revoke execute on function public.register_platform_admin(text) from public, anon, authenticated;
grant execute on function public.register_platform_admin(text) to service_role;

-- ── 2. Platform-wide stats ───────────────────────────────────────────────────
-- One row of headline numbers for the console dashboard.
--   active_users_30d: auth.users signed in within the last 30 days.
--   pending_invitations: sent, not accepted/revoked, not yet expired.
--   pending_signup_requests: beta requests still awaiting an outcome
--     ('New' or 'Contacted'; Approved/Rejected/Converted are settled).
--   open_support_tickets: anything not resolved/closed.
create or replace function public.admin_platform_stats()
returns jsonb language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'organization_count', (select count(*) from organizations),
    'total_users', (select count(*) from auth.users),
    'active_users_30d', (
      select count(*) from auth.users
      where last_sign_in_at > now() - interval '30 days'
    ),
    'total_animals', (select count(*) from animals where not is_deleted),
    'pending_invitations', (
      select count(*) from organization_invitations
      where accepted_at is null and revoked_at is null and expires_at > now()
    ),
    'pending_signup_requests', (
      select count(*) from organization_signup_requests
      where status in ('New', 'Contacted')
    ),
    'open_support_tickets', (
      select count(*) from support_tickets
      where status in ('open', 'in_progress', 'waiting')
    )
  );
end;
$$;
grant execute on function public.admin_platform_stats() to authenticated;

-- ── 3. Organizations overview ────────────────────────────────────────────────
-- One row per org for the console table.
--   member_count: real members only (support-access rows and expired
--     memberships excluded, matching is_org_member semantics).
--   last_activity: best derivable signal — the freshest of animal edits,
--     support-ticket updates, and audit events. Null for a truly idle org.
create or replace function public.admin_list_organizations()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  member_count bigint,
  animal_count bigint,
  open_support_count bigint,
  last_activity timestamptz
) language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin access required' using errcode = '42501';
  end if;
  return query
  select
    o.id,
    o.name,
    o.created_at,
    (select count(*) from organization_members m
      where m.organization_id = o.id
        and not m.is_support
        and (m.expires_at is null or m.expires_at > now())),
    (select count(*) from animals a
      where a.organization_id = o.id and not a.is_deleted),
    (select count(*) from support_tickets t
      where t.organization_id = o.id
        and t.status in ('open', 'in_progress', 'waiting')),
    greatest(
      (select max(a.updated_at) from animals a where a.organization_id = o.id),
      (select max(t.updated_at) from support_tickets t where t.organization_id = o.id),
      (select max(e.created_at) from audit_events e where e.organization_id = o.id)
    )
  from organizations o
  order by o.created_at desc;
end;
$$;
grant execute on function public.admin_list_organizations() to authenticated;

-- ── 4. Single-org detail ─────────────────────────────────────────────────────
-- Everything the org detail page shows, in one round trip. All lists are
-- recent-first and capped; the console is a health view, not a browser.
create or replace function public.admin_org_detail(p_org_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'organization', (
      select jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'created_at', o.created_at
      )
      from organizations o where o.id = p_org_id
    ),
    'members', (
      select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb)
      from (
        select
          om.role,
          om.created_at,
          om.is_support,
          om.expires_at,
          u.email,
          coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), u.email) as name
        from organization_members om
        join auth.users u on u.id = om.user_id
        left join lateral (
          select pp.first_name, pp.last_name from people pp
          where pp.user_id = om.user_id and pp.organization_id = om.organization_id
          limit 1
        ) p on true
        where om.organization_id = p_org_id
      ) m
    ),
    'recent_animals', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
      from (
        select an.id, an.name, an.rescue_id, an.status, s.name as species, an.created_at
        from animals an
        left join species s on s.id = an.species_id
        where an.organization_id = p_org_id and not an.is_deleted
        order by an.created_at desc
        limit 10
      ) a
    ),
    'recent_support_tickets', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
      from (
        select st.ticket_number, st.subject, st.category, st.status, st.created_at
        from support_tickets st
        where st.organization_id = p_org_id
        order by st.created_at desc
        limit 10
      ) t
    ),
    'recent_invitations', (
      select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc), '[]'::jsonb)
      from (
        select oi.email, oi.role, oi.created_at, oi.accepted_at, oi.revoked_at, oi.expires_at
        from organization_invitations oi
        where oi.organization_id = p_org_id
        order by oi.created_at desc
        limit 10
      ) i
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
      from (
        select ae.action, ae.actor_label, ae.created_at
        from audit_events ae
        where ae.organization_id = p_org_id
        order by ae.created_at desc
        limit 15
      ) e
    )
  );
end;
$$;
grant execute on function public.admin_org_detail(uuid) to authenticated;
