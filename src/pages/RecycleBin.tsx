import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWhisker } from '../context/WhiskerContext';
import { useAuth } from '../context/AuthContext';
import { useCanRestore } from '../components/archive/useCanArchive';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Trash2Icon, RotateCcwIcon, RefreshCwIcon } from 'lucide-react';
import { ArchivedRecord, ArchiveTable } from '../types';
import { cn, formatDate } from '../lib/utils';

// Map list_archived's `record_type` → the ArchiveTable name the RPCs expect
// (singular → plural). Also provides a friendly label for the type column.
const TYPE_META: Record<
  string,
  { table: ArchiveTable; label: string }> =
  {
    animal: { table: 'animals', label: 'Animal' },
    animal_note: { table: 'animal_notes', label: 'Note' },
    animal_photo: { table: 'animal_photos', label: 'Photo' },
    animal_action_item: { table: 'animal_action_items', label: 'Action item' },
    animal_relationship: { table: 'animal_relationships', label: 'Relationship' },
    person: { table: 'people', label: 'Person' },
    medical_record: { table: 'medical_records', label: 'Medical record' },
    foster_placement: { table: 'foster_placements', label: 'Foster placement' },
    clinic_event: { table: 'clinic_events', label: 'Clinic' },
    clinic_slot: { table: 'clinic_slots', label: 'Clinic slot' },
    clinic_slot_procedure: { table: 'clinic_slot_procedures', label: 'Procedure' },
    litter: { table: 'litters', label: 'Litter' },
    adoption: { table: 'adoptions', label: 'Adoption' },
    product: { table: 'products', label: 'Product' },
    supply_request: { table: 'supply_requests', label: 'Supply request' },
    supply_request_item: { table: 'supply_request_items', label: 'Supply item' },
    transport_request: { table: 'transport_requests', label: 'Transport' },
    sitting_request: { table: 'sitting_requests', label: 'Sitting request' },
    sitting_request_placement: {
      table: 'sitting_request_placements',
      label: 'Sitting placement'
    }
  };

export function RecycleBin() {
  const { fetchArchived, people } = useWhisker();
  const { currentOrg } = useAuth();
  const [items, setItems] = useState<ArchivedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchArchived();
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [fetchArchived]);

  useEffect(() => {
    if (currentOrg) reload();
  }, [currentOrg, reload]);

  // Map auth.uid → person name for the "Archived by" column. people.user_id
  // links a Person row to a Supabase auth user.
  const nameForUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) {
      if (p.user_id) m.set(p.user_id, `${p.first_name} ${p.last_name}`);
    }
    return m;
  }, [people]);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of items) c.set(r.record_type, (c.get(r.record_type) ?? 0) + 1);
    return c;
  }, [items]);

  const visible = typeFilter ?
  items.filter((r) => r.record_type === typeFilter) :
  items;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <Trash2Icon className="w-8 h-8 text-primary" />
            Recycle Bin
          </h1>
          <p className="text-text-secondary mt-1">
            Archived records across the whole organization. Restore brings a
            record back into its list and detail page.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCwIcon className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Type filter chips */}
      {items.length > 0 &&
      <div className="flex flex-wrap gap-2">
          <FilterChip
          active={typeFilter === null}
          onClick={() => setTypeFilter(null)}
          label="All"
          count={items.length} />

          {Array.from(counts.entries()).
        sort((a, b) => b[1] - a[1]).
        map(([type, n]) =>
        <FilterChip
          key={type}
          active={typeFilter === type}
          onClick={() => setTypeFilter(type)}
          label={TYPE_META[type]?.label ?? type}
          count={n} />

        )}
        </div>
      }

      {error &&
      <Card className="p-4 text-sm text-[#9B3A3A] bg-[#FBE9E9] border-[#F5D7D7]">
          {error}
        </Card>
      }

      {!loading && items.length === 0 ?
      <Card className="p-10 text-center text-text-secondary">
          <Trash2Icon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">Nothing here</p>
          <p className="text-sm">Archived records will appear in this bin.</p>
        </Card> :

      <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background/60 text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Archived by</th>
                <th className="text-left px-4 py-3 font-semibold">Archived at</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((r) =>
            <Row
              key={`${r.record_type}:${r.record_id}`}
              row={r}
              archiverName={
              r.deleted_by ? nameForUserId.get(r.deleted_by) ?? null : null
              }
              onRestored={reload}
              onRestoreError={setError} />

            )}
            </tbody>
          </table>
        </Card>
      }
    </div>);

}

function FilterChip({
  active,
  onClick,
  label,
  count
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
        active ?
        'bg-primary text-white border-primary' :
        'bg-white text-text-secondary border-border hover:border-primary/40'
      )}>

      {label}
      <span className={cn('tabular-nums', active ? 'opacity-90' : 'opacity-60')}>
        {count}
      </span>
    </button>);

}

function Row({
  row,
  archiverName,
  onRestored,
  onRestoreError
}: {
  row: ArchivedRecord;
  archiverName: string | null;
  onRestored: () => void;
  onRestoreError: (msg: string) => void;
}) {
  const { restoreRecord } = useWhisker();
  const canRestore = useCanRestore(row.deleted_by);
  const [submitting, setSubmitting] = useState(false);
  const meta = TYPE_META[row.record_type];

  const handleRestore = async () => {
    if (!meta) return;
    setSubmitting(true);
    try {
      await restoreRecord(meta.table, row.record_id);
      onRestored();
    } catch (e) {
      onRestoreError(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <tr className="hover:bg-background/40 transition-colors">
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-background text-text-secondary border border-border">
          {meta?.label ?? row.record_type}
        </span>
      </td>
      <td className="px-4 py-3 text-text-primary">
        <span className="truncate block max-w-md">{row.display_name}</span>
      </td>
      <td className="px-4 py-3 text-text-secondary">
        {archiverName ?? '—'}
      </td>
      <td className="px-4 py-3 text-text-secondary tabular-nums">
        {formatDate(row.deleted_at)}
      </td>
      <td className="px-4 py-3 text-right">
        {canRestore &&
        <button
          type="button"
          onClick={handleRestore}
          disabled={submitting}
          aria-label={submitting ? 'Restoring…' : 'Restore'}
          title={submitting ? 'Restoring…' : 'Restore'}
          className="group inline-flex items-center justify-center p-1.5 rounded-md text-text-secondary hover:text-primary hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed">

            <RotateCcwIcon
            className={cn(
              'w-4 h-4 transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)]',
              submitting ?
              'animate-spin' :
              'group-hover:-rotate-[360deg]'
            )} />

          </button>
        }
      </td>
    </tr>);

}
