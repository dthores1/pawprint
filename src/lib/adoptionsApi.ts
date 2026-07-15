import { Adoption } from '../types';

export function rowToAdoption(r: any): Adoption {
  return {
    id: r.id,
    animal_id: r.animal_id,
    adopter_id: r.adopter_id ?? undefined,
    status: r.status,
    source: r.source ?? 'workflow',
    submitted_at: r.submitted_at ?? undefined,
    approved_at: r.approved_at ?? undefined,
    completed_at: r.completed_at ?? undefined,
    cancelled_at: r.cancelled_at ?? undefined,
    paperwork_sent_at: r.paperwork_sent_at ?? undefined,
    paperwork_completed_at: r.paperwork_completed_at ?? undefined,
    returned_at: r.returned_at ?? undefined,
    return_reason: r.return_reason ?? undefined,
    return_notes: r.return_notes ?? undefined,
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

/**
 * Build an INSERT for an adoption recorded directly (Edit modal status change,
 * typically a historical/backfilled adoption). The row is born `completed` on
 * the given date with source='direct' so Reports can keep it out of the
 * application-funnel metrics. The adopter may be unknown.
 */
export function directAdoptionToInsert(
input: {
  animal_id: string;
  adopter_id?: string;
  adopted_on: string;
  notes?: string;
},
organizationId: string)
{
  return {
    organization_id: organizationId,
    animal_id: input.animal_id,
    adopter_id: input.adopter_id || null,
    status: 'completed',
    source: 'direct',
    completed_at: input.adopted_on,
    notes: input.notes?.trim() || null
  };
}

/**
 * Build an INSERT for a return recorded with no prior adoption record on file —
 * the row is created already in the terminal `returned` state, stamping the
 * original adopter and the return details (reason satisfies the DB CHECK). We
 * don't know the original completion date, so `completed_at` is left null.
 */
export function adoptionReturnToInsert(
input: {
  animal_id: string;
  adopter_id: string;
  returned_at: string;
  return_reason: string;
  return_notes?: string;
},
organizationId: string)
{
  return {
    organization_id: organizationId,
    animal_id: input.animal_id,
    adopter_id: input.adopter_id,
    status: 'returned',
    returned_at: input.returned_at,
    return_reason: input.return_reason,
    return_notes: input.return_notes?.trim() || null
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
'returned_at',
'return_reason',
'return_notes',
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
