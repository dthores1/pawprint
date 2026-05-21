import { AnimalRelationship } from '../types';

export function rowToRelationship(r: any): AnimalRelationship {
  return {
    id: r.id,
    animal_id: r.animal_id,
    related_animal_id: r.related_animal_id,
    relationship_type: r.relationship_type,
    notes: r.notes ?? undefined
  };
}

export function relationshipToInsert(
rel: Omit<AnimalRelationship, 'id'>,
organizationId: string)
{
  return {
    organization_id: organizationId,
    animal_id: rel.animal_id,
    related_animal_id: rel.related_animal_id,
    relationship_type: rel.relationship_type,
    notes: rel.notes ?? null
  };
}
