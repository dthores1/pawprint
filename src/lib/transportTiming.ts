import { TransportRequest, TransportRequestStatus } from '../types';

// A transport is effectively expired when it's an open EXACT request whose
// pickup time has passed. The nightly cron (expire_transport_requests) persists
// this as status='expired', but we also derive it here so a missed run shows
// immediately in the UI. Only `exact` schedule types expire — flexible / asap /
// coordinate_later intentionally never auto-expire.
export function isExpiredExact(
r: TransportRequest,
now: number = Date.now())
: boolean {
  return (
    r.status === 'open' &&
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
