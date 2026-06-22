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
