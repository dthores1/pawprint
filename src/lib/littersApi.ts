import { Litter } from '../types';

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
    notes: litter.notes || null
  };
}
