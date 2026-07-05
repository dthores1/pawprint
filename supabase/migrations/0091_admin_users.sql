-- 0091_admin_users.sql
-- ============================================================
-- Owner Console "Users" view: one row per auth user across the whole
-- platform, with their org memberships, sign-in providers, and account
-- health flags. Read-only, platform-admin-gated, same pattern as 0090.
--
-- Column notes (all sourced from auth.users, which only SECURITY DEFINER
-- code can read):
--   * name: Google/OAuth metadata first (full_name/name), else the user's
--     `people` self-record, else null (the UI falls back to the email).
--   * providers: raw_app_meta_data->'providers' (e.g. {google,email}); older
--     accounts may only have the singular ->>'provider'.
--   * email_confirmed_at: null = unverified.
--   * banned_until: in the future = the account is currently banned.
--   * memberships: every org the user belongs to, with role + support flag,
--     so the console can render "Org · Owner" chips per user.
--
-- Soft-deleted and anonymous auth users are excluded — they're not people
-- anyone needs to contact or audit in this view.
--
-- Idempotent DDL.
-- ============================================================

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  providers text[],
  banned_until timestamptz,
  memberships jsonb
) language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin access required' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    u.email::text,
    coalesce(
      nullif(trim(coalesce(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        ''
      )), ''),
      (select nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
       from people p
       where p.user_id = u.id
       order by p.created_at
       limit 1)
    ),
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    case
      when jsonb_typeof(u.raw_app_meta_data->'providers') = 'array'
        and jsonb_array_length(u.raw_app_meta_data->'providers') > 0
      then (select array_agg(t.v)
            from jsonb_array_elements_text(u.raw_app_meta_data->'providers') as t(v))
      when u.raw_app_meta_data->>'provider' is not null
      then array[u.raw_app_meta_data->>'provider']
      else '{}'::text[]
    end,
    u.banned_until,
    (select coalesce(jsonb_agg(jsonb_build_object(
        'org_id', o.id,
        'org_name', o.name,
        'role', m.role,
        'is_support', m.is_support,
        'expires_at', m.expires_at
      ) order by o.name), '[]'::jsonb)
     from organization_members m
     join organizations o on o.id = m.organization_id
     where m.user_id = u.id)
  from auth.users u
  where u.deleted_at is null
    and coalesce(u.is_anonymous, false) = false
  order by u.created_at desc;
end;
$$;
grant execute on function public.admin_list_users() to authenticated;
