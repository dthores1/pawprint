-- 0031_medical_microchip_number.sql
-- Adds an optional `microchip_number` text column to medical_records, so a
-- Microchip-type record can capture the chip number alongside it. The app
-- syncs the value onto animals.microchip_number when present, but the chip
-- is sometimes implanted before the number is on hand — so this column is
-- nullable and unconstrained. Idempotent.
alter table medical_records
  add column if not exists microchip_number text;
