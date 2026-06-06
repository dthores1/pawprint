import { OrganizationSpecies, OrganizationBreed } from '../types';

/** Supabase row → app OrganizationSpecies (org_species table, migration 0042). */
export function rowToOrgSpecies(r: any): OrganizationSpecies {
  return {
    id: r.id,
    organization_id: r.organization_id,
    species_id: r.species_id,
    is_enabled: r.is_enabled ?? true,
    is_default: r.is_default ?? false,
    sort_order: r.sort_order ?? 0
  };
}

/** Supabase row → app OrganizationBreed (org_breeds table, migration 0042). */
export function rowToOrgBreed(r: any): OrganizationBreed {
  return {
    id: r.id,
    organization_id: r.organization_id,
    breed_id: r.breed_id,
    is_enabled: r.is_enabled ?? true,
    sort_order: r.sort_order ?? 0
  };
}
