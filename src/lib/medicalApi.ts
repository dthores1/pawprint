import { MedicalRecord } from '../types';

export function rowToMedicalRecord(r: any): MedicalRecord {
  return {
    id: r.id,
    animal_id: r.animal_id,
    procedure_type: r.procedure_type,
    procedure_name: r.procedure_name,
    performed_date: r.performed_date ?? undefined,
    due_date: r.due_date ?? undefined,
    status: r.status,
    provider_contact_id: r.provider_contact_id ?? undefined,
    provider_name: r.provider_name ?? undefined,
    clinic_id: r.clinic_id ?? undefined,
    facility_name: r.facility_name ?? undefined,
    notes: r.notes ?? undefined,
    next_due_date: r.next_due_date ?? undefined
  };
}

const MEDICAL_COLUMNS = [
'animal_id',
'procedure_type',
'procedure_name',
'performed_date',
'due_date',
'status',
'provider_contact_id',
'provider_name',
'clinic_id',
'facility_name',
'notes',
'next_due_date'] as
const;

// Empty strings → null (date columns reject '').
function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function medicalToInsert(
m: Omit<MedicalRecord, 'id'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of MEDICAL_COLUMNS) {
    const v = (m as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function medicalUpdateToRow(updates: Partial<MedicalRecord>) {
  const row: Record<string, any> = {};
  for (const col of MEDICAL_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
