-- 0056_organization_adoption_templates.sql
--
-- Per-org adoption-profile templates. An adoption posting is assembled from a
-- template the org controls: fixed text (intro, fees, disclaimers, closing) plus
-- placeholders that Whiskerville fills in:
--   * AI placeholders   {{ai_intro}} {{ai_body}} {{ai_home_requirements}}
--     replaced with grounded, animal-specific copy from the
--     `generate-adoption-profile` Edge Function.
--   * Variable placeholders  {{animal.name}} {{animal.age}} {{animal.species}}
--     {{animal.gender}} {{animal.breed}} — filled from the animal record.
-- Everything else in the body is reproduced verbatim, so legally-required
-- language (fees, disclaimers) is never AI-generated. The assembled posting is
-- stored per animal in `animal_ai_content` (content_type = 'adoption_profile').
--
-- `tone` and `length` are org-level generation controls (the AI honors them);
-- `style_notes` is optional free-text org writing guidance. Per-generation
-- guidance (e.g. "keep it short for Petfinder") is passed at call time, not
-- stored here.
--
-- MVP: one default template per org (partial unique index on is_default). The
-- table already allows multiple rows for the planned "multiple templates per
-- org" enhancement.

-- 1. Table -----------------------------------------------------------------
create table if not exists public.organization_adoption_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'Default',
  template_body text not null,
  tone text not null default 'warm_conversational',
  length text not null default 'standard',
  style_notes text,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_adoption_templates_org_idx
  on public.organization_adoption_templates (organization_id);

-- At most one default template per org.
create unique index if not exists organization_adoption_templates_one_default
  on public.organization_adoption_templates (organization_id)
  where is_default;

-- 2. RLS -------------------------------------------------------------------
alter table public.organization_adoption_templates enable row level security;
drop policy if exists "org members manage adoption templates"
  on public.organization_adoption_templates;
create policy "org members manage adoption templates"
  on public.organization_adoption_templates
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 3. updated_at trigger ----------------------------------------------------
drop trigger if exists organization_adoption_templates_set_updated_at
  on public.organization_adoption_templates;
create trigger organization_adoption_templates_set_updated_at
  before update on public.organization_adoption_templates
  for each row execute function public.set_updated_at();

-- 4. Default template body --------------------------------------------------
-- A generic, ready-to-use starting point. Orgs edit this in Settings to add
-- their own intro/fees/disclaimers (e.g. the Alley Cat Project format). The
-- bracketed lines are placeholder prompts for the org to replace.
create or replace function public.default_adoption_template_body()
returns text
language sql
immutable
as $$
  select
'[Add a short fixed intro for your organization here — e.g. how to apply, where, and any "please read before applying" note.]

{{ai_intro}}

{{ai_body}}

What {{animal.name}} is looking for in a home:

{{ai_home_requirements}}

[Add your fixed adoption / medical statement here — e.g. "All of our animals are spayed/neutered, microchipped, and vaccinated prior to adoption."]

[Add your fixed fee information here.]

[Add your fixed closing instructions here — e.g. how to apply and what to expect.]'
$$;

-- 5. Backfill a default template for existing orgs --------------------------
insert into public.organization_adoption_templates (organization_id, template_body)
select o.id, public.default_adoption_template_body()
from public.organizations o
on conflict do nothing;

-- 6. Seed a default template for newly-created orgs -------------------------
-- SECURITY DEFINER so it can insert during org creation, before/independent of
-- the creator's membership row (mirrors seed_org_species).
create or replace function public.seed_org_adoption_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_adoption_templates (organization_id, template_body)
  values (new.id, public.default_adoption_template_body())
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_org_adoption_template on public.organizations;
create trigger trg_seed_org_adoption_template
  after insert on public.organizations
  for each row execute function public.seed_org_adoption_template();
