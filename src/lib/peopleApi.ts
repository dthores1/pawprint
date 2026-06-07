import { Person, PersonRole } from '../types';

// The legacy `people.role` column is NOT NULL and only allows these four — note
// 'foster_parent' is NOT valid there (it lives only in `roles[]`). Derive a safe
// legacy value from the multi-role array for back-compat writes.
const LEGACY_ROLES: PersonRole[] = ['vet', 'rescue_staff', 'volunteer', 'adopter'];
export function legacyRoleFor(roles: PersonRole[]): PersonRole {
  return roles.find((r) => LEGACY_ROLES.includes(r)) ?? 'volunteer';
}

export function rowToPerson(r: any): Person {
  return {
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email ?? '',
    phone: r.phone ?? undefined,
    // Read from roles[]; fall back to wrapping the legacy single role.
    roles: r.roles && r.roles.length ? r.roles : r.role ? [r.role] : [],
    role: r.role,
    volunteer_type: r.volunteer_type ?? undefined,
    organization_name: r.organization_name ?? undefined,
    notes: r.notes ?? undefined,
    photo_url: r.photo_url ?? undefined,
    active: r.active ?? true,
    created_at: r.created_at,
    user_id: r.user_id ?? undefined,
    address: r.address ?? undefined,
    address_google_place_id: r.address_google_place_id ?? undefined,
    address_formatted: r.address_formatted ?? undefined,
    address_street_1: r.address_street_1 ?? undefined,
    address_street_2: r.address_street_2 ?? undefined,
    address_city: r.address_city ?? undefined,
    address_state: r.address_state ?? undefined,
    address_postal_code: r.address_postal_code ?? undefined,
    address_country: r.address_country ?? undefined,
    // numeric(10,7) comes back as a string from PostgREST.
    address_latitude:
    r.address_latitude != null ? Number(r.address_latitude) : undefined,
    address_longitude:
    r.address_longitude != null ? Number(r.address_longitude) : undefined,
    max_capacity: r.max_capacity ?? undefined,
    preferred_species:
    (r.preferred_species ?? undefined) as string[] | undefined
  };
}

const PERSON_COLUMNS = [
'first_name',
'last_name',
'email',
'phone',
'roles',
'role',
'volunteer_type',
'organization_name',
'notes',
'photo_url',
'active',
'address',
'address_google_place_id',
'address_formatted',
'address_street_1',
'address_street_2',
'address_city',
'address_state',
'address_postal_code',
'address_country',
'address_latitude',
'address_longitude',
'max_capacity',
'preferred_species'] as
const;

// Slim column projection for the all-people index (search / pickers /
// name-resolution). Lightweight so loading every contact (incl. inactive) stays
// cheap; the heavy full rows (addresses, foster capacity, etc.) stay scoped to
// active. `rowToPerson` is defensive, so a row with only these columns maps to a
// valid Person (absent fields fall back to their defaults).
export const PEOPLE_INDEX_COLUMNS =
'id,organization_id,first_name,last_name,email,phone,roles,role,' +
'organization_name,photo_url,active,user_id,created_at';

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function personToInsert(
p: Omit<Person, 'id' | 'created_at'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of PERSON_COLUMNS) {
    const v = (p as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function personUpdateToRow(updates: Partial<Person>) {
  const row: Record<string, any> = {};
  for (const col of PERSON_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
