import { SpeciesCatalog } from '../types';

/** Supabase row → app SpeciesCatalog (global `species` table, migration 0037). */
export function rowToSpecies(r: any): SpeciesCatalog {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    icon_name: r.icon_name ?? undefined,
    sort_order: r.sort_order ?? 0,
    active: r.active ?? true
  };
}
