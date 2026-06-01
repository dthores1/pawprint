import React, { useState } from 'react';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { NewSittingRequestModal } from '../components/sitting/NewSittingRequestModal';
import {
  HeartHandshakeIcon,
  PlusIcon,
  PillIcon,
  TruckIcon,
  PackageIcon,
  Trash2Icon } from
'lucide-react';
import { cn, animalDisplayName } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { SittingRequest, SittingRequestStatus, Animal } from '../types';
import { ArchiveConfirmDialog } from '../components/archive/ArchiveConfirmDialog';
import { useCanArchive } from '../components/archive/useCanArchive';

const SITTING_ARCHIVABLE: SittingRequestStatus[] = ['completed', 'canceled'];

const STATUS_LABEL: Record<SittingRequestStatus, string> = {
  open: 'Unclaimed',
  claimed: 'Claimed',
  in_progress: 'In Progress',
  completed: 'Completed',
  canceled: 'Canceled'
};
const STATUS_PILL: Record<SittingRequestStatus, string> = {
  open: 'bg-[#F8E7C8] text-[#A36B00]',
  claimed: 'bg-[#DCEAF7] text-[#356A9A]',
  in_progress: 'bg-[#E8DEEC] text-[#6E4E80]',
  completed: 'bg-[#DDEFE2] text-[#3E7B52]',
  canceled: 'bg-[#F5D7D7] text-[#9B3A3A]'
};

function formatDateRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric'
  });
  const endStr = end.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  return `${startStr} – ${endStr}`;
}

