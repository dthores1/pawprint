import { Person, PersonRole, Species } from '../types';

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
    max_capacity: r.max_capacity ?? undefined,
    preferred_species:
    (r.preferred_species ?? undefined) as Species[] | undefined
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
'max_capacity',
'preferred_species'] as
const;

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
