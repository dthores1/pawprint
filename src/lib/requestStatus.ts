import {
  SupplyRequestStatus,
  TransportRequestStatus,
  SittingRequestStatus } from
'../types';

// Operational vs. terminal split for the three coordination request types,
// mirroring animalStatus.ts. "Open" = still actively worked (loaded upfront);
// "terminal" = closed/historical (deferred until the Completed/History tab is
// opened, then fetched via ensure*HistoryLoaded). Closed requests accumulate
// unbounded over a rescue's lifetime, so they must never load on every org load.

// Supply (migration taxonomy: submitted → in_progress → fulfilled, with
// cancelled/denied as soft exits).
export const SUPPLY_OPEN_STATUSES: SupplyRequestStatus[] = [
'submitted',
'in_progress'];


export const SUPPLY_TERMINAL_STATUSES: SupplyRequestStatus[] = [
'fulfilled',
'cancelled',
'denied'];


// Transport (open → assigned/accepted/claimed → in_progress → completed, with
// cancelled/expired terminal).
export const TRANSPORT_OPEN_STATUSES: TransportRequestStatus[] = [
'open',
'assigned',
'accepted',
'claimed',
'in_progress'];


export const TRANSPORT_TERMINAL_STATUSES: TransportRequestStatus[] = [
'completed',
'cancelled',
'expired'];


// Sitting (open → claimed → in_progress → completed, with cancelled/expired
// terminal).
export const SITTING_OPEN_STATUSES: SittingRequestStatus[] = [
'open',
'claimed',
'in_progress'];


export const SITTING_TERMINAL_STATUSES: SittingRequestStatus[] = [
'completed',
'cancelled',
'expired'];


export function isSupplyTerminal(status: SupplyRequestStatus): boolean {
  return SUPPLY_TERMINAL_STATUSES.includes(status);
}

export function isTransportTerminal(status: TransportRequestStatus): boolean {
  return TRANSPORT_TERMINAL_STATUSES.includes(status);
}

export function isSittingTerminal(status: SittingRequestStatus): boolean {
  return SITTING_TERMINAL_STATUSES.includes(status);
}
