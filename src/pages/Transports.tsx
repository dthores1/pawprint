import React, { useState } from 'react';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NewTransportRequestModal } from '../components/transports/NewTransportRequestModal';
import {
  TruckIcon,
  PlusIcon,
  ArrowRightIcon,
  AlertCircleIcon } from
'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import {
  TransportRequest,
  TransportRequestStatus,
  TransportRequestType,
  TransportRequestUrgency } from
'../types';

const STATUS_LABEL: Record<TransportRequestStatus, string> = {
  open: 'Open',
  claimed: 'Claimed',
  in_progress: 'In Progress',
  completed: 'Completed',
  canceled: 'Canceled'
};
const STATUS_PILL: Record<TransportRequestStatus, string> = {
  open: 'bg-[#F8E7C8] text-[#A36B00]',
  claimed: 'bg-[#DCEAF7] text-[#356A9A]',
  in_progress: 'bg-[#E8DEEC] text-[#6E4E80]',
  completed: 'bg-[#DDEFE2] text-[#3E7B52]',
  canceled: 'bg-[#F5D7D7] text-[#9B3A3A]'
};
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

export function Transports() {
  const {
    transportRequests,
    people,
    animals,
    claimTransportRequest,
    updateTransportRequest
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'open' | 'claimed' | 'completed'>(
    'open');

  const sorted = [...transportRequests].sort(
    (a, b) =>
    new Date(b.requested_pickup_time).getTime() -
    new Date(a.requested_pickup_time).getTime()
  );
  const grouped = {
    open: sorted.filter((r) => r.status === 'open'),
    claimed: sorted.filter(
      (r) => r.status === 'claimed' || r.status === 'in_progress'
    ),
    completed: sorted.filter(
      (r) => r.status === 'completed' || r.status === 'canceled'
    )
  };
  const display = grouped[activeTab];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <TruckIcon className="w-8 h-8 text-primary" />
            Transportation Requests
          </h1>
          <p className="text-text-secondary mt-1">
            Help move animals and supplies where they need to go.
          </p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2">
          <PlusIcon className="w-4 h-4" />
          New Transport Request
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border">
        {(
        [
        { key: 'open', label: 'Open' },
        { key: 'claimed', label: 'Claimed / In Progress' },
        { key: 'completed', label: 'Completed' }] as const).
        map((t) =>
        <button
          key={t.key}
          onClick={() => setActiveTab(t.key)}
          className={cn(
            'px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === t.key ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>

            {t.label} ({grouped[t.key].length})
          </button>
        )}
      </div>

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
          canClaim={
          !!currentPersonId &&
          r.status === 'open' &&
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
          r.status !== 'canceled'
          }
          onCancel={() =>
          updateTransportRequest(r.id, { status: 'canceled' })
          } />

        )}
        </div>
      }

      <NewTransportRequestModal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)} />

    </div>);

}

interface TransportCardProps {
  request: TransportRequest;
  animalName?: string;
  requesterName: string;
  assigneeName?: string;
  canClaim: boolean;
  onClaim: () => void;
  canCancel: boolean;
  onCancel: () => void;
}
function TransportCard({
  request,
  animalName,
  requesterName,
  assigneeName,
  canClaim,
  onClaim,
  canCancel,
  onCancel
}: TransportCardProps) {
  const subject =
  animalName ||
  (request.type === 'supplies' ?
  'Supply drop' :
  TYPE_LABEL[request.type]);
  const handleCancel = () => {
    if (
    window.confirm(
      'Cancel this transport request? It will be marked as canceled for everyone.'
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
          </div>
          <p className="text-sm text-text-primary font-medium">
            {formatPickupTime(request.requested_pickup_time)}
          </p>
          <p className="text-sm text-text-secondary mt-1">
            Requested by {requesterName}
            {assigneeName && (
              <> · Claimed by <span className="text-text-primary font-medium">{assigneeName}</span></>
            )}
          </p>
          {request.notes &&
          <p className="text-sm text-text-secondary mt-1 italic">
              {request.notes}
            </p>
          }
        </div>

        <div className="flex sm:flex-col items-start sm:items-end gap-3 shrink-0">
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
              STATUS_PILL[request.status]
            )}>

            {STATUS_LABEL[request.status]}
          </span>
          {canClaim &&
          <Button size="sm" onClick={onClaim}>
              Claim Request
            </Button>
          }
          {canCancel &&
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="text-status-urgent-text hover:bg-status-urgent-bg">

              Cancel Request
            </Button>
          }
        </div>
      </div>
    </Card>);

}
