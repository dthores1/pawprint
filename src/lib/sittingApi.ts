import { SittingRequest, SittingRequestPlacement } from '../types';

export function rowToSitting(r: any): SittingRequest {
  return {
    id: r.id,
    requested_by_person_id: r.requested_by_person_id ?? '',
    sitter_person_id: r.sitter_person_id ?? undefined,
    coverage_scope: r.coverage_scope,
    start_date: r.start_date,
    end_date: r.end_date,
    notes: r.notes ?? undefined,
    medication_required: r.medication_required ?? false,
    foster_provides_supplies: r.foster_provides_supplies ?? true,
    transport_needed: r.transport_needed ?? false,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

export function rowToSittingPlacement(r: any): SittingRequestPlacement {
  return {
    id: r.id,
    sitting_request_id: r.sitting_request_id,
    foster_placement_id: r.foster_placement_id
  };
}

const SITTING_COLUMNS = [
'requested_by_person_id',
'sitter_person_id',
'coverage_scope',
'start_date',
'end_date',
'notes',
'medication_required',
'foster_provides_supplies',
'transport_needed',
'status'] as
const;

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function sittingToInsert(
req: Omit<SittingRequest, 'id' | 'created_at' | 'updated_at'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of SITTING_COLUMNS) {
    const v = (req as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function sittingUpdateToRow(updates: Partial<SittingRequest>) {
  const row: Record<string, any> = {};
  for (const col of SITTING_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
