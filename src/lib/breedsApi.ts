import { Animal, Breed } from '../types';

export function rowToBreed(r: any): Breed {
  return {
    id: r.id,
    species: r.species,
    species_id: r.species_id ?? undefined,
    name: r.name,
    active: r.active ?? true
  };
}

/** Display label for an animal's breed: free text, else the catalog name. */
export function animalBreedLabel(
animal: Pick<Animal, 'breed_id' | 'breed_text'>,
breeds: Breed[])
: string | undefined {
  if (animal.breed_text) return animal.breed_text;
  if (animal.breed_id) {
    return breeds.find((b) => b.id === animal.breed_id)?.name;
  }
  return undefined;
}
