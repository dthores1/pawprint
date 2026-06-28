import { useEffect, useState } from 'react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { PillTabs } from '../ui/PillTabs';
import { VirtualizedGrid } from '../ui/VirtualizedGrid';
import { FilterDropdown } from '../ui/FilterDropdown';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cancelRequestConfirm } from '../../lib/requestCopy';
import { SupplyRequestDetailModal } from '../supplies/SupplyRequestDetailModal';
import { SupplyRequestCard } from './SupplyRequestCard';
import {
  PackageOpenIcon,
  RepeatIcon,
  Trash2Icon,
  BookmarkIcon } from
'lucide-react';
import { formatDate, animalDisplayName } from '../../lib/utils';
import { GuidanceEmptyState } from '../guidance/GuidanceEmptyState';
import { useAuth } from '../../context/AuthContext';
import { SupplyRequest } from '../../types';

const PRIORITY_OPTIONS = [
{ value: 'all', label: 'All Priorities' },
{ value: 'critical', label: 'Critical' },
{ value: 'urgent', label: 'Urgent' },
{ value: 'normal', label: 'Normal' }];


// "Needed By" date buckets, matched against a request's needed_by_date.
// Requests without a needed-by date only match "Any".
const NEEDED_BY_OPTIONS = [
{ value: 'all', label: 'Any' },
{ value: 'past_due', label: 'Past Due' },
{ value: 'today', label: 'Today' },
{ value: 'this_week', label: 'This Week' },
{ value: 'next_week', label: 'Next Week' }];


function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
// Week starts Sunday (US convention), matching the other request pages.
function startOfWeekSunday(d: Date): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}
function matchesNeededBy(
r: SupplyRequest,
filter: string,
now: Date = new Date())
: boolean {
  if (filter === 'all') return true;
  // needed_by_date is a date-only (yyyy-MM-dd) string → parse as local midnight.
  const nb = r.needed_by_date ?
  startOfDay(new Date(`${r.needed_by_date}T00:00:00`)).getTime() :
  null;
  const today = startOfDay(now).getTime();
  if (filter === 'past_due') return nb !== null && nb < today;
  if (nb === null) return false; // undated requests only match "Any"
  const DAY = 86400000;
  if (filter === 'today') return nb === today;
  if (filter === 'this_week') {
    const ws = startOfWeekSunday(now).getTime();
    return nb >= ws && nb < ws + 7 * DAY;
  }
  if (filter === 'next_week') {
    const ws = startOfWeekSunday(now).getTime() + 7 * DAY;
    return nb >= ws && nb < ws + 7 * DAY;
  }
  return true;
}

