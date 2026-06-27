import React from 'react';
import { Link } from 'react-router-dom';
import {
  HandHelpingIcon,
  TruckIcon,
  HeartHandshakeIcon,
  PackageIcon,
  ChevronRightIcon } from
'lucide-react';
import { Card } from '../ui/Card';
import { useWhisker } from '../../context/WhiskerContext';
import { useCanManageSupplyRequests } from '../../lib/useSupplyPermissions';
import { cn, animalDisplayName } from '../../lib/utils';
import { TransportRequest, SittingRequest } from '../../types';

const HELP_LIMIT = 6;

// A single cross-type "someone is needed" row.
interface HelpItem {
  id: string;
  typeLabel: string;
  icon: React.ElementType;
  subject: string;
  detail?: string;
  statusLabel: string;
  pill: string;
  to: string;
  sortTs: number;
}

// Blue (not amber) so "Unclaimed" reads as available — matches the Open pill on
// the Transport/Sitting request lists, and keeps amber for warnings.
const PILL_UNCLAIMED = 'bg-[#E3E4F2] text-[#525694]';
const PILL_SUBMITTED = 'bg-[#E5E2DC] text-[#6B6B6B]';
const UNDATED = Number.MAX_SAFE_INTEGER;

function fmtDay(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}
// Parse 'yyyy-MM-dd' (or ISO) at LOCAL midnight so date-only values don't shift.
function parseLocalDate(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00`);
}
function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
// Past-due = the request's needed DAY is before today, so it's stale ("Needs
// Review"), not actionable help. Help Needed excludes these. Open-ended types
// (asap / coordinate_later, no date) are never past-due.
function isTransportPastNeeded(r: TransportRequest, now: Date = new Date()): boolean {
  const today = startOfDayMs(now);
  if (r.schedule_type === 'exact' && r.requested_pickup_time) {
    return startOfDayMs(new Date(r.requested_pickup_time)) < today;
  }
  if (r.schedule_type === 'flexible') {
    const end = r.preferred_window_end ?? r.preferred_window_start;
    if (end) return startOfDayMs(parseLocalDate(end)) < today;
  }
  return false;
}
function isSittingPast(s: SittingRequest, now: Date = new Date()): boolean {
  return startOfDayMs(parseLocalDate(s.end_date || s.start_date)) < startOfDayMs(now);
}

function transportWhen(r: TransportRequest): string {
  if (r.schedule_type === 'asap') return 'ASAP';
  if (r.schedule_type === 'coordinate_later') return 'Date TBD';
  if (r.schedule_type === 'flexible') {
    return r.preferred_window_start ?
    `Flexible · from ${fmtDay(parseLocalDate(r.preferred_window_start))}` :
    'Flexible';
  }
  if (!r.requested_pickup_time) return 'No time set';
  const d = new Date(r.requested_pickup_time);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmtDay(d)} · ${time}`;
}
function transportSortTs(r: TransportRequest): number {
  if (r.schedule_type === 'exact' && r.requested_pickup_time) {
    return new Date(r.requested_pickup_time).getTime();
  }
  if (r.schedule_type === 'flexible' && r.preferred_window_start) {
    return parseLocalDate(r.preferred_window_start).getTime();
  }
  return UNDATED;
}

