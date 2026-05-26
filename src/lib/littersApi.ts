import { Litter } from '../types';
import { isUuid } from './animalsApi';

export function rowToLitter(r: any): Litter {
  return {
    id: r.id,
    name: r.name ?? undefined,
    species: r.species,
    breed_id: r.breed_id ?? undefined,
    breed_text: r.breed_text ?? undefined,
    estimated_birth_date: r.estimated_birth_date ?? undefined,
    intake_date: r.intake_date,
    intake_source: r.intake_source ?? undefined,
    mother_animal_id: r.mother_animal_id ?? undefined,
    notes: r.notes ?? undefined
  };
}

export function litterToInsert(
litter: Omit<Litter, 'id'>,
organizationId: string)
{
  return {
    organization_id: organizationId,
    name: litter.name || null,
    species: litter.species,
    breed_id: litter.breed_id ?? null,
    breed_text: litter.breed_text ?? null,
    estimated_birth_date: litter.estimated_birth_date || null,
    intake_date: litter.intake_date,
    intake_source: litter.intake_source || null,
    // mother_animal_id references animals(id); skip non-uuid (seed) ids.
    mother_animal_id: isUuid(litter.mother_animal_id) ?
    litter.mother_animal_id :
    null,
    notes: litter.notes || null
  };
}

/** Build an UPDATE payload from a partial Litter patch (only provided keys). */
export function litterUpdateToRow(updates: Partial<Litter>) {
  const row: Record<string, any> = {};
  if ('name' in updates) row.name = updates.name || null;
  if ('species' in updates) row.species = updates.species;
  if ('breed_id' in updates) row.breed_id = updates.breed_id ?? null;
  if ('breed_text' in updates) row.breed_text = updates.breed_text ?? null;
  if ('estimated_birth_date' in updates)
  row.estimated_birth_date = updates.estimated_birth_date || null;
  if ('intake_date' in updates) row.intake_date = updates.intake_date;
  if ('intake_source' in updates)
  row.intake_source = updates.intake_source || null;
  if ('mother_animal_id' in updates) {
    row.mother_animal_id = isUuid(updates.mother_animal_id) ?
    updates.mother_animal_id :
    null;
  }
  if ('notes' in updates) row.notes = updates.notes || null;
  return row;
}
