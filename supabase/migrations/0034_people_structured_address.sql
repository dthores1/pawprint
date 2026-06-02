-- 0034_people_structured_address.sql
-- Structured address fields on `people`, populated by the Google Places
-- autocomplete on the Contact / Foster forms. The legacy single-line `address`
-- column is retained and kept in sync with `address_formatted` so existing
-- displays (Contact / Foster profiles) keep working. `address_google_place_id`
-- is the durable key (safe to store long-term per Google's terms); the rest are
-- the resolved components for display/search and lat/lng for future proximity.

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS address_google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS address_formatted TEXT,
  ADD COLUMN IF NOT EXISTS address_street_1 TEXT,
  ADD COLUMN IF NOT EXISTS address_street_2 TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_country TEXT DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS address_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS address_longitude NUMERIC(10, 7);
