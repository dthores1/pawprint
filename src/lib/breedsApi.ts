import { Animal, Breed, BreedSpecies, Species } from '../types';

export function rowToBreed(r: any): Breed {
  return {
    id: r.id,
    species: r.species,
    name: r.name,
    active: r.active ?? true
  };
}

// The app's Species is TitleCase (Dog/Cat/Other); breeds.species is lowercase
// and finer-grained. 'Other' maps to the non-dog/cat catalogs.
export function breedSpeciesKeys(species: Species): BreedSpecies[] {
  if (species === 'Dog') return ['dog'];
  if (species === 'Cat') return ['cat'];
  return ['rabbit', 'bird', 'other'];
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
