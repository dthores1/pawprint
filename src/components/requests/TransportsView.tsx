import { Fragment, useState } from 'react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { NewTransportRequestModal } from '../transports/NewTransportRequestModal';
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
  claimed: 'Claimed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired'
};
const STATUS_PILL: Record<TransportRequestStatus, string> = {
  open: 'bg-[#F8E7C8] text-[#A36B00]',
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

export function TransportsView() {
  const {
    transportRequests,
    peopleIndex: people,
    animalsIndex: animals,
    savedLocations,
    claimTransportRequest,
    updateTransportRequest
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const [editing, setEditing] = useState<TransportRequest | null>(null);
  const [activeTab, setActiveTab] = useState<
    'open' | 'claimed' | 'completed' | 'needsReview'>(
    'open');
  const [archiving, setArchiving] = useState<TransportRequest | null>(null);
  const isAdminForArchive = useCanArchive('transport_requests', { id: 'na' });

  const savedLocName = (id?: string | null) =>
  id ? savedLocations.find((l) => l.id === id)?.name : undefined;
  // A leg is resolved if it links a saved location or has a real (non-free-text)
  // address; a request "needs address" if either leg is unresolved.
  const needsAddress = (r: TransportRequest) =>
  !(r.pickup_saved_location_id || isResolvedAddress(r.pickup_address)) ||
  !(r.dropoff_saved_location_id || isResolvedAddress(r.dropoff_address));

  // Urgent/ASAP first, then soonest timing. Bucket by EFFECTIVE status so a
  // past open Exact request lands in Needs Review (not Open) immediately, even
  // before the nightly cron persists 'expired'.
  const sorted = [...transportRequests].sort((a, b) => {
    const u = URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency];
    if (u !== 0) return u;
    return timingSortValue(a) - timingSortValue(b);
  });
  const grouped = {
    open: sorted.filter((r) => effectiveStatus(r) === 'open'),
    claimed: sorted.filter(
      (r) => r.status === 'claimed' || r.status === 'in_progress'
    ),
    completed: sorted.filter(
      (r) => r.status === 'completed' || r.status === 'cancelled'
    ),
    needsReview: sorted.filter((r) => effectiveStatus(r) === 'expired')
  };
  const display = grouped[activeTab];

  return (
    <div className="space-y-6">
      <PillTabs
        value={activeTab}
        onChange={(k) => setActiveTab(k as typeof activeTab)}
        tabs={[
        { key: 'open', label: `Open (${grouped.open.length})` },
        {
          key: 'claimed',
          label: `Claimed / In Progress (${grouped.claimed.length})`
        },
        { key: 'completed', label: `Completed (${grouped.completed.length})` },
        {
          key: 'needsReview',
          label: `Needs Review (${grouped.needsReview.length})`
        }]} />

      {display.length === 0 ?
      <Card className="p-10 text-center text-text-secondary">
          <TruckIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            Nothing to see here
          </p>
          <p className="text-sm">
            {activeTab === 'open' ?
          'Submit a request when someone needs a ride.' :
          activeTab === 'claimed' ?
          'No active rides at the moment.' :
          activeTab === 'needsReview' ?
          'No expired requests to review.' :
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
          <p className="text-sm text-text-secondary mt-1 flex items-center gap-1.5 min-w-0">
            <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
            {pickupLabel ?
            <span className="text-text-primary truncate min-w-0">{pickupLabel}</span> :
            <AddressDisplay
              value={request.pickup_address ?? null}
              singleLine
              className="text-text-primary min-w-0" />
            }
            <ArrowRightIcon className="w-3.5 h-3.5 shrink-0" />
            {dropoffLabel ?
            <span className="text-text-primary truncate min-w-0">{dropoffLabel}</span> :
            <AddressDisplay
              value={request.dropoff_address ?? null}
              singleLine
              className="text-text-primary min-w-0" />
            }
          </p>
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
                <> · Claimed by <span className="text-text-primary font-medium">{assigneeName}</span></>
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
