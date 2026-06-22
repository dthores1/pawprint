import { Fragment, useState } from 'react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { NewTransportRequestModal } from '../transports/NewTransportRequestModal';
import { AssignTransportModal } from '../transports/AssignTransportModal';
import { useIsAdmin } from '../../lib/useIsAdmin';
import {
  TruckIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  MapPinIcon,
  CalendarIcon,
  UserIcon } from
'lucide-react';
import { AddressDisplay } from '../ui/AddressDisplay';
import { PillTabs } from '../ui/PillTabs';
import { FilterDropdown } from '../ui/FilterDropdown';
import { cn, formatDate } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import {
  TransportRequest,
  TransportRequestStatus,
  TransportRequestType,
  TransportRequestUrgency } from
'../../types';
import { effectiveStatus } from '../../lib/transportTiming';
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
  open: 'bg-[#F8E7C8] text-[#A36B00]',
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
    peopleIndex: people,
    animalsIndex: animals,
    savedLocations,
    claimTransportRequest,
    acceptTransportRequest,
    unassignTransportRequest,
    updateTransportRequest
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
          label: `Completed (${buckets.completed.length})`
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

      {display.length === 0 ?
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

      <div className="space-y-3">
          {display.map((r) =>
        <TransportCard
          key={r.id}
          request={r}
          animalName={
          r.animal_id ?
          animals.find((a) => a.id === r.animal_id)?.name :
          undefined
          }
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
          pickupLabel={savedLocName(r.pickup_saved_location_id)}
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

        )}
        </div>
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
  animalName?: string;
  requesterName: string;
  assigneeName?: string;
  /** Saved-location friendly names, when a leg was picked from the catalog. */
  pickupLabel?: string;
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
  canCancel: boolean;
  onCancel: () => void;
  canEdit: boolean;
  onEdit: () => void;
  canArchive: boolean;
  onArchive: () => void;
}
function TransportCard({
  request,
  animalName,
  requesterName,
  assigneeName,
  pickupLabel,
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
  canCancel,
  onCancel,
  canEdit,
  onEdit,
  canArchive,
  onArchive
}: TransportCardProps) {
  const subject =
  animalName ||
  (request.type === 'supplies' ?
  'Supply drop' :
  TYPE_LABEL[request.type]);
  const handleCancel = () => {
    if (
    window.confirm(
      'Cancel this transport request? It will be marked as cancelled for everyone.'
    ))
    {
      onCancel();
    }
  };
  const handleDecline = () => {
    if (
    window.confirm(
      'Decline this transport? It will return to the open pool for others to claim.'
    ))
    {
      onDecline();
    }
  };
  const handleRemoveAssignment = () => {
    if (
    window.confirm(
      'Remove this volunteer’s assignment? The request returns to the open pool.'
    ))
    {
      onRemoveAssignment();
    }
  };
  return (
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-lg font-heading font-bold text-text-primary flex items-center gap-2 min-w-0">
              <span className="truncate">{subject}</span>
              <ArrowRightIcon className="w-4 h-4 text-text-secondary shrink-0" />
              <span className="truncate">{request.dropoff_location}</span>
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
          {/* Pickup → dropoff. Inline on sm+, stacked on phones so the two
              addresses never collide. Each leg gets its own truncating slot. */}
          <div className="text-sm text-text-secondary mt-1 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 min-w-0">
            <span className="flex items-center gap-1.5 min-w-0 max-w-full">
              <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
              {pickupLabel ?
              <span className="text-text-primary truncate min-w-0">{pickupLabel}</span> :
              <AddressDisplay
                value={request.pickup_address ?? null}
                singleLine
                className="text-text-primary min-w-0" />
              }
            </span>
            <span className="flex items-center gap-1.5 min-w-0 max-w-full">
              <ArrowRightIcon className="w-3.5 h-3.5 shrink-0" />
              {dropoffLabel ?
              <span className="text-text-primary truncate min-w-0">{dropoffLabel}</span> :
              <AddressDisplay
                value={request.dropoff_address ?? null}
                singleLine
                className="text-text-primary min-w-0" />
              }
            </span>
          </div>
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
            const eff = effectiveStatus(request);
            return (
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  STATUS_PILL[eff]
                )}>

                {STATUS_LABEL[eff]}
              </span>);

          })()}
          {(() => {
            // Compact inline actions: "Claim · Edit · Cancel · Archive" (only
            // those that apply), separated by dots, to keep the card short.
            const linkBase =
            'text-sm font-medium hover:underline transition-colors';
            const actions: JSX.Element[] = [];
            if (canClaim)
            actions.push(
              <button
                key="claim"
                type="button"
                onClick={onClaim}
                className={cn(linkBase, 'text-primary')}>
                Claim Request
              </button>
            );
            if (canAssign)
            actions.push(
              <button
                key="assign"
                type="button"
                onClick={onAssign}
                className={cn(linkBase, 'text-primary')}>
                Assign…
              </button>
            );
            if (canRespond) {
              actions.push(
                <button
                  key="accept"
                  type="button"
                  onClick={onAccept}
                  className={cn(linkBase, 'text-[#3E7B52]')}>
                  Accept
                </button>
              );
              actions.push(
                <button
                  key="decline"
                  type="button"
                  onClick={handleDecline}
                  className={cn(linkBase, 'text-text-secondary hover:text-[#9B3A3A]')}>
                  Decline
                </button>
              );
            }
            if (canReassign) {
              actions.push(
                <button
                  key="reassign"
                  type="button"
                  onClick={onReassign}
                  className={cn(linkBase, 'text-text-secondary hover:text-text-primary')}>
                  Reassign…
                </button>
              );
              actions.push(
                <button
                  key="remove-assignment"
                  type="button"
                  onClick={handleRemoveAssignment}
                  className={cn(linkBase, 'text-text-secondary hover:text-[#9B3A3A]')}>
                  Remove
                </button>
              );
            }
            if (canEdit)
            actions.push(
              <button
                key="edit"
                type="button"
                onClick={onEdit}
                className={cn(linkBase, 'text-text-secondary hover:text-text-primary')}>
                Edit
              </button>
            );
            if (canCancel)
            actions.push(
              <button
                key="cancel"
                type="button"
                onClick={handleCancel}
                className={cn(linkBase, 'text-text-secondary hover:text-[#9B3A3A]')}>
                Cancel
              </button>
            );
            if (canArchive)
            actions.push(
              <button
                key="archive"
                type="button"
                onClick={onArchive}
                className={cn(linkBase, 'text-text-secondary hover:text-[#9B3A3A]')}>
                Archive
              </button>
            );
            if (actions.length === 0) return null;
            return (
              <div className="flex items-center gap-2">
                {actions.map((node, i) =>
                <Fragment key={i}>
                    {i > 0 &&
                  <span className="text-text-secondary/40" aria-hidden="true">·</span>
                  }
                    {node}
                  </Fragment>
                )}
              </div>);

          })()}
        </div>
      </div>
    </Card>);

}
