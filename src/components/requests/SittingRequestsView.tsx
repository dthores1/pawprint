import React, { useState } from 'react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { PillTabs } from '../ui/PillTabs';
import { FilterDropdown } from '../ui/FilterDropdown';
import { NewSittingRequestModal } from '../sitting/NewSittingRequestModal';
import {
  HeartHandshakeIcon,
  PillIcon,
  TruckIcon,
  PackageIcon,
  PencilIcon,
  Trash2Icon } from
'lucide-react';
import { cn, animalDisplayName } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { SittingRequest, SittingRequestStatus, Animal } from '../../types';
import { ArchiveConfirmDialog } from '../archive/ArchiveConfirmDialog';
import { useCanArchive } from '../archive/useCanArchive';

const SITTING_ARCHIVABLE: SittingRequestStatus[] = [
'completed',
'cancelled',
'expired'];

// Statuses that mean "this request is no longer active" — same treatment as
// cancelled across the UI (no edit, no cancel, archivable).
const SITTING_TERMINAL: SittingRequestStatus[] = [
'completed',
'cancelled',
'expired'];

const STATUS_LABEL: Record<SittingRequestStatus, string> = {
  open: 'Unclaimed',
  claimed: 'Claimed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired'
};
const STATUS_PILL: Record<SittingRequestStatus, string> = {
  open: 'bg-[#F8E7C8] text-[#A36B00]',
  claimed: 'bg-[#DCEAF7] text-[#356A9A]',
  in_progress: 'bg-[#E8DEEC] text-[#6E4E80]',
  completed: 'bg-[#DDEFE2] text-[#3E7B52]',
  cancelled: 'bg-[#F5D7D7] text-[#9B3A3A]',
  // Expired reads as muted/neutral — it's history, not a problem.
  expired: 'bg-background text-text-secondary border border-border'
};

function formatDateRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : undefined;
  const sameYear = end && start.getFullYear() === end.getFullYear();

  const startStr = start.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric'
  });

  const endStr = end ? end.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'No end date specified';
  return `${startStr} – ${endStr}`;
}

