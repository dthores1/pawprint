import { Fragment, useEffect, useState } from 'react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NewTransportRequestModal } from '../transports/NewTransportRequestModal';
import { AssignTransportModal } from '../transports/AssignTransportModal';
import { useIsAdmin } from '../../lib/useIsAdmin';
import {
  TruckIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  MapPinIcon,
  CalendarIcon,
  UserIcon,
  PencilIcon,
  XIcon,
  ExternalLinkIcon,
  Trash2Icon } from
'lucide-react';
import { PillTabs } from '../ui/PillTabs';
import { FilterDropdown } from '../ui/FilterDropdown';
import { VirtualizedGrid } from '../ui/VirtualizedGrid';
import { cn, formatDate } from '../../lib/utils';
import { cancelRequestConfirm } from '../../lib/requestCopy';
import { useAuth } from '../../context/AuthContext';
import {
  TransportRequest,
  TransportRequestStatus,
  TransportRequestType,
  TransportRequestUrgency } from
'../../types';
import {
  effectiveStatus,
  transportStaleInfo,
  TRANSPORT_STALE_LABEL,
  transportStaleTooltip } from
'../../lib/transportTiming';
import { isResolvedAddress } from '../../lib/address';
import { ArchiveConfirmDialog } from '../archive/ArchiveConfirmDialog';
import { useCanArchive } from '../archive/useCanArchive';

const TRANSPORT_ARCHIVABLE: TransportRequestStatus[] = ['completed', 'cancelled'];

const STATUS_LABEL: Record<TransportRequestStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  accepted: 'Accepted',
  claimed: 'Claimed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired'
};
const STATUS_PILL: Record<TransportRequestStatus, string> = {
  // Blue (not amber) so "Open" doesn't compete with the amber warning pills
  // (Urgent / Needs Address / Awaiting Review). Green is reserved for done states.
  open: 'bg-[#E3E4F2] text-[#525694]',
  assigned: 'bg-[#DCEAF7] text-[#356A9A]',
  accepted: 'bg-[#DDEFE2] text-[#3E7B52]',
  claimed: 'bg-[#DCEAF7] text-[#356A9A]',
  in_progress: 'bg-[#E8DEEC] text-[#6E4E80]',
  completed: 'bg-[#DDEFE2] text-[#3E7B52]',
  cancelled: 'bg-[#F5D7D7] text-[#9B3A3A]',
  expired: 'bg-[#F5D7D7] text-[#9B3A3A]'
};
const URGENCY_RANK: Record<TransportRequestUrgency, number> = {
  critical: 3,
  urgent: 2,
  normal: 1
};
// Human label for the request's timing, by schedule type.
function timingLabel(r: TransportRequest): string {
  if (r.schedule_type === 'asap') return 'ASAP';
  if (r.schedule_type === 'coordinate_later') return 'Coordinate later';
  if (r.schedule_type === 'flexible') {
    if (r.preferred_window_start && r.preferred_window_end) {
      return `Flexible · ${formatDate(r.preferred_window_start)} – ${formatDate(
        r.preferred_window_end
      )}`;
    }
    if (r.preferred_window_start) {
      return `Flexible · from ${formatDate(r.preferred_window_start)}`;
    }
    return 'Flexible';
  }
  return r.requested_pickup_time ?
  formatPickupTime(r.requested_pickup_time) :
  'No time set';
}
// Sort key: ASAP floats to top, then soonest exact/flexible date, else created.
function timingSortValue(r: TransportRequest): number {
  if (r.schedule_type === 'asap') return -Infinity;
  if (r.schedule_type === 'exact' && r.requested_pickup_time) {
    return new Date(r.requested_pickup_time).getTime();
  }
  if (r.schedule_type === 'flexible' && r.preferred_window_start) {
    return new Date(r.preferred_window_start).getTime();
  }
  return new Date(r.created_at).getTime();
}
const TYPE_LABEL: Record<TransportRequestType, string> = {
  animal: 'Animal',
  supplies: 'Supplies',
  emergency: 'Emergency'
};
const URGENCY_PILL: Record<TransportRequestUrgency, string> = {
  normal: '',
  urgent: 'bg-[#F8E7C8] text-[#A36B00]',
  critical: 'bg-[#F5D7D7] text-[#9B3A3A]'
};

