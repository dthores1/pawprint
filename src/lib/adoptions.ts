import { Adoption, AdoptionStatus } from '../types';

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
  cancelled: 'Cancelled'
};

export function isActiveAdoption(a: Adoption): boolean {
  return a.status !== 'completed' && a.status !== 'cancelled';
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
  { label: 'Cancelled', at: a.cancelled_at }].
  filter((m) => m.at);
}

export function formatDonation(amount?: number): string | null {
  if (amount == null) return null;
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
