import { ClinicEvent, ClinicSlot } from '../types';

// — Clinic events —————————————————————————————————————
export function rowToClinicEvent(r: any): ClinicEvent {
  return {
    id: r.id,
    date_time: r.date_time,
    location: r.location ?? '',
    veterinarian_person_id: r.veterinarian_person_id ?? undefined,
    contact_person_id: r.contact_person_id ?? undefined,
    slot_capacity: r.slot_capacity ?? 0,
    transport_coordinator_person_id:
    r.transport_coordinator_person_id ?? undefined,
    intake_coordinator_person_id: r.intake_coordinator_person_id ?? undefined,
    notes: r.notes ?? undefined,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

const CLINIC_EVENT_COLUMNS = [
'date_time',
'location',
'veterinarian_person_id',
'contact_person_id',
'slot_capacity',
'transport_coordinator_person_id',
'intake_coordinator_person_id',
'notes',
'status'] as
const;

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function clinicEventToInsert(
ev: Omit<ClinicEvent, 'id' | 'created_at' | 'updated_at'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of CLINIC_EVENT_COLUMNS) {
    const v = (ev as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function clinicEventUpdateToRow(updates: Partial<ClinicEvent>) {
  const row: Record<string, any> = {};
  for (const col of CLINIC_EVENT_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}

// — Clinic slots ——————————————————————————————————————
export function rowToClinicSlot(r: any): ClinicSlot {
  return {
    id: r.id,
    clinic_event_id: r.clinic_event_id,
    animal_id: r.animal_id,
    procedure_type: r.procedure_type,
    reserved_by_person_id: r.reserved_by_person_id ?? undefined,
    status: r.status,
    notes: r.notes ?? undefined
  };
}

export function clinicSlotToInsert(
slot: Omit<ClinicSlot, 'id'>,
organizationId: string)
{
  return {
    organization_id: organizationId,
    clinic_event_id: slot.clinic_event_id,
    animal_id: slot.animal_id,
    procedure_type: slot.procedure_type,
    reserved_by_person_id: slot.reserved_by_person_id ?? null,
    status: slot.status,
    notes: slot.notes ?? null
  };
}

const CLINIC_SLOT_COLUMNS = [
'procedure_type',
'reserved_by_person_id',
'status',
'notes'] as
const;

export function clinicSlotUpdateToRow(updates: Partial<ClinicSlot>) {
  const row: Record<string, any> = {};
  for (const col of CLINIC_SLOT_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