// Friendly pickup time — "Today @ 9:00 AM", "Tomorrow @ 3:30 PM",
// "Mon · 9:00 AM" within a week, else "May 25 · 9:00 AM".
function formatPickupTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  const now = new Date();
  const startOfDay = (x: Date) =>
  new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(d) - startOfDay(now)) / (1000 * 60 * 60 * 24)
  );
  if (dayDiff === 0) return `Today @ ${time}`;
  if (dayDiff === 1) return `Tomorrow @ ${time}`;
  if (dayDiff === -1) return `Yesterday @ ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    return `${d.toLocaleString('en-US', { weekday: 'short' })} · ${time}`;
  }
  return `${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

// Subtabs are organized around "what's there for me to do?" rather than raw
// status: my active assignments, the unclaimed pool, everything assigned, and
// the terminal archive.
type TransportTab = 'mine' | 'unclaimed' | 'assigned' | 'completed';

const DATE_OPTIONS = [
{ value: 'all', label: 'Any Date' },
{ value: 'today', label: 'Today' },
{ value: 'tomorrow', label: 'Tomorrow' },
{ value: 'this_week', label: 'This Week' },
{ value: 'next_week', label: 'Next Week' },
{ value: 'past_due', label: 'Past Due' }];


function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
// Week starts Sunday (US convention), to match how rescues read a calendar.
function startOfWeekSunday(d: Date): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}
// The local date a transport is "needed", for date bucketing. Exact → its pickup
// day; flexible → its window start; asap / coordinate_later / undated → null
// (those only match "Any Date").
function requestRepDate(r: TransportRequest): Date | null {
  if (r.schedule_type === 'exact' && r.requested_pickup_time) {
    return new Date(r.requested_pickup_time);
  }
  if (r.schedule_type === 'flexible' && r.preferred_window_start) {
    return new Date(`${r.preferred_window_start}T00:00:00`);
  }
  return null;
}
// Past due = the moment it was needed has elapsed. Exact → pickup time passed;
// flexible → end of its window day passed. Open-ended types are never past due.
function isTransportPastDue(r: TransportRequest, now: Date): boolean {
  if (r.schedule_type === 'exact' && r.requested_pickup_time) {
    return new Date(r.requested_pickup_time).getTime() < now.getTime();
  }
  if (r.schedule_type === 'flexible') {
    const end = r.preferred_window_end ?? r.preferred_window_start;
    if (end) return new Date(`${end}T23:59:59`).getTime() < now.getTime();
  }
  return false;
}
function matchesDateFilter(
r: TransportRequest,
filter: string,
now: Date = new Date())
: boolean {
  if (filter === 'all') return true;
  if (filter === 'past_due') return isTransportPastDue(r, now);
  const rep = requestRepDate(r);
  if (!rep) return false; // undated requests only match "Any Date"
  const DAY = 86400000;
  const repDay = startOfDay(rep).getTime();
  const today = startOfDay(now).getTime();
  if (filter === 'today') return repDay === today;
  if (filter === 'tomorrow') return repDay === today + DAY;
  if (filter === 'this_week') {
    const ws = startOfWeekSunday(now).getTime();
    return repDay >= ws && repDay < ws + 7 * DAY;
  }
  if (filter === 'next_week') {
    const ws = startOfWeekSunday(now).getTime() + 7 * DAY;
    return repDay >= ws && repDay < ws + 7 * DAY;
  }
  return true;
}

