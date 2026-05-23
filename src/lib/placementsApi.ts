import { FosterPlacement } from '../types';

export function rowToPlacement(r: any): FosterPlacement {
  return {
    id: r.id,
    animal_id: r.animal_id,
    person_id: r.person_id,
    start_date: r.start_date,
    end_date: r.end_date ?? undefined,
    placement_status: r.placement_status,
    placement_type: r.placement_type ?? 'foster',
    reason_ended: r.reason_ended ?? undefined,
    notes: r.notes ?? undefined
  };
}

const PLACEMENT_COLUMNS = [
'animal_id',
'person_id',
'start_date',
'end_date',
'placement_status',
'placement_type',
'reason_ended',
'notes'] as
const;

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function placementToInsert(
p: Omit<FosterPlacement, 'id'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of PLACEMENT_COLUMNS) {
    const v = (p as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function placementUpdateToRow(updates: Partial<FosterPlacement>) {
  const row: Record<string, any> = {};
  for (const col of PLACEMENT_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
