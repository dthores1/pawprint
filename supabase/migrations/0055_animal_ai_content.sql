-- 0055_animal_ai_content.sql
--
-- AI-generated written content for an animal (summaries, adoption-profile copy,
-- etc.). Each row is one piece of generated content of a given `content_type`
-- for one animal. The first consumer is the "Summary" tab on the animal page
-- (`content_type = 'summary'`); the same table is intended to back future
-- AI surfaces (adoption_profile, medical_summary, foster_update, …) without a
-- new table per type.
--
-- Two content columns:
--   ai_generated_content  the verbatim model output, never edited by hand.
--   draft_content         what the UI shows/edits. Starts equal to the AI
--                         output; user edits write here only. `user_edited` is
--                         true once draft diverges from the AI version. "Reset"
--                         copies ai_generated_content back into draft_content;
--                         "Regenerate" replaces BOTH with fresh model output.
--
-- Org-scoped with the standard is_org_member RLS policy. At most one row per
-- (animal, content_type) — generation upserts on that pair. Generation itself
-- happens in the `generate-animal-summary` Edge Function (calls OpenAI); this
-- table only stores the result, written through the normal app/RLS path.

-- 1. Table -----------------------------------------------------------------
create table if not exists public.animal_ai_content (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  content_type text not null check (
    content_type in (
      'summary',
      'adoption_profile',
      'internal_summary',
      'medical_summary',
      'foster_update'
    )
  ),
  ai_generated_content text not null,
  draft_content text not null,
  user_edited boolean not null default false,
  -- The model id used for the current ai_generated_content (e.g. 'gpt-4o-mini').
  model text,
  -- When the current ai_generated_content was produced (distinct from row
  -- updated_at, which also bumps on plain draft edits).
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists animal_ai_content_animal_idx
  on public.animal_ai_content (animal_id);

-- One piece of content per (animal, content_type) — generation upserts here.
create unique index if not exists animal_ai_content_animal_type_uniq
  on public.animal_ai_content (animal_id, content_type);

-- 2. RLS -------------------------------------------------------------------
alter table public.animal_ai_content enable row level security;
drop policy if exists "org members manage ai content"
  on public.animal_ai_content;
create policy "org members manage ai content"
  on public.animal_ai_content
  for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- 3. updated_at trigger ----------------------------------------------------
drop trigger if exists animal_ai_content_set_updated_at
  on public.animal_ai_content;
create trigger animal_ai_content_set_updated_at
  before update on public.animal_ai_content
  for each row execute function public.set_updated_at();
