import { Person } from '../types';

export function rowToPerson(r: any): Person {
  return {
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email ?? '',
    phone: r.phone ?? undefined,
    role: r.role,
    volunteer_type: r.volunteer_type ?? undefined,
    organization_name: r.organization_name ?? undefined,
    notes: r.notes ?? undefined,
    photo_url: r.photo_url ?? undefined,
    active: r.active ?? true,
    created_at: r.created_at,
    user_id: r.user_id ?? undefined
  };
}

const PERSON_COLUMNS = [
'first_name',
'last_name',
'email',
'phone',
'role',
'volunteer_type',
'organization_name',
'notes',
'photo_url',
'active'] as
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
