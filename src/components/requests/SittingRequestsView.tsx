import React, { useEffect, useState } from 'react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PillTabs } from '../ui/PillTabs';
import { FilterDropdown } from '../ui/FilterDropdown';
import { VirtualizedGrid } from '../ui/VirtualizedGrid';
import { Link } from 'react-router-dom';
import { NewSittingRequestModal } from '../sitting/NewSittingRequestModal';
import { NewTransportRequestModal } from '../transports/NewTransportRequestModal';
import { useIsAdmin } from '../../lib/useIsAdmin';
import {
  HeartHandshakeIcon,
  PillIcon,
  TruckIcon,
  PackageIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  AlertTriangleIcon,
  ArrowUpRightIcon } from
'lucide-react';
import { cn, animalDisplayName, parseLocalDate } from '../../lib/utils';
import { useFocusRequest } from '../../lib/useFocusRequest';
import { cancelRequestConfirm } from '../../lib/requestCopy';
import { useAuth } from '../../context/AuthContext';
import { SittingRequest, SittingRequestStatus, Animal } from '../../types';
import {
  sittingStaleInfo,
  SITTING_STALE_LABEL,
  sittingStaleTooltip } from
'../../lib/sittingTiming';
import { ArchiveConfirmDialog } from '../archive/ArchiveConfirmDialog';
import { useCanArchive } from '../archive/useCanArchive';
import { RequestsSkeleton } from './RequestsSkeleton';

// Only truly-finished requests are archivable (you complete/cancel a past-due
// one first). `expired` is NOT terminal — a past-due sit stays live + actionable
// and surfaces a "Past Due" badge, mirroring transport.
const SITTING_ARCHIVABLE: SittingRequestStatus[] = ['completed', 'cancelled'];

// "No longer active" = completed or cancelled. `expired` is intentionally absent
// (past-due is a live state, surfaced via the stale badge).
const SITTING_TERMINAL: SittingRequestStatus[] = ['completed', 'cancelled'];

const STATUS_LABEL: Record<SittingRequestStatus, string> = {
  open: 'Unclaimed',
  claimed: 'Claimed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired'
};
const STATUS_PILL: Record<SittingRequestStatus, string> = {
  // Blue (not amber) so "Unclaimed" reads as available, not a warning.
  open: 'bg-[#E3E4F2] text-[#525694]',
  claimed: 'bg-[#DCEAF7] text-[#356A9A]',
  in_progress: 'bg-[#E8DEEC] text-[#6E4E80]',
  completed: 'bg-[#DDEFE2] text-[#3E7B52]',
  cancelled: 'bg-[#F5D7D7] text-[#9B3A3A]',
  // Expired reads as muted/neutral — it's history, not a problem.
  expired: 'bg-background text-text-secondary border border-border'
};

