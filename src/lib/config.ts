import { Species } from '../types';

// Org-level configuration. In a real product these would live in a settings
// table and be editable by admins; for now they're typed constants so the
// rest of the app can read them as if they were settings.
//
// Some orgs only handle dogs, others only cats, others both. Setting this
// to a single-item array hides the species filter UI entirely.
export const ENABLED_SPECIES: Species[] = ['Dog', 'Cat'];

export function isSpeciesEnabled(species: Species): boolean {
  return ENABLED_SPECIES.includes(species);
}