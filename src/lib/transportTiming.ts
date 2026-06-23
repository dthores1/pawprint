import { TransportRequest, TransportRequestStatus } from '../types';

// A transport is effectively expired when it's an uncommitted EXACT request
// whose pickup time has passed. Uncommitted = `open` (nobody picked it up) or
// `assigned` (a volunteer was directed but never accepted). The nightly cron
// (expire_transport_requests) persists this as status='expired', but we also
// derive it here so a missed run shows immediately in the UI. Only `exact`
// schedule types expire — flexible / asap / coordinate_later never auto-expire,
// and committed states (accepted / claimed) never expire.
export function isExpiredExact(
r: TransportRequest,
now: number = Date.now())
: boolean {
  return (
    (r.status === 'open' || r.status === 'assigned') &&
    r.schedule_type === 'exact' &&
    !!r.requested_pickup_time &&
    new Date(r.requested_pickup_time).getTime() < now);
}

// The status to bucket/sort by: 'expired' if persisted or derived, else the
// stored status.
export function effectiveStatus(
r: TransportRequest,
now: number = Date.now())
: TransportRequestStatus {
  if (r.status === 'expired' || isExpiredExact(r, now)) return 'expired';
  return r.status;
}

// ── Stale states ──────────────────────────────────────────────────────────
// A past-due transport has one of two distinct problems, and the badge should
// name the problem, not just the age:
//   * past_due       — nobody ever claimed it. Nothing to "review"; it's just
//                       old and needs a decision (complete / reassign / cancel /
//                       reschedule).
//   * awaiting_review — someone was assigned/claimed it, so the transport may
//                       actually have happened; we just don't know because it
//                       was never marked complete.
// Presence of an assignee is the discriminator. Only EXACT requests have a firm
// scheduled date; completed/cancelled are never stale.
export type TransportStaleKind = 'past_due' | 'awaiting_review';

export interface TransportStaleInfo {
  kind: TransportStaleKind;
  /** Whole calendar days since the scheduled date (≥ 1). */
  days: number;
}

const startOfDayMs = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function transportStaleInfo(
r: TransportRequest,
now: number = Date.now())
: TransportStaleInfo | null {
  if (r.schedule_type !== 'exact' || !r.requested_pickup_time) return null;
  if (r.status === 'completed' || r.status === 'cancelled') return null;
  const days = Math.floor(
    (startOfDayMs(now) -
    startOfDayMs(new Date(r.requested_pickup_time).getTime())) /
    86400000
  );
  if (days < 1) return null; // same-day or future — the day-of reminder covers it
  return {
    kind: r.assigned_volunteer_person_id ? 'awaiting_review' : 'past_due',
    days
  };
}

export const TRANSPORT_STALE_LABEL: Record<TransportStaleKind, string> = {
  past_due: 'Past Due',
  awaiting_review: 'Awaiting Review'
};

// Hover/inline copy explaining the problem and the available next actions. Both
// reference "mark complete" since the Complete action exists for these requests.
export function transportStaleTooltip(s: TransportStaleInfo): string {
  if (s.kind === 'past_due') {
    return (
      `This request was scheduled ${s.days} ${s.days === 1 ? 'day' : 'days'} ago and was never claimed. ` +
      `Mark it complete if it was handled another way, update the date, assign a volunteer, ` +
      `or cancel it if it’s no longer needed.`);

  }
  return (
    `This transport was scheduled ${s.days} ${s.days === 1 ? 'day' : 'days'} ago and hasn’t been marked complete. ` +
    `If it was completed, mark it complete; otherwise reassign the volunteer or cancel the request.`);

}
