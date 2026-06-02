-- 0035_transport_clinic_structured_address.sql
-- Structured address columns for transport pickup/dropoff and clinic location,
-- populated by the Google Places autocomplete (mirrors the `people.address_*`
-- columns from 0034). The legacy single-line columns (`pickup_location`,
-- `dropoff_location`, `location`) are retained and kept in sync with the
-- matching `*_formatted` column so existing displays keep working.

-- — transport_requests: pickup_* and dropoff_* ————————————————————————
ALTER TABLE transport_requests
  ADD COLUMN IF NOT EXISTS pickup_google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS pickup_formatted TEXT,
  ADD COLUMN IF NOT EXISTS pickup_street_1 TEXT,
  ADD COLUMN IF NOT EXISTS pickup_street_2 TEXT,
  ADD COLUMN IF NOT EXISTS pickup_city TEXT,
  ADD COLUMN IF NOT EXISTS pickup_state TEXT,
  ADD COLUMN IF NOT EXISTS pickup_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS pickup_country TEXT DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS dropoff_google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_formatted TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_street_1 TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_street_2 TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_city TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_state TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_country TEXT DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS dropoff_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS dropoff_longitude NUMERIC(10, 7);

-- — clinic_events: location_* ————————————————————————————————————————
ALTER TABLE clinic_events
  ADD COLUMN IF NOT EXISTS location_google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS location_formatted TEXT,
  ADD COLUMN IF NOT EXISTS location_street_1 TEXT,
  ADD COLUMN IF NOT EXISTS location_street_2 TEXT,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_state TEXT,
  ADD COLUMN IF NOT EXISTS location_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS location_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS location_longitude NUMERIC(10, 7);
