import { TransportRequest } from '../types';
import { addressFromColumns, addressToColumns } from './address';

export function rowToTransport(r: any): TransportRequest {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    // Default to 'exact' for rows that predate the schedule_type column.
    schedule_type: r.schedule_type ?? 'exact',
    requested_by_person_id: r.requested_by_person_id ?? '',
    assigned_volunteer_person_id: r.assigned_volunteer_person_id ?? undefined,
    animal_id: r.animal_id ?? undefined,
    clinic_event_id: r.clinic_event_id ?? undefined,
    supply_request_id: r.supply_request_id ?? undefined,
    sitting_request_id: r.sitting_request_id ?? undefined,
    pickup_location: r.pickup_location ?? '',
    dropoff_location: r.dropoff_location ?? '',
    pickup_address: addressFromColumns(r, 'pickup', r.pickup_location),
    dropoff_address: addressFromColumns(r, 'dropoff', r.dropoff_location),
    pickup_saved_location_id: r.pickup_saved_location_id ?? undefined,
    dropoff_saved_location_id: r.dropoff_saved_location_id ?? undefined,
    requested_pickup_time: r.requested_pickup_time ?? undefined,
    preferred_window_start: r.preferred_window_start ?? undefined,
    preferred_window_end: r.preferred_window_end ?? undefined,
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
'schedule_type',
'requested_by_person_id',
'assigned_volunteer_person_id',
'animal_id',
'clinic_event_id',
'supply_request_id',
'sitting_request_id',
'pickup_location',
'dropoff_location',
'pickup_saved_location_id',
'dropoff_saved_location_id',
'requested_pickup_time',
'preferred_window_start',
'preferred_window_end',
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
  Object.assign(row, addressToColumns('pickup', req.pickup_address ?? null));
  Object.assign(row, addressToColumns('dropoff', req.dropoff_address ?? null));
  return row;
}

export function transportUpdateToRow(updates: Partial<TransportRequest>) {
  const row: Record<string, any> = {};
  for (const col of TRANSPORT_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  if ('pickup_address' in updates) {
    Object.assign(row, addressToColumns('pickup', updates.pickup_address ?? null));
  }
  if ('dropoff_address' in updates) {
    Object.assign(row, addressToColumns('dropoff', updates.dropoff_address ?? null));
  }
  return row;
}