export function Sitting() {
  const {
    sittingRequests,
    sittingRequestPlacements,
    placements,
    animals,
    people,
    acceptSittingRequest,
    updateSittingRequest
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [tab, setTab] = useState<'unclaimed' | 'mine'>('unclaimed');
  const [archiving, setArchiving] = useState<SittingRequest | null>(null);
  // Same admin check on every card — useCanArchive doesn't depend on the row id.
  const isAdminForArchive = useCanArchive('sitting_requests', { id: 'na' });

  const sorted = [...sittingRequests].sort(
    (a, b) =>
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  const unclaimed = sorted.filter((s) => s.status === 'open');
  // "Mine" = requests I submitted OR placements I'm sitting.
  const mine = sorted.filter(
    (s) =>
    !!currentPersonId && (
    s.requested_by_person_id === currentPersonId ||
    s.sitter_person_id === currentPersonId)
  );

  const display = tab === 'unclaimed' ? unclaimed : mine;

  // Resolve the animals covered by a sitting request via the join table.
  const animalsForRequest = (requestId: string): Animal[] => {
    const placementIds = sittingRequestPlacements.
    filter((srp) => srp.sitting_request_id === requestId).
    map((srp) => srp.foster_placement_id);
    return placementIds.
    map((pid) => placements.find((p) => p.id === pid)).
    filter((p): p is NonNullable<typeof p> => !!p).
    map((p) => animals.find((a) => a.id === p.animal_id)).
    filter((a): a is Animal => !!a);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <HeartHandshakeIcon className="w-8 h-8 text-primary" />
            Sitting Requests
          </h1>
          <p className="text-text-secondary mt-1">
            Need temporary coverage? Find a sitter from inside the org.
          </p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2">
          <PlusIcon className="w-4 h-4" />
          New Sitting Request
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('unclaimed')}
          className={cn(
            'px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            tab === 'unclaimed' ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>

          Unclaimed ({unclaimed.length})
        </button>
        <button
          onClick={() => setTab('mine')}
          className={cn(
            'px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            tab === 'mine' ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>

          My Requests ({mine.length})
        </button>
      </div>

      {display.length === 0 ?
      <Card className="p-10 text-center text-text-secondary">
          <HeartHandshakeIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            {tab === 'unclaimed' ?
          'No coverage needed right now' :
          'No sitting requests in your queue'}
          </p>
        </Card> :

      <div className="space-y-3">
          {display.map((s) => {
          const requester = people.find(
            (p) => p.id === s.requested_by_person_id
          );
          const sitter = s.sitter_person_id ?
          people.find((p) => p.id === s.sitter_person_id) :
          undefined;
          return (
            <SittingCard
              key={s.id}
              request={s}
              coveredAnimals={animalsForRequest(s.id)}
              requesterName={
              requester ?
              `${requester.first_name} ${requester.last_name}` :
              'Unknown'
              }
              sitterName={
              sitter ? `${sitter.first_name} ${sitter.last_name}` : undefined
              }
              canAccept={
              !!currentPersonId &&
              s.status === 'open' &&
              s.requested_by_person_id !== currentPersonId
              }
              onAccept={() =>
              currentPersonId &&
              acceptSittingRequest(s.id, currentPersonId)
              }
              canCancel={
              !!currentPersonId &&
              s.requested_by_person_id === currentPersonId &&
              s.status !== 'completed' &&
              s.status !== 'canceled'
              }
              onCancel={() =>
              updateSittingRequest(s.id, { status: 'canceled' })
              }
              canArchive={
              isAdminForArchive && SITTING_ARCHIVABLE.includes(s.status)
              }
              onArchive={() => setArchiving(s)} />);


        })}
        </div>
      }

      <NewSittingRequestModal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)} />

      {archiving &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchiving(null)}
        table="sitting_requests"
        id={archiving.id}
        typeLabel="sitting request"
        entityLabel={formatDateRange(archiving.start_date, archiving.end_date)} />

      }
    </div>);

}

interface SittingCardProps {
  request: SittingRequest;
  coveredAnimals: Animal[];
  requesterName: string;
  sitterName?: string;
  canAccept: boolean;
  onAccept: () => void;
  canCancel: boolean;
  onCancel: () => void;
  canArchive: boolean;
  onArchive: () => void;
}
function SittingCard({
  request,
  coveredAnimals,
  requesterName,
  sitterName,
  canAccept,
  onAccept,
  canCancel,
  onCancel,
  canArchive,
  onArchive
}: SittingCardProps) {
  const handleCancel = () => {
    if (
    window.confirm(
      'Cancel this sitting request? It will be marked as canceled for everyone.'
    ))
    {
      onCancel();
    }
  };
  return (
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        {/* Up to 3 stacked avatars; +N indicator if more. */}
        <div className="flex -space-x-3 shrink-0">
          {coveredAnimals.slice(0, 3).map((a) =>
          <Avatar
            key={a.id}
            src={a.primary_photo_url}
            type="animal"
            species={a.species}
            size="lg"
            className="ring-2 ring-card" />

          )}
          {coveredAnimals.length > 3 &&
          <div className="w-16 h-16 rounded-full bg-background border border-border ring-2 ring-card flex items-center justify-center text-sm font-semibold text-text-secondary">
              +{coveredAnimals.length - 3}
            </div>
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-lg font-heading font-bold text-text-primary">
              {coveredAnimals.length === 0 ?
              'No animals attached' :
              coveredAnimals.map((a) => animalDisplayName(a)).join(', ')}
            </h3>
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                STATUS_PILL[request.status]
              )}>

              {STATUS_LABEL[request.status]}
            </span>
          </div>
          <p className="text-sm font-medium text-text-primary">
            {formatDateRange(request.start_date, request.end_date)}
          </p>
          <p className="text-sm text-text-secondary mt-1">
            Requested by {requesterName}
            {sitterName && (
              <> · Sitter: <span className="text-text-primary font-medium">{sitterName}</span></>
            )}
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            {request.medication_required &&
            <RequirementChip
              icon={PillIcon}
              label="Medication required"
              tone="amber" />

            }
            {request.foster_provides_supplies &&
            <RequirementChip
              icon={PackageIcon}
              label="Foster provides supplies"
              tone="green" />

            }
            {request.transport_needed &&
            <RequirementChip
              icon={TruckIcon}
              label="Transport needed"
              tone="blue" />

            }
          </div>

          {request.notes &&
          <p className="text-sm text-text-secondary mt-3 italic">
              {request.notes}
            </p>
          }
        </div>

        {(canAccept || canCancel || canArchive) &&
        <div className="shrink-0 flex sm:flex-col items-start sm:items-end gap-2">
            {canAccept &&
          <Button size="sm" onClick={onAccept}>
                Accept Sitting Request
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
            {canArchive &&
          <button
            type="button"
            onClick={onArchive}
            aria-label="Archive request"
            title="Archive request"
            className="p-1.5 rounded-md text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

                <Trash2Icon className="w-4 h-4" />
              </button>
          }
          </div>
        }
      </div>
    </Card>);

}

interface RequirementChipProps {
  icon: React.ElementType;
  label: string;
  tone: 'amber' | 'green' | 'blue';
}
function RequirementChip({ icon: Icon, label, tone }: RequirementChipProps) {
  const tones = {
    amber: 'bg-[#F8E7C8] text-[#A36B00]',
    green: 'bg-[#DDEFE2] text-[#3E7B52]',
    blue: 'bg-[#DCEAF7] text-[#356A9A]'
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        tones[tone]
      )}>

      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>);

}
