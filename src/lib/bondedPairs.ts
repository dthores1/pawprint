import { AnimalRelationship } from '../types';

// Bonded Pair is a *workflow* relationship, not just metadata: bonded animals
// are adopted (and normally fostered) together. Relationships are stored
// one-directional and rendered bidirectional (see RelationshipsCard), so the
// partner lookup checks both sides.

/** Ids of the animals bonded with `animalId` (usually 0 or 1). */
export function bondedPartnerIds(
animalId: string,
relationships: AnimalRelationship[])
: string[] {
  const ids = new Set<string>();
  for (const r of relationships) {
    if (r.relationship_type !== 'bonded_pair') continue;
    if (r.animal_id === animalId) ids.add(r.related_animal_id);
    if (r.related_animal_id === animalId) ids.add(r.animal_id);
  }
  ids.delete(animalId);
  return Array.from(ids);
}
