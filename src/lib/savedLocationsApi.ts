import { SavedLocation } from '../types';
import { addressToColumns, addressFromColumns } from './address';

export function rowToSavedLocation(r: any): SavedLocation {
  return {
    id: r.id,
    organization_id: r.organization_id,
    name: r.name,
    address: addressFromColumns(r, 'location', r.location_formatted),
    active: r.active ?? true,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

export function savedLocationToInsert(
loc: Omit<SavedLocation, 'id' | 'organization_id' | 'created_at' | 'updated_at'>,
organizationId: string)
{
  const row: Record<string, any> = {
    organization_id: organizationId,
    name: loc.name,
    active: loc.active
  };
  Object.assign(row, addressToColumns('location', loc.address ?? null));
  return row;
}

export function savedLocationUpdateToRow(updates: Partial<SavedLocation>) {
  const row: Record<string, any> = {};
  if ('name' in updates) row.name = updates.name;
  if ('active' in updates) row.active = updates.active;
  if ('address' in updates) {
    Object.assign(row, addressToColumns('location', updates.address ?? null));
  }
  return row;
}
