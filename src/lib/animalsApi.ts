import { Animal } from '../types';

const UUID_RE =
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string =>
typeof v === 'string' && UUID_RE.test(v);

// Columns we allow writing to the `animals` table. They line up 1:1 with the
// TS Animal field names (the schema uses snake_case to match).
const WRITABLE_COLUMNS = [
'name',
'rescue_id',
'species_id',
'sex',
'breed_id',
'breed_text',
'is_mixed_breed',
'litter_id',
'estimated_birth_date',
'birthdate_source',
'estimated_age_value',
'estimated_age_unit',
'estimated_age_as_of',
'intake_date',
'intake_source',
'status',
'priority',
'action_needed',
'description',
'microchip_number',
'primary_photo_url',
'adoption_profile_url',
'internal_notes',
'current_foster_id',
'is_on_hold',
'has_behavior_concern',
'has_medical_concern',
'adopted_by_id',
'adopted_at'] as
const;

// uuid columns referencing people; skip non-uuid values (e.g. seed ids).
const UUID_COLUMNS = new Set(['current_foster_id', 'adopted_by_id']);

// Date columns reject empty strings, so coalesce '' → null.
const DATE_COLUMNS = new Set([
'estimated_birth_date',
'estimated_age_as_of',
'intake_date',
'adopted_at']
);

// Keep the age-estimate columns consistent with birthdate_source: they're only
// meaningful (and only allowed by the DB check) when source is 'estimated_age'.
function clearAgeFieldsIfNeeded(row: Record<string, any>) {
  if (
  'birthdate_source' in row &&
  row.birthdate_source !== 'estimated_age')
  {
    row.estimated_age_value = null;
    row.estimated_age_unit = null;
    row.estimated_age_as_of = null;
  }
}

// Optional text columns where '' from a form input should become NULL in the
// DB. Rescue ID has a partial unique index that treats NULL as "no value", but
// empty strings would all collide as the same value.
const NULLABLE_TEXT_COLUMNS = new Set(['name', 'rescue_id']);

/** Supabase row → app Animal. Coalesces nulls for the TS-required strings. */
export function rowToAnimal(r: any): Animal {
  return {
    id: r.id,
    name: r.name ?? undefined,
    rescue_id: r.rescue_id ?? undefined,
    // Display name is derived from species_id via the catalog in WhiskerContext;
    // the legacy `species` text column is retired (migration 0044), so it may be
    // absent here. '' is a transient placeholder until enrichment fills it.
    species: r.species ?? '',
    species_id: r.species_id ?? undefined,
    sex: r.sex,
    estimated_birth_date: r.estimated_birth_date ?? '',
    intake_date: r.intake_date ?? '',
    intake_source: r.intake_source ?? '',
    status: r.status,
    priority: r.priority,
    action_needed: r.action_needed ?? undefined,
    description: r.description ?? '',
    microchip_number: r.microchip_number ?? undefined,
    primary_photo_url: r.primary_photo_url ?? undefined,
    adoption_profile_url: r.adoption_profile_url ?? undefined,
    current_foster_id: r.current_foster_id ?? undefined,
    is_on_hold: r.is_on_hold ?? false,
    has_behavior_concern: r.has_behavior_concern ?? false,
    has_medical_concern: r.has_medical_concern ?? false,
    adopted_by_id: r.adopted_by_id ?? undefined,
    adopted_at: r.adopted_at ?? undefined,
    internal_notes: r.internal_notes ?? undefined,
    birthdate_source: r.birthdate_source ?? 'estimated_birthdate',
    estimated_age_value: r.estimated_age_value ?? undefined,
    estimated_age_unit: r.estimated_age_unit ?? undefined,
    estimated_age_as_of: r.estimated_age_as_of ?? undefined,
    breed_id: r.breed_id ?? undefined,
    breed_text: r.breed_text ?? undefined,
    is_mixed_breed: r.is_mixed_breed ?? false,
    litter_id: r.litter_id ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function normalizeColumn(col: string, value: any): any {
  if (DATE_COLUMNS.has(col) && value === '') return null;
  if (NULLABLE_TEXT_COLUMNS.has(col)) {
    if (value == null) return null;
    const trimmed = typeof value === 'string' ? value.trim() : value;
    return trimmed === '' ? null : trimmed;
  }
  return value;
}

/** Build an INSERT payload for a new animal, scoped to an org. */
export function animalToInsert(
a: Omit<Animal, 'id' | 'created_at' | 'updated_at'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of WRITABLE_COLUMNS) {
    const v = (a as any)[col];
    if (v === undefined) continue;
    // uuid columns: seed ids ('f1') aren't UUIDs — skip so the write doesn't fail.
    if (UUID_COLUMNS.has(col) && !isUuid(v)) continue;
    row[col] = normalizeColumn(col, v);
  }
  clearAgeFieldsIfNeeded(row);
  return row;
}

/** Build an UPDATE payload from a partial Animal patch. */
export function animalUpdateToRow(updates: Partial<Animal>) {
  const row: Record<string, any> = {};
  for (const col of WRITABLE_COLUMNS) {
    if (!(col in updates)) continue;
    const v = (updates as any)[col];
    if (UUID_COLUMNS.has(col) && v != null && !isUuid(v)) continue;
    row[col] = normalizeColumn(col, v);
  }
  clearAgeFieldsIfNeeded(row);
  return row;
}
