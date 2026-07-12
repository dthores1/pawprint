-- 0097_sites_closed_at.sql
-- When a site's status changes to 'closed', record WHEN — the UI shows
-- "Closed Jan 2026" on cards/profiles instead of a bare "Closed" pill.
-- Maintained by trigger so every write path (app, SQL, future imports)
-- stays consistent; reopening a site clears it. Existing closed sites are
-- backfilled from updated_at (best available approximation). Idempotent.

alter table public.sites add column if not exists closed_at timestamptz;

create or replace function public.sites_track_closed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'closed'
     and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists sites_track_closed_at on public.sites;
create trigger sites_track_closed_at
  before insert or update of status on public.sites
  for each row execute function public.sites_track_closed_at();

update public.sites
  set closed_at = updated_at
  where status = 'closed' and closed_at is null;
