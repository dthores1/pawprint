import { Adoption } from '../types';

export function rowToAdoption(r: any): Adoption {
  return {
    id: r.id,
    animal_id: r.animal_id,
    adopter_id: r.adopter_id,
    status: r.status,
    submitted_at: r.submitted_at ?? undefined,
    approved_at: r.approved_at ?? undefined,
    completed_at: r.completed_at ?? undefined,
    cancelled_at: r.cancelled_at ?? undefined,
    paperwork_sent_at: r.paperwork_sent_at ?? undefined,
    paperwork_completed_at: r.paperwork_completed_at ?? undefined,
    // numeric(10,2) comes back as a string from PostgREST.
    donation_amount: r.donation_amount != null ? Number(r.donation_amount) : undefined,
    notes: r.notes ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at ?? undefined
  };
}

export function adoptionToInsert(
input: { animal_id: string; adopter_id: string; notes?: string },
organizationId: string)
{
  return {
    organization_id: organizationId,
    animal_id: input.animal_id,
    adopter_id: input.adopter_id,
    status: 'inquiry',
    notes: input.notes || null
  };
}

const UPDATABLE = [
'status',
'submitted_at',
'approved_at',
'completed_at',
'cancelled_at',
'paperwork_sent_at',
'paperwork_completed_at',
'donation_amount',
'notes'] as
const;

/** Build an UPDATE payload from a partial Adoption patch (only provided keys). */
export function adoptionUpdateToRow(updates: Partial<Adoption>) {
  const row: Record<string, any> = {};
  for (const col of UPDATABLE) {
    if (!(col in updates)) continue;
    const v = (updates as any)[col];
    row[col] = v === undefined || v === '' ? null : v;
  }
  return row;
}