// Subtabs mirror Transport: my active sits, the unclaimed pool, everything with
// a sitter, and the terminal archive.
type SittingTab = 'mine' | 'unclaimed' | 'assigned' | 'completed';

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
function startOfWeekSunday(d: Date): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}
// Parse a 'yyyy-MM-dd' (or ISO) date string at LOCAL midnight, so date-only
// values don't shift a day in US timezones.
function parseLocalDate(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00`);
}
// A sitting request covers a date RANGE, so date filters match by window overlap
// (Past Due = the whole window has elapsed).
function matchesSittingDateFilter(
r: SittingRequest,
filter: string,
now: Date = new Date())
: boolean {
  if (filter === 'all') return true;
  const DAY = 86400000;
  const start = startOfDay(parseLocalDate(r.start_date)).getTime();
  const end = startOfDay(parseLocalDate(r.end_date || r.start_date)).getTime();
  const today = startOfDay(now).getTime();
  if (filter === 'past_due') return end < today;
  const overlaps = (ws: number, we: number) => start <= we && end >= ws;
  if (filter === 'today') return overlaps(today, today);
  if (filter === 'tomorrow') return overlaps(today + DAY, today + DAY);
  if (filter === 'this_week') {
    const ws = startOfWeekSunday(now).getTime();
    return overlaps(ws, ws + 6 * DAY);
  }
  if (filter === 'next_week') {
    const ws = startOfWeekSunday(now).getTime() + 7 * DAY;
    return overlaps(ws, ws + 6 * DAY);
  }
  return true;
}

export function SittingRequestsView() {
  const {
    sittingRequests,
    sittingRequestPlacements,
    placements,
    animalsIndex: animals,
    peopleIndex: people,
    acceptSittingRequest,
    releaseSittingRequest,
    updateSittingRequest
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const [editing, setEditing] = useState<SittingRequest | null>(null);
  // null = no explicit choice yet → fall back to the data-driven default below.
  const [selectedTab, setSelectedTab] = useState<SittingTab | null>(null);
  const [archiving, setArchiving] = useState<SittingRequest | null>(null);
  const [requesterFilter, setRequesterFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  // Same admin check on every card — useCanArchive doesn't depend on the row id.
  const isAdminForArchive = useCanArchive('sitting_requests', { id: 'na' });

  const personName = (id?: string | null) => {
    if (!id) return 'Unknown';
    const p = people.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
  };

  const sorted = [...sittingRequests].sort(
    (a, b) =>
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  // Buckets key off the sitter + whether the request is terminal — "what's there
  // for me to do?" rather than raw status.
  const isTerminal = (s: SittingRequest) => SITTING_TERMINAL.includes(s.status);
  const buckets: Record<SittingTab, SittingRequest[]> = {
    mine: sorted.filter(
      (s) =>
      !!currentPersonId &&
      s.sitter_person_id === currentPersonId &&
      !isTerminal(s)
    ),
    unclaimed: sorted.filter((s) => !s.sitter_person_id && !isTerminal(s)),
    assigned: sorted.filter((s) => !!s.sitter_person_id && !isTerminal(s)),
    completed: sorted.filter(isTerminal)
  };

  const defaultTab: SittingTab = buckets.mine.length > 0 ? 'mine' : 'unclaimed';
  const activeTab = selectedTab ?? defaultTab;

  const requesterOptions = [
  { value: 'all', label: 'All Requesters' },
  ...Array.from(
    new Set(
      sittingRequests.
      map((s) => s.requested_by_person_id).
      filter((v): v is string => Boolean(v))
    )
  ).
  map((id) => ({ value: id, label: personName(id) })).
  sort((a, b) => a.label.localeCompare(b.label))];

  const assigneeOptions = [
  { value: 'all', label: 'All Assignees' },
  ...Array.from(
    new Set(
      sittingRequests.
      map((s) => s.sitter_person_id).
      filter((v): v is string => Boolean(v))
    )
  ).
  map((id) => ({ value: id, label: personName(id) })).
  sort((a, b) => a.label.localeCompare(b.label))];

  // The Assignee filter only makes sense where requests can have a sitter:
  // "Assigned to Me" is all me, "Unclaimed" has none — so show it only on
  // "Assigned" and "Completed", and ignore it when bucketing.
  const showAssigneeFilter =
  activeTab === 'assigned' || activeTab === 'completed';
  const filtersActive =
  requesterFilter !== 'all' ||
  showAssigneeFilter && assigneeFilter !== 'all' ||
  dateFilter !== 'all';

  const display = buckets[activeTab].filter(
    (s) =>
    (requesterFilter === 'all' ||
    s.requested_by_person_id === requesterFilter) && (
    !showAssigneeFilter ||
    assigneeFilter === 'all' ||
    s.sitter_person_id === assigneeFilter) &&
    matchesSittingDateFilter(s, dateFilter)
  );

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
    <div className="space-y-6">
      <PillTabs
        value={activeTab}
        onChange={(k) => setSelectedTab(k as SittingTab)}
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
          <HeartHandshakeIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            {filtersActive ?
          'No requests match the current filters' :
          activeTab === 'mine' ?
          'Nothing is assigned to you right now' :
          activeTab === 'unclaimed' ?
          'No coverage needed right now' :
          activeTab === 'assigned' ?
          'No active sitting assignments at the moment' :
          'No completed sitting requests yet'}
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
              canRelease={
              !!currentPersonId &&
              s.sitter_person_id === currentPersonId &&
              !SITTING_TERMINAL.includes(s.status)
              }
              onRelease={() => releaseSittingRequest(s.id)}
              canCancel={
              !!currentPersonId &&
              s.requested_by_person_id === currentPersonId &&
              !SITTING_TERMINAL.includes(s.status)
              }
              onCancel={() =>
              updateSittingRequest(s.id, { status: 'cancelled' })
              }
              canEdit={
              !!currentPersonId &&
              s.requested_by_person_id === currentPersonId &&
              s.status === 'open'
              }
              onEdit={() => setEditing(s)}
              canArchive={
              isAdminForArchive && SITTING_ARCHIVABLE.includes(s.status)
              }
              onArchive={() => setArchiving(s)} />);


        })}
        </div>
      }

      {editing &&
      <NewSittingRequestModal
        isOpen={true}
        onClose={() => setEditing(null)}
        request={editing} />

      }

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
  /** Viewer is the accepted sitter and can back out. */
  canRelease: boolean;
  onRelease: () => void;
  canCancel: boolean;
  onCancel: () => void;
  canEdit: boolean;
  onEdit: () => void;
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
  canRelease,
  onRelease,
  canCancel,
  onCancel,
  canEdit,
  onEdit,
  canArchive,
  onArchive
}: SittingCardProps) {
  const [releaseOpen, setReleaseOpen] = useState(false);
  const handleCancel = () => {
    if (
    window.confirm(
      'Cancel this sitting request? It will be marked as cancelled for everyone.'
    ))
    {
      onCancel();
    }
  };
  return (
    <>
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

        {(canAccept || canRelease || canCancel || canEdit || canArchive) &&
        <div className="shrink-0 flex sm:flex-col items-start sm:items-end gap-2">
            {canAccept &&
          <Button size="sm" onClick={onAccept}>
                Accept Sitting Request
              </Button>
          }
            {canRelease &&
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReleaseOpen(true)}
            className="text-status-urgent-text hover:bg-status-urgent-bg">

                Unable to Sit
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
            <div className="flex gap-1">
              {canEdit &&
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit request"
              title="Edit request"
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors">

                  <PencilIcon className="w-4 h-4" />
                </button>
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
          </div>
        }
      </div>
    </Card>

    <Modal
      isOpen={releaseOpen}
      onClose={() => setReleaseOpen(false)}
      title="Can't Sit Anymore?"
      footer={
      <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setReleaseOpen(false)}>
            Keep Assignment
          </Button>
          <Button
          onClick={() => {
            onRelease();
            setReleaseOpen(false);
          }}>
            Release Assignment
          </Button>
        </div>
      }>

      <p className="text-sm text-text-secondary leading-relaxed">
        No problem. We'll notify the requester that you're no longer available and
        reopen the request so another volunteer can help.
      </p>
    </Modal>
    </>);

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
