import { Trait, AnimalTrait } from '../types';

export function rowToTrait(r: any): Trait {
  return {
    id: r.id,
    organization_id: r.organization_id,
    name: r.name,
    description: r.description ?? undefined,
    species_id: r.species_id ?? undefined,
    active: r.active ?? true,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

export function rowToAnimalTrait(r: any): AnimalTrait {
  return {
    id: r.id,
    organization_id: r.organization_id,
    animal_id: r.animal_id,
    trait_id: r.trait_id
  };
}

const TRAIT_COLUMNS = ['name', 'description', 'species_id', 'active'] as const;

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function traitToInsert(
t: Pick<Trait, 'name'> & Partial<Trait>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of TRAIT_COLUMNS) {
    const v = (t as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function traitUpdateToRow(updates: Partial<Trait>) {
  const row: Record<string, any> = {};
  for (const col of TRAIT_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