export function TransportsView() {
  const {
    transportRequests,
    transportRequestAnimals,
    peopleIndex: people,
    animalsIndex: animals,
    savedLocations,
    claimTransportRequest,
    acceptTransportRequest,
    unassignTransportRequest,
    completeTransportRequest,
    updateTransportRequest,
    transportHistoryLoaded,
    ensureTransportHistoryLoaded
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<TransportRequest | null>(null);
  const [assigning, setAssigning] = useState<TransportRequest | null>(null);
  // null = no explicit choice yet → fall back to the data-driven default below.
  const [selectedTab, setSelectedTab] = useState<TransportTab | null>(null);
  const [archiving, setArchiving] = useState<TransportRequest | null>(null);
  const [requesterFilter, setRequesterFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const isAdminForArchive = useCanArchive('transport_requests', { id: 'na' });

  const savedLocName = (id?: string | null) =>
  id ? savedLocations.find((l) => l.id === id)?.name : undefined;
  // A leg is resolved if it links a saved location or has a real (non-free-text)
  // address; a request "needs address" if either leg is unresolved.
  const needsAddress = (r: TransportRequest) =>
  !(r.pickup_saved_location_id || isResolvedAddress(r.pickup_address)) ||
  !(r.dropoff_saved_location_id || isResolvedAddress(r.dropoff_address));

  const personName = (id?: string | null) => {
    if (!id) return 'Unknown';
    const p = people.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
  };

  // Urgent/ASAP first, then soonest timing.
  const sorted = [...transportRequests].sort((a, b) => {
    const u = URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency];
    if (u !== 0) return u;
    return timingSortValue(a) - timingSortValue(b);
  });

  // Buckets key off who owns the request (assignee) + whether it's terminal —
  // "what's there for me to do?" rather than raw status. Past-due requests stay
  // in Unclaimed / Assigned and are surfaced via the Past Due date filter.
  const isTerminal = (r: TransportRequest) =>
  r.status === 'completed' || r.status === 'cancelled';
  const buckets: Record<TransportTab, TransportRequest[]> = {
    mine: sorted.filter(
      (r) =>
      !!currentPersonId &&
      r.assigned_volunteer_person_id === currentPersonId &&
      !isTerminal(r)
    ),
    unclaimed: sorted.filter(
      (r) => !r.assigned_volunteer_person_id && !isTerminal(r)
    ),
    assigned: sorted.filter(
      (r) => !!r.assigned_volunteer_person_id && !isTerminal(r)
    ),
    completed: sorted.filter(isTerminal)
  };

  // Default to "Assigned to Me" when the user has active assignments, else
  // "Unclaimed". An explicit tab click (selectedTab) overrides this.
  const defaultTab: TransportTab =
  buckets.mine.length > 0 ? 'mine' : 'unclaimed';
  const activeTab = selectedTab ?? defaultTab;

  // Closed transports aren't loaded upfront — pull them in when the Completed
  // tab opens (idempotent). Until then the Completed bucket is empty.
  useEffect(() => {
    if (activeTab === 'completed') ensureTransportHistoryLoaded();
  }, [activeTab, ensureTransportHistoryLoaded]);

  // Filter option lists, derived from the full request set so they're stable
  // across tabs. Each lists only the people who actually appear.
  const requesterOptions = [
  { value: 'all', label: 'All Requesters' },
  ...Array.from(
    new Set(
      transportRequests.
      map((r) => r.requested_by_person_id).
      filter((v): v is string => Boolean(v))
    )
  ).
  map((id) => ({ value: id, label: personName(id) })).
  sort((a, b) => a.label.localeCompare(b.label))];

  const assigneeOptions = [
  { value: 'all', label: 'All Assignees' },
  ...Array.from(
    new Set(
      transportRequests.
      map((r) => r.assigned_volunteer_person_id).
      filter((v): v is string => Boolean(v))
    )
  ).
  map((id) => ({ value: id, label: personName(id) })).
  sort((a, b) => a.label.localeCompare(b.label))];

  // The Assignee filter only makes sense where requests can have an assignee:
  // "Assigned to Me" is all me, and "Unclaimed" has none by definition — so it's
  // shown only on "Assigned" and "Completed", and ignored when bucketing.
  const showAssigneeFilter =
  activeTab === 'assigned' || activeTab === 'completed';
  const filtersActive =
  requesterFilter !== 'all' ||
  showAssigneeFilter && assigneeFilter !== 'all' ||
  dateFilter !== 'all';

  const display = buckets[activeTab].filter(
    (r) =>
    (requesterFilter === 'all' ||
    r.requested_by_person_id === requesterFilter) && (
    !showAssigneeFilter ||
    assigneeFilter === 'all' ||
    r.assigned_volunteer_person_id === assigneeFilter) &&
    matchesDateFilter(r, dateFilter)
  );

  return (
    <div className="space-y-6">
      <PillTabs
        value={activeTab}
        onChange={(k) => setSelectedTab(k as TransportTab)}
        tabs={[
        { key: 'mine', label: `Assigned to Me (${buckets.mine.length})` },
        { key: 'unclaimed', label: `Unclaimed (${buckets.unclaimed.length})` },
        { key: 'assigned', label: `Assigned (${buckets.assigned.length})` },
        {
          key: 'completed',
          // Count is unknown until the deferred history loads, so omit it
          // until then rather than showing a misleading "(0)".
          label: transportHistoryLoaded ?
          `Completed (${buckets.completed.length})` :
          'Completed'
        }]} />

      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Requester"
          value={requesterFilter}
          options={requesterOptions}
          onChange={setRequesterFilter} />

        {showAssigneeFilter &&
        <FilterDropdown
          label="Assignee"
          value={assigneeFilter}
          options={assigneeOptions}
          onChange={setAssigneeFilter} />
        }
        <FilterDropdown
          label="Date"
          value={dateFilter}
          options={DATE_OPTIONS}
          onChange={setDateFilter} />

      </div>

      {activeTab === 'completed' && !transportHistoryLoaded ?
      <Card className="p-10 text-center text-text-secondary">
          <p>Loading history…</p>
        </Card> :
      display.length === 0 ?
      <Card className="p-10 text-center text-text-secondary">
          <TruckIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            {filtersActive ? 'No matching requests' : 'Nothing to see here'}
          </p>
          <p className="text-sm">
            {filtersActive ?
          'No requests match the current filters.' :
          activeTab === 'mine' ?
          'Nothing is assigned to you right now.' :
          activeTab === 'unclaimed' ?
          'No unclaimed requests — submit one when someone needs a ride.' :
          activeTab === 'assigned' ?
          'No active assigned rides at the moment.' :
          'No completed transports yet.'}
          </p>
        </Card> :

      <VirtualizedGrid
        items={display}
        columns={1}
        gap={12}
        estimateRowHeight={220}
        getKey={(r) => r.id}
        renderItem={(r) =>
        <TransportCard
          request={r}
          animalNames={transportRequestAnimals.
          filter((ta) => ta.transport_request_id === r.id).
          map((ta) => animals.find((a) => a.id === ta.animal_id)?.name).
          filter((n): n is string => !!n)}
          requesterName={(() => {
            const p = people.find((p) => p.id === r.requested_by_person_id);
            return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
          })()}
          assigneeName={(() => {
            if (!r.assigned_volunteer_person_id) return undefined;
            const p = people.find(
              (p) => p.id === r.assigned_volunteer_person_id
            );
            return p ? `${p.first_name} ${p.last_name}` : undefined;
          })()}
          dropoffLabel={savedLocName(r.dropoff_saved_location_id)}
          needsAddress={needsAddress(r)}
          canClaim={
          !!currentPersonId &&
          effectiveStatus(r) === 'open' &&
          r.requested_by_person_id !== currentPersonId
          }
          onClaim={() =>
          currentPersonId &&
          claimTransportRequest(r.id, currentPersonId)
          }
          canAssign={isAdmin && effectiveStatus(r) === 'open'}
          onAssign={() => setAssigning(r)}
          canRespond={
          !!currentPersonId &&
          r.status === 'assigned' &&
          r.assigned_volunteer_person_id === currentPersonId
          }
          onAccept={() => acceptTransportRequest(r.id)}
          onDecline={() => unassignTransportRequest(r.id)}
          canReassign={
          isAdmin &&
          (r.status === 'assigned' ||
          r.status === 'accepted' ||
          r.status === 'claimed')
          }
          onReassign={() => setAssigning(r)}
          onRemoveAssignment={() => unassignTransportRequest(r.id)}
          canComplete={
          !!currentPersonId &&
          (r.requested_by_person_id === currentPersonId ||
          r.assigned_volunteer_person_id === currentPersonId ||
          isAdmin) &&
          // Only once it's committed (accepted/claimed/in progress) or it's
          // past due. NOT while 'assigned' — that's awaiting the volunteer's
          // Accept, so completing it then would skip the acceptance step.
          (r.status === 'accepted' ||
          r.status === 'claimed' ||
          r.status === 'in_progress' ||
          (r.status !== 'assigned' &&
          r.status !== 'completed' &&
          r.status !== 'cancelled' &&
          transportStaleInfo(r) !== null))
          }
          onComplete={() => completeTransportRequest(r.id)}
          canCancel={
          !!currentPersonId &&
          r.requested_by_person_id === currentPersonId &&
          r.status !== 'completed' &&
          r.status !== 'cancelled'
          }
          onCancel={() =>
          updateTransportRequest(r.id, { status: 'cancelled' })
          }
          canEdit={
          !!currentPersonId &&
          r.requested_by_person_id === currentPersonId &&
          (effectiveStatus(r) === 'open' || effectiveStatus(r) === 'expired')
          }
          onEdit={() => setEditing(r)}
          canArchive={
          isAdminForArchive && TRANSPORT_ARCHIVABLE.includes(r.status)
          }
          onArchive={() => setArchiving(r)} />
        } />

      }

      {editing &&
      <NewTransportRequestModal
        isOpen={true}
        onClose={() => setEditing(null)}
        request={editing} />

      }

      {assigning &&
      <AssignTransportModal
        isOpen={true}
        onClose={() => setAssigning(null)}
        request={assigning} />

      }

      {archiving &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchiving(null)}
        table="transport_requests"
        id={archiving.id}
        typeLabel="transport request"
        entityLabel={`${archiving.pickup_location} → ${archiving.dropoff_location}`} />

      }
    </div>);

}

