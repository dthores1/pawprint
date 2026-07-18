import {
  Adoption,
  AdoptionStatus,
  AdoptionCancelReason,
  AdoptionReturnReason } from
'../types';

// The linear in-progress flow (terminal 'completed'/'cancelled' are reached via
// dedicated actions, not the regular advance dropdown).
export const ADOPTION_FLOW: AdoptionStatus[] = [
'inquiry',
'application_submitted',
'meet_and_greet',
'pending_paperwork',
'ready_for_placement'];


export const ADOPTION_STATUS_LABELS: Record<AdoptionStatus, string> = {
  inquiry: 'Inquiry',
  application_submitted: 'Application Submitted',
  meet_and_greet: 'Meet & Greet',
  pending_paperwork: 'Pending Paperwork',
  ready_for_placement: 'Ready for Placement',
  completed: 'Completed',
  cancelled: 'Cancelled',
  returned: 'Returned'
};

// Unsuccessful-close outcomes for the Close Adoption dialog. Order doubles as
// the dropdown order ('adopted' — the successful outcome — is offered first,
// separately, since it maps to status='completed' rather than a cancel reason).
export const ADOPTION_CANCEL_REASON_LABELS: Record<
  AdoptionCancelReason,
  string> =
{
  applicant_withdrew: 'Applicant Withdrew',
  application_rejected: 'Application Rejected',
  no_response: 'No Response / Ghosted',
  duplicate_application: 'Duplicate Application',
  other: 'Other'
};

export const ADOPTION_CANCEL_REASONS = Object.keys(
  ADOPTION_CANCEL_REASON_LABELS
) as AdoptionCancelReason[];

/** The final outcome shown once an adoption is closed (badge/card copy). */
export function adoptionOutcomeLabel(a: Adoption): string {
  if (a.status === 'completed') return 'Adopted';
  if (a.status === 'returned') return 'Returned';
  if (a.status === 'cancelled') {
    return a.cancelled_reason ?
    ADOPTION_CANCEL_REASON_LABELS[a.cancelled_reason] :
    'Cancelled';
  }
  return ADOPTION_STATUS_LABELS[a.status];
}

// Adopter-facing reasons for a return. Order doubles as the dropdown order.
export const ADOPTION_RETURN_REASON_LABELS: Record<
  AdoptionReturnReason,
  string> =
{
  behavior: 'Behavioral issues',
  medical: 'Medical needs',
  financial: 'Financial hardship',
  housing: 'Housing restrictions',
  pet_compatibility: 'Pet compatibility',
  family_compatibility: 'Family compatibility',
  life_changes: 'Life changes',
  rescue_request: 'Rescue request',
  other: 'Other'
};

export const ADOPTION_RETURN_REASONS = Object.keys(
  ADOPTION_RETURN_REASON_LABELS
) as AdoptionReturnReason[];

const TERMINAL_STATUSES: AdoptionStatus[] = [
'completed',
'cancelled',
'returned'];


export function isActiveAdoption(a: Adoption): boolean {
  return !TERMINAL_STATUSES.includes(a.status);
}

// When moving to a status, stamp the matching milestone timestamp — but only if
// it isn't already set, so re-visiting a step doesn't rewrite history.
export function adoptionStatusPatch(
adoption: Adoption,
status: AdoptionStatus)
: Partial<Adoption> {
  const ts = new Date().toISOString();
  const patch: Partial<Adoption> = { status };
  if (status === 'application_submitted' && !adoption.submitted_at) {
    patch.submitted_at = ts;
  }
  if (status === 'pending_paperwork' && !adoption.paperwork_sent_at) {
    patch.paperwork_sent_at = ts;
  }
  if (status === 'ready_for_placement') {
    if (!adoption.paperwork_completed_at) patch.paperwork_completed_at = ts;
    if (!adoption.approved_at) patch.approved_at = ts;
  }
  return patch;
}

/** Ordered milestones for the panel timeline: label + the timestamp (if reached). */
export function adoptionMilestones(
a: Adoption)
: { label: string; at?: string }[] {
  return [
  { label: 'Started', at: a.created_at },
  { label: 'Application submitted', at: a.submitted_at },
  { label: 'Paperwork sent', at: a.paperwork_sent_at },
  { label: 'Paperwork completed', at: a.paperwork_completed_at },
  { label: 'Completed', at: a.completed_at },
  // "Close Adoption" is the action; the outcome explains why it was closed.
  {
    label: a.cancelled_reason ?
    `Closed – ${ADOPTION_CANCEL_REASON_LABELS[a.cancelled_reason]}` :
    'Closed',
    at: a.cancelled_at
  },
  { label: 'Returned', at: a.returned_at }].
  filter((m) => m.at);
}

export function formatDonation(amount?: number): string | null {
  if (amount == null) return null;
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
