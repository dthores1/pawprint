import { AnimalExternalListing } from '../types';

export function rowToExternalListing(r: any): AnimalExternalListing {
  return {
    id: r.id,
    animal_id: r.animal_id,
    provider: r.provider,
    url: r.url,
    status: r.status,
    notes: r.notes ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

export function externalListingToInsert(
listing: Omit<AnimalExternalListing, 'id' | 'created_at' | 'updated_at'>,
organizationId: string)
{
  return {
    organization_id: organizationId,
    animal_id: listing.animal_id,
    provider: listing.provider,
    url: listing.url,
    status: listing.status,
    notes: listing.notes ?? null
  };
}

const EXTERNAL_LISTING_COLUMNS = ['provider', 'url', 'status', 'notes'] as const;

export function externalListingUpdateToRow(
updates: Partial<AnimalExternalListing>)
{
  const row: Record<string, any> = {};
  for (const col of EXTERNAL_LISTING_COLUMNS) {
    if (!(col in updates)) continue;
    const v = (updates as any)[col];
    row[col] = typeof v === 'string' && v === '' ? null : v;
  }
  return row;
}