interface TransportCardProps {
  request: TransportRequest;
  animalNames?: string[];
  requesterName: string;
  assigneeName?: string;
  /** Saved-location friendly names, when a leg was picked from the catalog. */
  dropoffLabel?: string;
  /** Either leg is free-text-only (no address / saved location). */
  needsAddress: boolean;
  canClaim: boolean;
  onClaim: () => void;
  /** Admin may direct this open request to a specific volunteer. */
  canAssign: boolean;
  onAssign: () => void;
  /** Viewer is the assigned volunteer on an awaiting-response request. */
  canRespond: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /** Admin may reassign / remove the assignment on an active request. */
  canReassign: boolean;
  onReassign: () => void;
  onRemoveAssignment: () => void;
  /** Confirm the transport happened (requester / assignee / admin). */
  canComplete: boolean;
  onComplete: () => void;
  canCancel: boolean;
  onCancel: () => void;
  canEdit: boolean;
  onEdit: () => void;
  canArchive: boolean;
  onArchive: () => void;
}
function TransportCard({
  request,
  animalNames,
  requesterName,
  assigneeName,
  dropoffLabel,
  needsAddress,
  canClaim,
  onClaim,
  canAssign,
  onAssign,
  canRespond,
  onAccept,
  onDecline,
  canReassign,
  onReassign,
  onRemoveAssignment,
  canComplete,
  onComplete,
  canCancel,
  onCancel,
  canEdit,
  onEdit,
  canArchive,
  onArchive
}: TransportCardProps) {
  const subject =
  (animalNames && animalNames.length > 0 ? animalNames.join(', ') : null) || (
  request.type === 'supplies' ?
  'Supply drop' :
  TYPE_LABEL[request.type]);
  // Title shows the destination's friendly shorthand when it's a saved location,
  // else the address text. The full addresses move to the map-pin row below.
  const dropoffTitle = dropoffLabel ?? request.dropoff_location;
  // The map-pin row links to a Google Maps route (full pickup → dropoff), using
  // the structured formatted address when present, else the legacy single-line.
  const mapsOrigin = request.pickup_address?.formatted || request.pickup_location;
  const mapsDest =
  request.dropoff_address?.formatted || request.dropoff_location;
  const mapsHref =
  mapsOrigin && mapsDest ?
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      mapsOrigin
    )}&destination=${encodeURIComponent(mapsDest)}` :
  null;
  // All confirmations route through one ConfirmDialog (polished, on-brand) —
  // no more window.confirm. `confirm` selects which prompt is open.
  const [confirm, setConfirm] = useState<
    null | 'complete' | 'cancel' | 'decline' | 'remove'>(
    null);
  const confirmProps = {
    complete: {
      title: 'Mark transport complete?',
      body: 'Only do this once the transport has actually happened — it records the request as completed.',
      confirmLabel: 'Mark Complete',
      cancelLabel: 'Cancel',
      tone: 'default' as const,
      onConfirm: onComplete
    },
    cancel: { ...cancelRequestConfirm('transport request'), onConfirm: onCancel },
    decline: {
      title: 'Decline this transport?',
      body: 'It will return to the open pool for others to claim.',
      confirmLabel: 'Decline',
      cancelLabel: 'Never mind',
      tone: 'danger' as const,
      onConfirm: onDecline
    },
    remove: {
      title: 'Remove assignment?',
      body: 'This volunteer’s assignment will be removed and the request returns to the open pool.',
      confirmLabel: 'Remove',
      cancelLabel: 'Never mind',
      tone: 'danger' as const,
      onConfirm: onRemoveAssignment
    }
  };
  const activeConfirm = confirm ? confirmProps[confirm] : null;
  return (
    <>
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-lg font-heading font-bold text-text-primary truncate min-w-0">
              {subject} to {dropoffTitle}
            </h3>
            {request.urgency !== 'normal' &&
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
                URGENCY_PILL[request.urgency]
              )}>

                <AlertCircleIcon className="w-3 h-3" />
                {request.urgency}
              </span>
            }
            {needsAddress &&
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#F8E7C8] text-[#A36B00]">
                <AlertCircleIcon className="w-3 h-3" />
                Needs address
              </span>
            }
          </div>
          {/* Full pickup → dropoff addresses (the friendly shorthand is in the
              title above). The row links to a Google Maps route; the external-link
              icon reveals on hover. Inline on sm+, stacked on phones. */}
          {(() => {
            const rowCls =
            'text-sm text-text-secondary mt-1 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 min-w-0';
            // Plain text (not AddressDisplay) because the whole row is already a
            // Maps link — AddressDisplay renders its own <a> and would nest.
            const legs =
            <>
              <span className="flex items-center gap-1.5 min-w-0 max-w-full">
                <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-text-primary truncate min-w-0">
                  {request.pickup_address?.formatted || request.pickup_location}
                </span>
              </span>
              <span className="flex items-center gap-1.5 min-w-0 max-w-full">
                <ArrowRightIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-text-primary truncate min-w-0">
                  {request.dropoff_address?.formatted ||
                  request.dropoff_location}
                </span>
                {mapsHref &&
                <ExternalLinkIcon className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover/maps:opacity-100 transition-opacity" />
                }
              </span>
            </>;

            return mapsHref ?
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              title="Open route in Google Maps"
              className={cn(rowCls, 'group/maps hover:text-primary')}>

                {legs}
              </a> :

            <div className={rowCls}>{legs}</div>;

          })()}
          <div className="mt-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border border-border text-xs font-medium text-text-primary">
              <CalendarIcon className="w-3.5 h-3.5 text-text-secondary shrink-0" />
              {timingLabel(request)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 shrink-0" />
              <span>
                Requested by {requesterName}
                {assigneeName &&
                <>
                    {' '}·{' '}
                    {request.status === 'assigned' || request.status === 'accepted' ?
                  'Assigned to' :
                  'Claimed by'}{' '}
                    <span className="text-text-primary font-medium">{assigneeName}</span>
                  </>
                }
              </span>
            </span>
          </div>
          {request.notes &&
          <p className="text-sm text-text-secondary mt-1 italic">
              {request.notes}
            </p>
          }
        </div>

        <div className="flex sm:flex-col items-start sm:items-end gap-2 shrink-0">
          {(() => {
            // One status indicator: when the request is stale, the badge IS the
            // status (Past Due red / Awaiting Review amber) — no separate
            // "Expired" pill. Otherwise show the normal claim-state pill (never
            // "Expired"; that meaning is carried by the badge).
            const stale = transportStaleInfo(request);
            if (stale) {
              const cls =
              stale.kind === 'past_due' ?
              'bg-[#F5D7D7] text-[#9B3A3A]' : // red — the weight "Expired" had
              'bg-[#F8E7C8] text-[#A36B00]'; // amber — softer "needs confirmation"
              return (
                <Tooltip content={transportStaleTooltip(stale)}>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide cursor-help',
                      cls
                    )}>

                    <AlertTriangleIcon className="w-3 h-3" />
                    {TRANSPORT_STALE_LABEL[stale.kind]} · {stale.days}D
                  </span>
                </Tooltip>);

            }
            const eff = effectiveStatus(request);
            const disp = eff === 'expired' ? 'open' : eff;
            return (
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  STATUS_PILL[disp]
                )}>

                {STATUS_LABEL[disp]}
              </span>);

          })()}
          {/* Actions sit vertically centered in the card (status stays at top). */}
          <div className="sm:flex-1 sm:flex sm:items-center">
          {(() => {
            const linkBase =
            'text-sm font-medium hover:underline transition-colors';
            const iconBtn =
            'p-1 -m-1 rounded-md transition-colors text-text-secondary';
            // "Verb" actions stay as text links; Edit/Cancel/Archive become
            // compact controls. Mark Complete is a button (the primary action).
            const verbs: JSX.Element[] = [];
            if (canClaim)
            verbs.push(
              <button
                key="claim"
                type="button"
                onClick={onClaim}
                className={cn(linkBase, 'text-primary')}>
                Claim Request
              </button>
            );
            if (canAssign)
            verbs.push(
              <button
                key="assign"
                type="button"
                onClick={onAssign}
                className={cn(linkBase, 'text-primary')}>
                Assign…
              </button>
            );
            if (canRespond) {
              verbs.push(
                <button
                  key="accept"
                  type="button"
                  onClick={onAccept}
                  className={cn(linkBase, 'text-[#3E7B52]')}>
                  Accept
                </button>
              );
              verbs.push(
                <button
                  key="decline"
                  type="button"
                  onClick={() => setConfirm('decline')}
                  className={cn(linkBase, 'text-text-secondary hover:text-[#9B3A3A]')}>
                  Decline
                </button>
              );
            }
            if (canReassign) {
              verbs.push(
                <button
                  key="reassign"
                  type="button"
                  onClick={onReassign}
                  className={cn(linkBase, 'text-text-secondary hover:text-text-primary')}>
                  Reassign…
                </button>
              );
              verbs.push(
                <button
                  key="remove-assignment"
                  type="button"
                  onClick={() => setConfirm('remove')}
                  className={cn(linkBase, 'text-text-secondary hover:text-[#9B3A3A]')}>
                  Remove
                </button>
              );
            }
            const hasIconRow = canEdit || canCancel || canArchive;
            if (!canComplete && verbs.length === 0 && !hasIconRow) return null;
            return (
              <div className="flex flex-col sm:items-end gap-1.5">
                {canComplete &&
                <Button
                  variant="soft"
                  size="xs"
                  onClick={() => setConfirm('complete')}>

                    Mark Complete
                  </Button>
                }
                {(verbs.length > 0 || hasIconRow) &&
                <div className="flex items-center gap-2.5">
                    {verbs.map((node, i) =>
                  <Fragment key={i}>
                        {i > 0 &&
                    <span className="text-text-secondary/40" aria-hidden="true">·</span>
                    }
                        {node}
                      </Fragment>
                  )}
                    {verbs.length > 0 && hasIconRow &&
                  <span className="text-text-secondary/40" aria-hidden="true">·</span>
                  }
                    {canEdit &&
                  <Tooltip content="Edit request">
                        <button
                      type="button"
                      onClick={onEdit}
                      aria-label="Edit request"
                      className={cn(iconBtn, 'hover:text-text-primary hover:bg-background')}>

                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </Tooltip>
                  }
                    {canCancel &&
                  <button
                    type="button"
                    onClick={() => setConfirm('cancel')}
                    className={cn(
                      linkBase,
                      'inline-flex items-center gap-1 text-text-secondary hover:text-[#9B3A3A]'
                    )}>

                        <XIcon className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                  }
                    {canArchive &&
                  <Tooltip content="Archive request">
                        <button
                      type="button"
                      onClick={onArchive}
                      aria-label="Archive request"
                      className={cn(iconBtn, 'hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60')}>

                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </Tooltip>
                  }
                  </div>
                }
              </div>);

          })()}
          </div>
        </div>
      </div>
    </Card>

    {activeConfirm &&
    <ConfirmDialog
      isOpen={true}
      onClose={() => setConfirm(null)}
      onConfirm={activeConfirm.onConfirm}
      title={activeConfirm.title}
      confirmLabel={activeConfirm.confirmLabel}
      cancelLabel={activeConfirm.cancelLabel}
      tone={activeConfirm.tone}>

        {activeConfirm.body}
      </ConfirmDialog>
    }
    </>);

}