// "Help Needed" — a unified, soonest-first list of requests across types that
// still need someone: unclaimed transport, open sitting, and submitted supply
// requests. Renders nothing when everything is covered, so the Dashboard stays
// calm. Reads only collections the Dashboard already loads.
export function HelpNeededWidget() {
  const {
    transportRequests,
    transportRequestAnimals,
    sittingRequests,
    sittingRequestPlacements,
    supplyRequests,
    animalsIndex,
    peopleIndex,
    placements
  } = useWhisker();
  // Supply requests are only shown to people who can fulfill them.
  const canFulfillSupply = useCanManageSupplyRequests();

  const animalName = (id?: string | null) => {
    if (!id) return undefined;
    const a = animalsIndex.find((x) => x.id === id);
    return a ? animalDisplayName(a) : undefined;
  };
  // Comma-joined names of the animals on a transport (undefined when none).
  const transportAnimalNames = (transportId: string): string | undefined => {
    const names = transportRequestAnimals.
    filter((ta) => ta.transport_request_id === transportId).
    map((ta) => animalName(ta.animal_id)).
    filter((n): n is string => !!n);
    return names.length > 0 ? names.join(', ') : undefined;
  };
  const personName = (id?: string | null) => {
    if (!id) return 'Unknown';
    const p = peopleIndex.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
  };

  const transportItems: HelpItem[] = transportRequests.
  filter(
    (r) =>
    !r.assigned_volunteer_person_id &&
    r.status !== 'completed' &&
    r.status !== 'cancelled' &&
    r.status !== 'expired' &&
    !isTransportPastNeeded(r)
  ).
  map((r) => ({
    id: `transport-${r.id}`,
    typeLabel: 'Transport Needed',
    icon: TruckIcon,
    subject: `${
    transportAnimalNames(r.id) ?? (
    r.type === 'supplies' ? 'Supply drop' : 'Transport')
    } → ${r.dropoff_location || 'Destination TBD'}`,
    detail: transportWhen(r),
    statusLabel: 'Unclaimed',
    pill: PILL_UNCLAIMED,
    to: '/requests?tab=transport',
    sortTs: transportSortTs(r)
  }));

  const sittingAnimalNames = (requestId: string): string => {
    const names = sittingRequestPlacements.
    filter((srp) => srp.sitting_request_id === requestId).
    map((srp) => placements.find((p) => p.id === srp.foster_placement_id)).
    map((p) => p && animalName(p.animal_id)).
    filter((n): n is string => Boolean(n));
    return names.length ? names.join(', ') : 'Sitting request';
  };
  const sittingItems: HelpItem[] = sittingRequests.
  filter((s) => s.status === 'open' && !isSittingPast(s)).
  map((s) => ({
    id: `sitting-${s.id}`,
    typeLabel: 'Sitter Needed',
    icon: HeartHandshakeIcon,
    subject: sittingAnimalNames(s.id),
    detail: `${fmtDay(parseLocalDate(s.start_date))} – ${
    s.end_date ? fmtDay(parseLocalDate(s.end_date)) : 'open'
    }`,
    statusLabel: 'Unclaimed',
    pill: PILL_UNCLAIMED,
    to: '/requests?tab=sitting',
    sortTs: parseLocalDate(s.start_date).getTime()
  }));

  const supplyItems: HelpItem[] = (canFulfillSupply ? supplyRequests : []).
  filter((r) => r.status === 'submitted').
  map((r) => ({
    id: `supply-${r.id}`,
    typeLabel: 'Supply Needed',
    icon: PackageIcon,
    subject: animalName(r.requested_for_animal_id) ?? 'Supply request',
    detail: `Requested by ${personName(r.requester_person_id)}`,
    statusLabel: 'Submitted',
    pill: PILL_SUBMITTED,
    to: '/requests',
    sortTs: r.needed_by_date ?
    parseLocalDate(r.needed_by_date).getTime() :
    r.requested_date ?
    parseLocalDate(r.requested_date).getTime() :
    UNDATED
  }));

  const all = [...transportItems, ...sittingItems, ...supplyItems].sort(
    (a, b) => a.sortTs - b.sortTs
  );
  if (all.length === 0) return null;
  const shown = all.slice(0, HELP_LIMIT);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-bold flex items-center gap-2">
          <HandHelpingIcon className="w-5 h-5 text-primary" />
          Help Needed
        </h2>
      </div>
      <Card>
        <div className="divide-y divide-border">
          {shown.map((item) =>
          <Link
            key={item.id}
            to={item.to}
            className="flex items-center justify-between gap-3 p-4 hover:bg-background transition-colors group">

              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-background flex items-center justify-center text-text-secondary shrink-0">
                  <item.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {item.typeLabel}
                  </p>
                  <p className="font-medium text-text-primary truncate">
                    {item.subject}
                  </p>
                  {item.detail &&
                <p className="text-sm text-text-secondary truncate">
                      {item.detail}
                    </p>
                }
                </div>
              </div>
              <span
              className={cn(
                'shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                item.pill
              )}>

                {item.statusLabel}
              </span>
            </Link>
          )}
        </div>
        {all.length > shown.length &&
        <Link
          to="/requests"
          className="flex items-center justify-center gap-1.5 p-3 border-t border-border text-sm font-medium text-primary hover:bg-background transition-colors">

            View all requests
            <ChevronRightIcon className="w-4 h-4" />
          </Link>
        }
      </Card>
    </div>);

}