function formatDateRange(startISO: string, endISO: string) {
  const start = parseLocalDate(startISO);
  const end = endISO ? parseLocalDate(endISO) : undefined;
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
type SittingTab = 'mine' | 'unclaimed' | 'myRequests' | 'completed';

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

interface SittingRequestsViewProps {
  /** ?request=<id> deep-link: switch to its sub-tab, highlight + scroll to it. */
  focusRequestId?: string | null;
  onFocusedRequest?: () => void;
}
export function SittingRequestsView({
  focusRequestId,
  onFocusedRequest
}: SittingRequestsViewProps = {}) {
  const {
    sittingRequests,
    sittingRequestPlacements,
    placements,
    animalsIndex: animals,
    peopleIndex: people,
    transportRequests,
    acceptSittingRequest,
    releaseSittingRequest,
    completeSittingRequest,
    updateSittingRequest,
    sittingHistoryLoaded,
    ensureSittingHistoryLoaded,
    requestsLoading
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<SittingRequest | null>(null);
  const [arrangingFor, setArrangingFor] = useState<SittingRequest | null>(null);
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
    // "My Requests" = open requests I raised (regardless of who's sitting), so
    // the requester can keep an eye on what they've asked for.
    myRequests: sorted.filter(
      (s) =>
      !!currentPersonId &&
      s.requested_by_person_id === currentPersonId &&
      !isTerminal(s)
    ),
    completed: sorted.filter(isTerminal)
  };

  const defaultTab: SittingTab = buckets.mine.length > 0 ? 'mine' : 'unclaimed';
  const activeTab = selectedTab ?? defaultTab;

  // Deep-link focus (from the dashboard "Help Needed" widget).
  const highlightedId = useFocusRequest<SittingTab>({
    focusRequestId,
    onFocusedRequest,
    resolveTab: (id) =>
    (['mine', 'unclaimed', 'myRequests', 'completed'] as SittingTab[]).find(
      (t) => buckets[t].some((s) => s.id === id)
    ) ?? null,
    setSelectedTab
  });

  // Closed sittings aren't loaded upfront — pull them in when the Completed tab
  // opens (idempotent). Until then the Completed bucket is empty.
  useEffect(() => {
    if (activeTab === 'completed') ensureSittingHistoryLoaded();
  }, [activeTab, ensureSittingHistoryLoaded]);

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

  // The Assignee filter only makes sense where requests can have varied sitters:
  // "Assigned to Me" is all me, "Unclaimed" has none — so show it only on
  // "My Requests" (others may have claimed them) and "Closed", and ignore it
  // when bucketing.
  const showAssigneeFilter =
  activeTab === 'myRequests' || activeTab === 'completed';
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
        { key: 'myRequests', label: `My Requests (${buckets.myRequests.length})` },
        {
          key: 'completed',
          // "Closed" covers both completed and cancelled. Count is unknown until
          // the deferred history loads, so omit it rather than show a "(0)".
          label: sittingHistoryLoaded ?
          `Closed (${buckets.completed.length})` :
          'Closed'
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

      {requestsLoading && sittingRequests.length === 0 ?
      <RequestsSkeleton /> :
      activeTab === 'completed' && !sittingHistoryLoaded ?
      <Card className="p-10 text-center text-text-secondary">
          <p>Loading history…</p>
        </Card> :
      display.length === 0 ?
      <Card className="p-10 text-center text-text-secondary">
          <HeartHandshakeIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            {filtersActive ?
          'No requests match the current filters' :
          activeTab === 'mine' ?
          'Nothing is assigned to you right now' :
          activeTab === 'unclaimed' ?
          'No coverage needed right now' :
          activeTab === 'myRequests' ?
          "You haven't raised any open sitting requests" :
          'No closed sitting requests yet'}
          </p>
        </Card> :

      <VirtualizedGrid
        items={display}
        columns={1}
        gap={12}
        estimateRowHeight={200}
        getKey={(s) => s.id}
        pageScroll
        renderItem={(s) => {
          const requester = people.find(
            (p) => p.id === s.requested_by_person_id
          );
          const sitter = s.sitter_person_id ?
          people.find((p) => p.id === s.sitter_person_id) :
          undefined;
          return (
            <div
              id={`req-${s.id}`}
              className={cn(
                'rounded-2xl transition-shadow',
                highlightedId === s.id &&
                'ring-2 ring-primary ring-offset-2 ring-offset-background'
              )}>

              <SittingCard
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
              canComplete={
              !!currentPersonId &&
              (s.requested_by_person_id === currentPersonId ||
              s.sitter_person_id === currentPersonId ||
              isAdmin) &&
              // Once a sitter is on it (claimed / in progress) or the coverage
              // window has passed. Not on a still-open future request.
              (s.status === 'claimed' ||
              s.status === 'in_progress' ||
              (s.status !== 'completed' &&
              s.status !== 'cancelled' &&
              sittingStaleInfo(s) !== null))
              }
              onComplete={() => completeSittingRequest(s.id)}
              transportNeeded={s.transport_needed}
              linkedTransportId={
              transportRequests.find(
                (t) =>
                t.sitting_request_id === s.id && t.status !== 'cancelled'
              )?.id
              }
              canArrangeTransport={
              !!currentPersonId && (
              s.requested_by_person_id === currentPersonId || isAdmin)
              }
              onArrangeTransport={() => setArrangingFor(s)}
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
              (s.status === 'open' || s.status === 'expired')
              }
              onEdit={() => setEditing(s)}
              canArchive={
              isAdminForArchive && SITTING_ARCHIVABLE.includes(s.status)
              }
              onArchive={() => setArchiving(s)} />
            </div>);


        }} />

      }

      {editing &&
      <NewSittingRequestModal
        isOpen={true}
        onClose={() => setEditing(null)}
        request={editing} />

      }

      {arrangingFor &&
      (() => {
        const covered = animalsForRequest(arrangingFor.id);
        return (
          <NewTransportRequestModal
            isOpen={true}
            onClose={() => setArrangingFor(null)}
            prefill={{
              type: 'animal',
              animal_ids: covered.map((c) => c.id),
              schedule_type: 'flexible',
              preferred_window_start: arrangingFor.start_date.slice(0, 10),
              notes: `Transport to sitter for sitting coverage (${formatDateRange(
                arrangingFor.start_date,
                arrangingFor.end_date
              )}).`,
              sitting_request_id: arrangingFor.id
            }} />);

      })()}

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
  /** Confirm the sitting happened (requester / sitter / admin). */
  canComplete: boolean;
  onComplete: () => void;
  /** The request flagged "transport help needed to get to sitter". */
  transportNeeded: boolean;
  /** Set once a transport has been arranged for this sitting request. */
  linkedTransportId?: string;
  canArrangeTransport: boolean;
  onArrangeTransport: () => void;
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
  canComplete,
  onComplete,
  transportNeeded,
  linkedTransportId,
  canArrangeTransport,
  onArrangeTransport,
  canCancel,
  onCancel,
  canEdit,
  onEdit,
  canArchive,
  onArchive
}: SittingCardProps) {
  // All confirmations route through one ConfirmDialog (no window.confirm).
  const [confirm, setConfirm] = useState<
    null | 'complete' | 'cancel' | 'release'>(
    null);
  const confirmProps = {
    complete: {
      title: 'Mark sitting complete?',
      body: 'Only do this once the sitting has actually happened — it records the request as completed.',
      confirmLabel: 'Mark Complete',
      cancelLabel: 'Cancel',
      tone: 'default' as const,
      onConfirm: onComplete
    },
    cancel: { ...cancelRequestConfirm('sitting request'), onConfirm: onCancel },
    release: {
      title: 'Can’t sit anymore?',
      body: 'No problem. We’ll notify the requester that you’re no longer available and reopen the request so another volunteer can help.',
      confirmLabel: 'Release Assignment',
      cancelLabel: 'Keep Assignment',
      tone: 'default' as const,
      onConfirm: onRelease
    }
  };
  const activeConfirm = confirm ? confirmProps[confirm] : null;
  const stale = sittingStaleInfo(request);
  const showArrangeTransport =
  transportNeeded &&
  !linkedTransportId &&
  canArrangeTransport &&
  !SITTING_TERMINAL.includes(request.status);
  return (
    <>
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
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
            {stale ?
            <Tooltip content={sittingStaleTooltip(stale)}>
                <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide cursor-help',
                  stale.kind === 'past_due' ?
                  'bg-[#F5D7D7] text-[#9B3A3A]' : // red — the weight "Expired" had
                  'bg-[#F8E7C8] text-[#A36B00]' // amber — softer "needs confirmation"
                )}>

                  <AlertTriangleIcon className="w-3 h-3" />
                  {SITTING_STALE_LABEL[stale.kind]} · {stale.days}D
                </span>
              </Tooltip> :

            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                STATUS_PILL[request.status === 'expired' ? 'open' : request.status]
              )}>

                {STATUS_LABEL[request.status === 'expired' ? 'open' : request.status]}
              </span>
            }
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
            (linkedTransportId ?
            <Link
              to="/requests?tab=transport"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#DDEFE2] text-[#3E7B52] hover:underline">

                  <TruckIcon className="w-3.5 h-3.5" />
                  Transport requested
                  <ArrowUpRightIcon className="w-3 h-3" />
                </Link> :

            <RequirementChip
              icon={TruckIcon}
              label="Transport needed"
              tone="blue" />)

            }
          </div>

          {request.notes &&
          <p className="text-sm text-text-secondary mt-3 italic">
              {request.notes}
            </p>
          }
        </div>

        {(() => {
          const linkBase =
          'text-sm font-medium hover:underline transition-colors';
          const iconBtn =
          'p-1 -m-1 rounded-md transition-colors text-text-secondary';
          const verbs: JSX.Element[] = [];
          if (canAccept)
          verbs.push(
            <button
              key="accept"
              type="button"
              onClick={onAccept}
              className={cn(linkBase, 'text-primary')}>
              Accept Request
            </button>
          );
          if (showArrangeTransport)
          verbs.push(
            <button
              key="arrange"
              type="button"
              onClick={onArrangeTransport}
              className={cn(linkBase, 'inline-flex items-center gap-1 text-primary')}>

              <TruckIcon className="w-3.5 h-3.5" />
              Arrange Transport
            </button>
          );
          if (canRelease)
          verbs.push(
            <button
              key="release"
              type="button"
              onClick={() => setConfirm('release')}
              className={cn(linkBase, 'text-text-secondary hover:text-[#9B3A3A]')}>
              Unable to Sit
            </button>
          );
          const hasIconRow = canEdit || canCancel || canArchive;
          if (!canComplete && verbs.length === 0 && !hasIconRow) return null;
          return (
            <div className="shrink-0 flex flex-col sm:items-end gap-1.5">
              {canComplete &&
              <Button
                variant="soft"
                size="xs"
                onClick={() => setConfirm('complete')}>

                  Mark Complete
                </Button>
              }
              {(verbs.length > 0 || hasIconRow) &&
              <div className="flex items-center gap-5">
                  {verbs.map((node, i) =>
                <React.Fragment key={i}>
                      {i > 0 &&
                  <span className="text-text-secondary/40" aria-hidden="true">·</span>
                  }
                      {node}
                    </React.Fragment>
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
