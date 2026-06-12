import { Site, SiteNote, SiteVolunteer } from '../types';
import { addressFromColumns, addressToColumns } from './address';
import { CurrentUserLite } from './notesApi';

// — Sites —————————————————————————————————————————————————————————————

/** Supabase row → app Site. Rebuilds the structured address from `address_*`. */
export function rowToSite(r: any): Site {
  return {
    id: r.id,
    organization_id: r.organization_id,
    name: r.name ?? '',
    status: r.status,
    contact_id: r.contact_id ?? undefined,
    site_lead: r.site_lead ?? undefined,
    notes: r.notes ?? undefined,
    address: addressFromColumns(r, 'address'),
    created_by: r.created_by ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

// Scalar columns that line up 1:1 with Site fields. The address rides in via
// addressToColumns('address', …) separately.
const SITE_COLUMNS = ['name', 'status', 'contact_id', 'site_lead', 'notes'] as const;

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function siteToInsert(
  site: Omit<Site, 'id' | 'created_at' | 'updated_at'>,
  organizationId: string,
  createdBy: string | null
) {
  const row: Record<string, any> = {
    organization_id: organizationId,
    created_by: createdBy
  };
  for (const col of SITE_COLUMNS) {
    const v = (site as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  Object.assign(row, addressToColumns('address', site.address ?? null));
  return row;
}

export function siteUpdateToRow(updates: Partial<Site>) {
  const row: Record<string, any> = {};
  for (const col of SITE_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  if ('address' in updates) {
    Object.assign(row, addressToColumns('address', updates.address ?? null));
  }
  return row;
}

// — Site notes (parallel to notesApi) —————————————————————————————————

export function rowToSiteNote(r: any, currentUser?: CurrentUserLite): SiteNote {
  const authorName = r.created_by
    ? r.created_by === currentUser?.id
      ? currentUser?.email ?? 'You'
      : 'Team member'
    : 'Unknown';
  return {
    id: r.id,
    site_id: r.site_id,
    author_name: authorName,
    created_by: r.created_by ?? undefined,
    body: r.body,
    created_at: r.created_at
  };
}

export function siteNoteToInsert(
  note: Omit<SiteNote, 'id' | 'created_at' | 'author_name'>,
  organizationId: string,
  createdBy: string | null
) {
  return {
    organization_id: organizationId,
    site_id: note.site_id,
    body: note.body,
    created_by: createdBy
  };
}

// — Site volunteers (many-to-many people <-> sites) ———————————————————

export function rowToSiteVolunteer(r: any): SiteVolunteer {
  return {
    id: r.id,
    site_id: r.site_id,
    contact_id: r.contact_id,
    role: r.role ?? undefined,
    added_at: r.added_at
  };
}

export function siteVolunteerToInsert(
  vol: Omit<SiteVolunteer, 'id' | 'added_at'>,
  organizationId: string
) {
  return {
    organization_id: organizationId,
    site_id: vol.site_id,
    contact_id: vol.contact_id,
    role: vol.role?.trim() || null
  };
}
