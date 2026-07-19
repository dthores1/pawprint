import {
  Adoption,
  AdoptionStatus,
  AdoptionRejectedReason,
  AdoptionApplicantCancelReason,
  LegacyAdoptionCancelReason,
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
  rejected: 'Rejected',
  cancelled_by_applicant: 'Cancelled by Applicant',
  duplicate: 'Duplicate',
  cancelled: 'Cancelled',
  returned: 'Returned'
};

// The unsuccessful-close ("lost") statuses. Order doubles as the Close
// Adoption dialog's outcome order; the generic 'cancelled' is kept for
// org-side closes, mistake corrections, and legacy rows but is not offered
// as a Close outcome.
export const ADOPTION_LOST_STATUSES: AdoptionStatus[] = [
'rejected',
'cancelled_by_applicant',
'duplicate',
'cancelled'];


export function isLostAdoption(a: Adoption): boolean {
  return ADOPTION_LOST_STATUSES.includes(a.status);
}

// Per-status reason vocabularies for a lost close (shared `cancelled_reason`
// column). Order doubles as the dropdown order.
export const ADOPTION_REJECTED_REASON_LABELS: Record<
  AdoptionRejectedReason,
  string> =
{
  not_good_fit: 'Applicant Not a Good Fit',
  housing_restrictions: 'Landlord / Housing Restrictions',
  pet_compatibility: 'Resident Pet Compatibility',
  care_requirements: 'Applicant Unable to Meet Care Requirements',
  home_visit_unsuccessful: 'Home Visit Unsuccessful',
  incomplete_application: 'Incomplete Application',
  unable_to_verify: 'Unable to Verify Information',
  no_response: 'No Response / Unresponsive',
  outside_service_area: 'Outside Service Area',
  other: 'Other'
};

export const ADOPTION_REJECTED_REASONS = Object.keys(
  ADOPTION_REJECTED_REASON_LABELS
) as AdoptionRejectedReason[];

export const ADOPTION_APPLICANT_CANCEL_REASON_LABELS: Record<
  AdoptionApplicantCancelReason,
  string> =
{
  no_longer_interested: 'No Longer Interested',
  adopted_elsewhere: 'Adopted Elsewhere',
  circumstances_changed: 'Personal Circumstances Changed',
  care_requirements: 'Unable to Meet Care Requirements',
  scheduling: 'Scheduling / Timing',
  found_another_pet: 'Found Another Pet',
  moving: 'Moving',
  other: 'Other'
};

export const ADOPTION_APPLICANT_CANCEL_REASONS = Object.keys(
  ADOPTION_APPLICANT_CANCEL_REASON_LABELS
) as AdoptionApplicantCancelReason[];

// Slugs written by the first Close Adoption iteration (pre-0105); still on
// rows closed before the lost-status split. Display-only.
const LEGACY_CANCEL_REASON_LABELS: Record<LegacyAdoptionCancelReason, string> =
{
  applicant_withdrew: 'Applicant Withdrew',
  application_rejected: 'Application Rejected',
  no_response: 'No Response / Ghosted',
  duplicate_application: 'Duplicate Application'
};

/** Human label for a lost adoption's recorded reason, resolved against the
 *  status's vocabulary (falling back to the legacy slugs). Null if none. */
export function adoptionCloseReasonLabel(a: Adoption): string | null {
  const r = a.cancelled_reason;
  if (!r) return null;
  if (a.status === 'rejected' && r in ADOPTION_REJECTED_REASON_LABELS) {
    return ADOPTION_REJECTED_REASON_LABELS[r as AdoptionRejectedReason];
  }
  if (
  a.status === 'cancelled_by_applicant' &&
  r in ADOPTION_APPLICANT_CANCEL_REASON_LABELS)
  {
    return ADOPTION_APPLICANT_CANCEL_REASON_LABELS[
    r as AdoptionApplicantCancelReason];

  }
  // System-recorded: an animal on the application died while it was open.
  if (r === 'deceased') return 'Deceased';
  if (r in LEGACY_CANCEL_REASON_LABELS) {
    return LEGACY_CANCEL_REASON_LABELS[r as LegacyAdoptionCancelReason];
  }
  if (r === 'other') return 'Other';
  return r.replace(/_/g, ' ');
}

/** The final outcome shown once an adoption is closed (badge/card copy). */
export function adoptionOutcomeLabel(a: Adoption): string {
  if (a.status === 'completed') return 'Adopted';
  if (a.status === 'returned') return 'Returned';
  // Legacy generic close: the recorded reason (when present) is more telling
  // than a bare org-sounding "Cancelled".
  if (a.status === 'cancelled') {
    return adoptionCloseReasonLabel(a) ?? 'Cancelled';
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

// Central "is this application closed?" definition — the lost statuses plus
// completed and returned. Anything needing closed-ness derives from here (via
// isActiveAdoption); there is no separate computed column.
const TERMINAL_STATUSES: AdoptionStatus[] = [
'completed',
'rejected',
'cancelled_by_applicant',
'duplicate',
'cancelled',
'returned'];


export function isActiveAdoption(a: Adoption): boolean {
  return !TERMINAL_STATUSES.includes(a.status);
}

/** Every animal on the record — bonded pairs adopt together on one
 *  application, so a record can cover more than one animal. */
export function adoptionAnimalIds(a: Adoption): string[] {
  return a.animal_ids && a.animal_ids.length > 0 ? a.animal_ids : [a.animal_id];
}

export function adoptionCoversAnimal(a: Adoption, animalId: string): boolean {
  return adoptionAnimalIds(a).includes(animalId);
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
  // "Close Adoption" is the action; the outcome/reason explains why. The
  // status badge already names the outcome, so prefer the finer reason here.
  {
    label: (() => {
      const detail =
      adoptionCloseReasonLabel(a) ??
      (a.status !== 'cancelled' && isLostAdoption(a) ?
      ADOPTION_STATUS_LABELS[a.status] :
      null);
      return detail ? `Closed – ${detail}` : 'Closed';
    })(),
    at: a.cancelled_at
  },
  { label: 'Returned', at: a.returned_at }].
  filter((m) => m.at);
}

export function formatDonation(amount?: number): string | null {
  if (amount == null) return null;
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
