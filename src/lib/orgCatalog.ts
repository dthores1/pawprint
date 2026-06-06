import {
  SpeciesCatalog,
  Breed,
  OrganizationSpecies,
  OrganizationBreed } from
'../types';

// Tenant-aware views over the global catalog, driven by the org's
// organization_species / organization_breeds rows (migration 0042, Settings UI).
// Single source of truth so every picker/filter agrees.

/**
 * Species the org accepts, in catalog order. Defensive: an org with NO
 * organization_species rows at all (misconfig / pre-0042) falls back to ALL
 * active species so the app is never left with an empty species set.
 */
export function enabledSpeciesList(
species: SpeciesCatalog[],
orgSpecies: OrganizationSpecies[])
: SpeciesCatalog[] {
  if (orgSpecies.length === 0) return species;
  const enabled = new Set(
    orgSpecies.filter((r) => r.is_enabled).map((r) => r.species_id)
  );
  return species.filter((s) => enabled.has(s.id));
}

/**
 * The org's default species id: the explicit is_default row if enabled, else
 * the lone enabled species, else undefined (caller falls back to the first).
 */
export function defaultSpeciesId(
species: SpeciesCatalog[],
orgSpecies: OrganizationSpecies[])
: string | undefined {
  const explicit = orgSpecies.find((r) => r.is_default && r.is_enabled);
  if (explicit) return explicit.species_id;
  const enabled = enabledSpeciesList(species, orgSpecies);
  return enabled.length === 1 ? enabled[0].id : undefined;
}

/**
 * Accepted breeds for a species: its active catalog breeds intersected with the
 * org's restriction. No org_breeds rows for the species → all are accepted
 * (opt-in narrowing).
 */
export function acceptedBreeds(
speciesId: string | undefined,
breeds: Breed[],
orgBreeds: OrganizationBreed[])
: Breed[] {
  if (!speciesId) return [];
  const speciesBreeds = breeds.filter(
    (b) => b.active && b.species_id === speciesId
  );
  const allowed = new Set(
    orgBreeds.filter((r) => r.is_enabled).map((r) => r.breed_id)
  );
  const restrictedHere = speciesBreeds.filter((b) => allowed.has(b.id));
  return restrictedHere.length > 0 ? restrictedHere : speciesBreeds;
}
