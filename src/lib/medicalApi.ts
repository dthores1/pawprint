import { MedicalRecord } from '../types';

export function rowToMedicalRecord(r: any): MedicalRecord {
  return {
    id: r.id,
    animal_id: r.animal_id,
    procedure_type: r.procedure_type,
    procedure: r.procedure ?? undefined,
    procedure_name: r.procedure_name,
    custom_procedure_name: r.custom_procedure_name ?? undefined,
    product_name: r.product_name ?? undefined,
    performed_date: r.performed_date ?? undefined,
    due_date: r.due_date ?? undefined,
    status: r.status,
    provider_contact_id: r.provider_contact_id ?? undefined,
    provider_name: r.provider_name ?? undefined,
    clinic_id: r.clinic_id ?? undefined,
    created_at: r.created_at ?? undefined,
    facility_name: r.facility_name ?? undefined,
    microchip_number: r.microchip_number ?? undefined,
    lot_number: r.lot_number ?? undefined,
    manufacturer: r.manufacturer ?? undefined,
    dosage: r.dosage ?? undefined,
    dose_unit: r.dose_unit ?? undefined,
    route: r.route ?? undefined,
    body_location: r.body_location ?? undefined,
    expiration_date: r.expiration_date ?? undefined,
    notes: r.notes ?? undefined,
    next_due_date: r.next_due_date ?? undefined
  };
}

const MEDICAL_COLUMNS = [
'animal_id',
'procedure_type',
'procedure',
'procedure_name',
'custom_procedure_name',
'product_name',
'performed_date',
'due_date',
'status',
'provider_contact_id',
'provider_name',
'clinic_id',
'facility_name',
'microchip_number',
'lot_number',
'manufacturer',
'dosage',
'dose_unit',
'route',
'body_location',
'expiration_date',
'notes',
'next_due_date'] as
const;

// Numeric column: blank → null, otherwise coerce; non-numeric → null.
const NUMERIC_COLUMNS = new Set<string>(['dosage']);

// Empty strings → null (date/numeric columns reject '').
function normalize(col: string, v: any): any {
  if (NUMERIC_COLUMNS.has(col)) {
    if (v === '' || v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }
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
    row[col] = normalize(col, v);
  }
  return row;
}

export function medicalUpdateToRow(updates: Partial<MedicalRecord>) {
  const row: Record<string, any> = {};
  for (const col of MEDICAL_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize(col, (updates as any)[col]);
  }
  return row;
}
