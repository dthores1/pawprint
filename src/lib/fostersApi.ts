import { FosterParent, Species } from '../types';

export function rowToFoster(r: any): FosterParent {
  return {
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email ?? '',
    phone: r.phone ?? '',
    address: r.address ?? '',
    max_capacity: r.max_capacity ?? 0,
    preferred_species: (r.preferred_species ?? []) as Species[],
    notes: r.notes ?? '',
    active: r.active ?? true,
    photo_url: r.photo_url ?? undefined
  };
}

const FOSTER_COLUMNS = [
'first_name',
'last_name',
'email',
'phone',
'address',
'max_capacity',
'preferred_species',
'notes',
'active',
'photo_url'] as
const;

// Empty strings → null only for actual string values (leaves numbers,
// booleans, and the species array untouched).
function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function fosterToInsert(
f: Omit<FosterParent, 'id'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of FOSTER_COLUMNS) {
    const v = (f as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function fosterUpdateToRow(updates: Partial<FosterParent>) {
  const row: Record<string, any> = {};
  for (const col of FOSTER_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
