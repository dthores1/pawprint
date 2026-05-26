import { TransportRequest } from '../types';

export function rowToTransport(r: any): TransportRequest {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    requested_by_person_id: r.requested_by_person_id ?? '',
    assigned_volunteer_person_id: r.assigned_volunteer_person_id ?? undefined,
    animal_id: r.animal_id ?? undefined,
    clinic_event_id: r.clinic_event_id ?? undefined,
    supply_request_id: r.supply_request_id ?? undefined,
    pickup_location: r.pickup_location ?? '',
    dropoff_location: r.dropoff_location ?? '',
    requested_pickup_time: r.requested_pickup_time,
    completed_at: r.completed_at ?? undefined,
    notes: r.notes ?? undefined,
    urgency: r.urgency,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

const TRANSPORT_COLUMNS = [
'type',
'status',
'requested_by_person_id',
'assigned_volunteer_person_id',
'animal_id',
'clinic_event_id',
'supply_request_id',
'pickup_location',
'dropoff_location',
'requested_pickup_time',
'completed_at',
'notes',
'urgency'] as
const;

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function transportToInsert(
req: Omit<TransportRequest, 'id' | 'created_at' | 'updated_at'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of TRANSPORT_COLUMNS) {
    const v = (req as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function transportUpdateToRow(updates: Partial<TransportRequest>) {
  const row: Record<string, any> = {};
  for (const col of TRANSPORT_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