interface SupplyRequestsViewProps {
  /** When set, open this request's detail modal (e.g. from a duplicate warning). */
  openRequestId?: string | null;
  /** Called once the requested detail has been opened, so the trigger can clear. */
  onOpenedRequest?: () => void;
}
export function SupplyRequestsView({
  openRequestId,
  onOpenedRequest
}: SupplyRequestsViewProps = {}) {
  const {
    supplyRequests,
    peopleIndex: people,
    animalsIndex: animals,
    supplyRequestItems,
    products,
    addSupplyRequest,
    addSupplyRequestItem,
    updateSupplyRequest,
    supplyHistoryLoaded,
    ensureSupplyHistoryLoaded
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  // The supply request id pending a cancel confirmation (null = dialog closed).
  const [cancelId, setCancelId] = useState<string | null>(null);
  // The common-request template id pending a remove confirmation.
  const [removeCommonId, setRemoveCommonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'common'>(
    'active'
  );
  const [requesterFilter, setRequesterFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [neededByFilter, setNeededByFilter] = useState('all');

  // External trigger (e.g. the new-request modal's duplicate warning) asking us
  // to open a specific request's detail. Clear the trigger once handled.
  useEffect(() => {
    if (openRequestId) {
      setSelectedRequestId(openRequestId);
      onOpenedRequest?.();
    }
  }, [openRequestId, onOpenedRequest]);

  // Closed requests aren't loaded upfront — pull them in when the History tab
  // opens (idempotent). Until then the History list is empty.
  useEffect(() => {
    if (activeTab === 'completed') ensureSupplyHistoryLoaded();
  }, [activeTab, ensureSupplyHistoryLoaded]);
  const activeRequests = supplyRequests.
  filter(
    (r) =>
    r.status !== 'fulfilled' &&
    r.status !== 'cancelled' &&
    r.status !== 'denied'
  ).
  sort(
    (a, b) =>
    new Date(b.requested_date).getTime() -
    new Date(a.requested_date).getTime()
  );
  const completedRequests = supplyRequests.
  filter(
    (r) =>
    r.status === 'fulfilled' ||
    r.status === 'cancelled' ||
    r.status === 'denied'
  ).
  sort(
    (a, b) =>
    new Date(b.requested_date).getTime() -
    new Date(a.requested_date).getTime()
  );
  // Requester options derived from the real (non-template) requests, so the
  // dropdown lists only people who actually appear. Stable across active/history.
  const personName = (id?: string | null) => {
    if (!id) return 'Unknown';
    const p = people.find((pp) => pp.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
  };
  const requesterOptions = [
  { value: 'all', label: 'All Requesters' },
  ...Array.from(
    new Set(
      supplyRequests.
      filter((r) => !r.is_common_request).
      map((r) => r.requester_person_id).
      filter((v): v is string => Boolean(v))
    )
  ).
  map((id) => ({ value: id, label: personName(id) })).
  sort((a, b) => a.label.localeCompare(b.label))];

  const filtersActive =
  requesterFilter !== 'all' ||
  priorityFilter !== 'all' ||
  neededByFilter !== 'all';

  const displayRequests = (
  activeTab === 'active' ? activeRequests : completedRequests).
  filter(
    (r) =>
    (requesterFilter === 'all' || r.requester_person_id === requesterFilter) &&
    (priorityFilter === 'all' || r.priority === priorityFilter) &&
    matchesNeededBy(r, neededByFilter)
  );

  // Common requests — only the current user's saved templates.
  const itemsFor = (requestId: string) =>
  supplyRequestItems.filter((i) => i.supply_request_id === requestId);
  const summarizeItems = (requestId: string) => {
    const its = itemsFor(requestId);
    const names = its.
    slice(0, 2).
    map((item) =>
    item.product_id ?
    products.find((p) => p.id === item.product_id)?.name ??
    item.custom_item_name :
    item.custom_item_name
    ).
    filter(Boolean);
    return (
      names.join(', ') + (its.length > 2 ? ` +${its.length - 2} more` : ''));

  };
  const myCommonRequests = supplyRequests.
  filter(
    (r) => r.is_common_request && r.requester_person_id === currentPersonId
  ).
  sort((a, b) => {
    const at = a.common_request_last_used_at ?
    new Date(a.common_request_last_used_at).getTime() :
    0;
    const bt = b.common_request_last_used_at ?
    new Date(b.common_request_last_used_at).getTime() :
    0;
    if (bt !== at) return bt - at;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Resubmit: create a fresh request copied from the template, bump its
  // last-used (never mutate the template otherwise).
  const handleResubmit = async (template: SupplyRequest) => {
    const tplItems = itemsFor(template.id);
    const newId = await addSupplyRequest({
      requester_person_id: currentPersonId ?? '',
      status: 'submitted',
      priority: template.priority,
      requested_date: new Date().toISOString(),
      notes: template.notes || undefined,
      is_common_request: false
    });
    if (!newId) return;
    await Promise.all(
      tplItems.map((it) =>
      addSupplyRequestItem({
        supply_request_id: newId,
        product_id: it.product_id ?? undefined,
        custom_item_name: it.custom_item_name ?? undefined,
        quantity: it.quantity,
        unit: it.unit,
        notes: it.notes ?? undefined
      })
      )
    );
    updateSupplyRequest(template.id, {
      common_request_last_used_at: new Date().toISOString()
    });
    setActiveTab('active');
  };
  // Remove: unsave the template (the original request stays in history).
  // Confirmation is handled by a ConfirmDialog (see removeCommonId state).
  const handleRemoveCommon = (template: SupplyRequest) => {
    setRemoveCommonId(template.id);
  };

  // Resolve a request's items into hero rows: resolved product/custom name plus
  // a preformatted quantity ("each" is implied, so it's shown as a bare number).
  const itemRowsFor = (requestId: string) =>
  supplyRequestItems.
  filter((i) => i.supply_request_id === requestId).
  map((item) => {
    const name =
    (item.product_id ?
    products.find((p) => p.id === item.product_id)?.name :
    item.custom_item_name) ||
    item.custom_item_name ||
    'Item';
    const qty =
    !item.unit || item.unit === 'each' ?
    `${item.quantity}` :
    `${item.quantity} ${item.unit}`;
    return { id: item.id, name, qty, notes: item.notes ?? undefined };
  });

  // One request row. Rendered via VirtualizedGrid (no per-item entrance
  // animation — it would replay each time a row scrolls back into view).
  const renderRequestCard = (request: SupplyRequest) => {
    const requester = people.find((p) => p.id === request.requester_person_id);
    const animal = request.requested_for_animal_id ?
    animals.find((a) => a.id === request.requested_for_animal_id) :
    null;
    return (
      <SupplyRequestCard
        request={request}
        items={itemRowsFor(request.id)}
        requesterName={
        requester ?
        `${requester.first_name} ${requester.last_name}` :
        'Unknown'
        }
        requesterPhoto={requester?.photo_url}
        animalName={animal ? animalDisplayName(animal) : undefined}
        canCancel={
        !!currentPersonId &&
        request.requester_person_id === currentPersonId &&
        request.status === 'submitted'
        }
        onOpen={() => setSelectedRequestId(request.id)}
        onCancel={() => setCancelId(request.id)} />);

  };
  return (
    <div className="space-y-6">
      <PillTabs
        value={activeTab}
        onChange={(k) => setActiveTab(k as typeof activeTab)}
        tabs={[
        { key: 'active', label: `Active (${activeRequests.length})` },
        { key: 'completed', label: 'History' },
        { key: 'common', label: `Common (${myCommonRequests.length})` }]} />

      {/* Filters apply to the Active & History lists, not the Common templates. */}
      {activeTab !== 'common' &&
      <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
          label="Requester"
          value={requesterFilter}
          options={requesterOptions}
          onChange={setRequesterFilter} />

          <FilterDropdown
          label="Priority"
          value={priorityFilter}
          options={PRIORITY_OPTIONS}
          onChange={setPriorityFilter} />

          <FilterDropdown
          label="Needed By"
          value={neededByFilter}
          options={NEEDED_BY_OPTIONS}
          onChange={setNeededByFilter} />

        </div>
      }

      {activeTab === 'common' ?
      myCommonRequests.length === 0 ?
      <Card className="p-12 text-center">
          <BookmarkIcon className="w-12 h-12 text-border mx-auto mb-4" />
          <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
            No common requests saved
          </h3>
          <p className="text-text-secondary">
            On the New Supply Request form, tick “Save as common request” to keep
            a reusable bundle here.
          </p>
        </Card> :

      <div className="grid gap-3">
          {myCommonRequests.map((req) =>
        <Card key={req.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BookmarkIcon className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="font-heading font-bold text-text-primary truncate">
                      {req.common_request_name?.trim() ||
                  summarizeItems(req.id) ||
                  'Common request'}
                    </h3>
                  </div>
                  <p className="text-sm text-text-secondary mt-1 truncate">
                    {summarizeItems(req.id) || 'No items'}
                  </p>
                  <p className="text-xs text-text-secondary/80 mt-0.5">
                    {req.common_request_last_used_at ?
                `Last used ${formatDate(req.common_request_last_used_at)}` :
                'Not used yet'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                size="sm"
                onClick={() => handleResubmit(req)}
                className="gap-1.5">

                    <RepeatIcon className="w-4 h-4" />
                    Resubmit
                  </Button>
                  <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveCommon(req)}
                className="gap-1.5 text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60">

                    <Trash2Icon className="w-4 h-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
        )}
        </div> :
      activeTab === 'completed' && !supplyHistoryLoaded ?
      <Card className="p-12 text-center">
          <p className="text-text-secondary">Loading history…</p>
        </Card> :
      displayRequests.length === 0 ?
      filtersActive ?
      <Card className="p-12 text-center">
          <PackageOpenIcon className="w-12 h-12 text-border mx-auto mb-4" />
          <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
            No matching requests
          </h3>
          <p className="text-text-secondary">
            No requests match the current filters.
          </p>
        </Card> :
      activeTab === 'active' ?
      <GuidanceEmptyState
        guidanceKey="supply_empty"
        fallback={{
          title: 'No active requests',
          body: 'All caught up! Fosters and animals have what they need.'
        }} /> :

      <Card className="p-12 text-center">
          <PackageOpenIcon className="w-12 h-12 text-border mx-auto mb-4" />
          <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
            No completed requests
          </h3>
          <p className="text-text-secondary">No completed requests yet.</p>
        </Card> :

      <VirtualizedGrid
        items={displayRequests}
        columns={1}
        gap={16}
        estimateRowHeight={150}
        getKey={(r) => r.id}
        renderItem={renderRequestCard} />

      }

      <SupplyRequestDetailModal
        isOpen={!!selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
        requestId={selectedRequestId} />

      {cancelId && (() => {
        const copy = cancelRequestConfirm('supply request');
        return (
          <ConfirmDialog
            isOpen={true}
            onClose={() => setCancelId(null)}
            onConfirm={() => {
              updateSupplyRequest(cancelId, { status: 'cancelled' });
              setCancelId(null);
            }}
            title={copy.title}
            confirmLabel={copy.confirmLabel}
            cancelLabel={copy.cancelLabel}
            tone={copy.tone}>

            {copy.body}
          </ConfirmDialog>);

      })()}

      {removeCommonId &&
      <ConfirmDialog
        isOpen={true}
        onClose={() => setRemoveCommonId(null)}
        onConfirm={() => {
          updateSupplyRequest(removeCommonId, { is_common_request: false });
          setRemoveCommonId(null);
        }}
        title="Remove common request?"
        confirmLabel="Remove"
        cancelLabel="Keep"
        tone="danger">

          The original request stays in your history.
        </ConfirmDialog>
      }
    </div>);

}
