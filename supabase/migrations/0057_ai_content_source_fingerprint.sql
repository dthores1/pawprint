-- 0057_ai_content_source_fingerprint.sql
--
-- Staleness detection for AI content. When the data an animal's summary /
-- adoption profile was generated from later changes (a new trait, note, or
-- medical record; an edited name/breed/description; a medical marked complete),
-- the stored content is out of date. We capture a fingerprint of those inputs
-- at generation time and compare it to the current inputs at render time to
-- show a "May be outdated" hint.
--
-- The fingerprint is computed client-side (see src/lib/aiContentFingerprint.ts)
-- and stored opaquely here. Nullable so rows generated before this migration
-- simply don't flag staleness (treated as "unknown", never falsely stale).

alter table public.animal_ai_content
  add column if not exists source_fingerprint text;
