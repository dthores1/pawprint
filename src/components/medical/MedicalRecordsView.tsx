import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Input } from '../ui/Forms';
import { Avatar } from '../ui/Avatar';
import { SpeciesBadge } from '../ui/SpeciesBadge';
import { MultiFilterDropdown } from '../ui/MultiFilterDropdown';
import { FilterOption } from '../ui/FilterDropdown';
import {
  SortableHeader,
  SortState,
  nextSort,
  sortItems } from
'../ui/SortableHeader';
import { SearchIcon, XIcon } from 'lucide-react';
import { MedicalKitIcon } from '../ui/MedicalKitIcon';
import { formatDate, animalDisplayName } from '../../lib/utils';
import { useWindowRowVirtualizer } from '../../lib/useWindowRowVirtualizer';
import {
  PROCEDURE_TYPE_LABELS,
  PROCEDURE_TYPE_OPTIONS,
  PROCEDURE_LABELS } from
'../../lib/medicalOptions';
import { IN_CARE_STATUSES } from '../../lib/animalStatus';
import { ExportButton } from '../ui/ExportButton';
import { CsvColumn } from '../../lib/csv';
import { MedicalRecord, MedicalStatus } from '../../types';

// Stable string[] of in-care statuses for membership checks (module scope so
// it doesn't churn the filter memo each render).
const IN_CARE_SET: string[] = IN_CARE_STATUSES;

// Status pill tones — mirrors the medical timeline on the animal profile so a
// record reads identically in both places.
const STATUS_TONE: Record<MedicalStatus, { wrap: string; label: string }> = {
  completed: { wrap: 'bg-[#DDEFE2] text-[#3E7B52]', label: 'Completed' },
  scheduled: { wrap: 'bg-[#DCEAF7] text-[#356A9A]', label: 'Scheduled' },
  due: { wrap: 'bg-[#F8E7C8] text-[#A36B00]', label: 'Due' },
  overdue: { wrap: 'bg-[#F5D7D7] text-[#9B3A3A]', label: 'Overdue' },
  cancelled: {
    wrap: 'bg-background text-text-secondary border border-border',
    label: 'Cancelled'
  },
  not_applicable: {
    wrap: 'bg-background text-text-secondary border border-border',
    label: 'N/A'
  }
};
const STATUS_OPTIONS: FilterOption[] = (
  Object.keys(STATUS_TONE) as MedicalStatus[]).
map((s) => ({ value: s, label: STATUS_TONE[s].label }));

// The structured subtype, falling back to the free-text custom name.
function subtypeLabel(r: MedicalRecord): string {
  if (r.procedure && r.procedure !== 'other') return PROCEDURE_LABELS[r.procedure];
  return (r.custom_procedure_name ?? '').trim() || '—';
}

// Sort key for the status column — lifecycle-ish ordering (active first).
const STATUS_ORDER: MedicalStatus[] = [
'overdue',
'due',
'scheduled',
'completed',
'cancelled',
'not_applicable'];

export function MedicalRecordsView() {
  const { medicalRecords, animalsIndex: animals } = useWhisker();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  // Off by default: show only records for animals currently in care. Turning it
  // on includes records for historical animals (adopted/released/deceased).
  // medicalRecords + animalsIndex already hold every row, so this is a pure
  // client-side filter — no extra fetch needed.
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);
  const onSort = (key: string) => setSort((cur) => nextSort(cur, key));

  // animal_id → index entry, for name/photo/species resolution.
  const animalById = useMemo(() => {
    const m = new Map<string, (typeof animals)[number]>();
    for (const a of animals) m.set(a.id, a);
    return m;
  }, [animals]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return medicalRecords.filter((r) => {
      const animal = animalById.get(r.animal_id);
      // Default view is in-care only. Records for historical animals (and any
      // orphaned record whose animal can't be resolved) only show once the
      // "Show Historical Animals" toggle is on.
      const matchesInCare =
      includeHistorical || (animal ? IN_CARE_SET.includes(animal.status) : false);
      const matchesSearch =
      !q ||
      (animal ? animalDisplayName(animal).toLowerCase().includes(q) : false) ||
      (animal?.rescue_id ?? '').toLowerCase().includes(q) ||
      r.procedure_name.toLowerCase().includes(q) ||
      subtypeLabel(r).toLowerCase().includes(q);
      const matchesType =
      typeFilter.length === 0 || typeFilter.includes(r.procedure_type);
      const matchesStatus =
      statusFilter.length === 0 || statusFilter.includes(r.status);
      return matchesInCare && matchesSearch && matchesType && matchesStatus;
    });
  }, [
  medicalRecords,
  animalById,
  searchQuery,
  typeFilter,
  statusFilter,
  includeHistorical]);

  const sorted = useMemo(() => {
    const getValue = (r: MedicalRecord): string | number | null => {
      switch (sort?.key) {
        case 'animal': {
          const a = animalById.get(r.animal_id);
          return a ? animalDisplayName(a).toLowerCase() : '';
        }
        case 'type':
          return PROCEDURE_TYPE_LABELS[r.procedure_type] || r.procedure_type;
        case 'subtype':
          return subtypeLabel(r).toLowerCase();
        case 'date':
          return r.performed_date ? new Date(r.performed_date).getTime() : null;
        case 'status':
          return STATUS_ORDER.indexOf(r.status);
        default:
          return null;
      }
    };
    if (!sort) {
      // Default: most recently performed (or due) first.
      return [...filtered].sort((a, b) => {
        const at = new Date(a.performed_date || a.due_date || 0).getTime();
        const bt = new Date(b.performed_date || b.due_date || 0).getTime();
        return bt - at;
      });
    }
    return sortItems(filtered, getValue, sort.dir);
  }, [filtered, sort, animalById]);

  const tableRows = useWindowRowVirtualizer(sorted.length, 73);

  const clearAll = () => {
    setTypeFilter([]);
    setStatusFilter([]);
  };
  const hasFilters = typeFilter.length > 0 || statusFilter.length > 0;

  // CSV export columns for the current records view (animal resolved via index).
  const recordCsvColumns: CsvColumn<MedicalRecord>[] = [
  { header: 'Animal', value: (r) => {
      const a = animalById.get(r.animal_id);
      return a ? animalDisplayName(a) : '';
    } },
  { header: 'Rescue ID', value: (r) => animalById.get(r.animal_id)?.rescue_id },
  { header: 'Type', value: (r) => PROCEDURE_TYPE_LABELS[r.procedure_type] || r.procedure_type },
  { header: 'Subtype', value: (r) => {
      const s = subtypeLabel(r);
      return s === '—' ? '' : s;
    } },
  { header: 'Date Performed', value: (r) => r.performed_date },
  { header: 'Due Date', value: (r) => r.due_date },
  { header: 'Status', value: (r) => (STATUS_TONE[r.status] || STATUS_TONE.cancelled).label },
  { header: 'Provider', value: (r) => r.provider_name },
  { header: 'Facility', value: (r) => r.facility_name },
  { header: 'Notes', value: (r) => r.notes }];

  return (
    <div className="space-y-5">
      {/* Search — dominant, full width */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
        <Input
          placeholder="Search by animal, procedure, or subtype…"
          className="pl-11 h-12 text-base"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} />

        {searchQuery &&
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
          aria-label="Clear search">

            <XIcon className="w-4 h-4" />
          </button>
        }
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiFilterDropdown
          label="Type"
          values={typeFilter}
          options={PROCEDURE_TYPE_OPTIONS as unknown as FilterOption[]}
          onChange={setTypeFilter} />

        <MultiFilterDropdown
          label="Status"
          values={statusFilter}
          options={STATUS_OPTIONS}
          onChange={setStatusFilter} />

        {hasFilters &&
        <button
          type="button"
          onClick={clearAll}
          className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors px-2 h-7 rounded-full hover:bg-background">

            Clear all
          </button>
        }

        {/* Show Historical Animals — expands the list to records for adopted/
            released/deceased animals. Off by default. */}
        <label className="ml-auto inline-flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm font-medium border border-border bg-card cursor-pointer select-none hover:bg-background transition-colors">
          <input
            type="checkbox"
            checked={includeHistorical}
            onChange={(e) => setIncludeHistorical(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer" />

          <span className="text-text-secondary">Show Historical Animals</span>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 -mt-1">
        <ExportButton
          entityLabel="Medical Records"
          noun="medical records"
          filenameBase="medical-records"
          columns={recordCsvColumns}
          current={sorted}
          allRows={medicalRecords}
          allCount={medicalRecords.length}
          triggerClassName="h-9 text-sm px-3" />
        <span className="text-xs text-text-secondary">
          {sorted.length} {sorted.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      <Card className="overflow-hidden">
        <div
          ref={tableRows.scrollRef}
          className="overflow-auto"
          style={{ maxHeight: '70vh' }}>
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-background text-sm font-medium text-text-secondary">
                <SortableHeader label="Animal" sortKey="animal" sort={sort} onSort={onSort} />
                <SortableHeader label="Type" sortKey="type" sort={sort} onSort={onSort} />
                <SortableHeader label="Subtype" sortKey="subtype" sort={sort} onSort={onSort} />
                <SortableHeader label="Date Performed" sortKey="date" sort={sort} onSort={onSort} />
                <SortableHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ?
              <tr>
                  <td colSpan={5} className="py-12 text-center text-text-secondary">
                    <div className="flex flex-col items-center gap-3">
                      <MedicalKitIcon className="w-10 h-10 text-text-secondary/30" />
                      <p>No medical records found.</p>
                    </div>
                  </td>
                </tr> :

              <>
                  {tableRows.paddingTop > 0 &&
                <tr aria-hidden="true">
                      <td
                    colSpan={5}
                    style={{ height: tableRows.paddingTop, padding: 0, border: 0 }} />

                    </tr>
                }
                  {tableRows.virtualRows.map((vr) => {
                  const r = sorted[vr.index];
                  const animal = animalById.get(r.animal_id);
                  const tone = STATUS_TONE[r.status] || STATUS_TONE.cancelled;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border hover:bg-background/60 transition-colors group">

                      <td className="py-4 px-6">
                        {animal ?
                        <div className="flex items-center gap-4">
                            <Link
                            to={`/animals/${animal.id}`}
                            className="relative shrink-0">

                              <Avatar
                              src={animal.primary_photo_url}
                              type="animal"
                              species={animal.species} />

                              <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                                <SpeciesBadge species={animal.species} />
                              </div>
                            </Link>
                            <Link
                            to={`/animals/${animal.id}`}
                            className="font-medium text-text-primary group-hover:text-primary transition-colors">

                              {animalDisplayName(animal)}
                            </Link>
                          </div> :

                        <span className="text-sm text-text-secondary">Unknown animal</span>
                        }
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-text-primary">
                          {PROCEDURE_TYPE_LABELS[r.procedure_type] ||
                          r.procedure_type}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-text-secondary">
                          {subtypeLabel(r)}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        {r.performed_date ?
                        <p className="text-sm text-text-primary">
                            {formatDate(r.performed_date)}
                          </p> :
                        r.status === 'completed' ?
                        <p className="text-sm italic text-text-secondary">
                            Date unknown
                          </p> :

                        <p className="text-sm text-text-primary">—</p>
                        }
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tone.wrap}`}>

                          {tone.label}
                        </span>
                      </td>
                    </tr>);

                })}
                  {tableRows.paddingBottom > 0 &&
                <tr aria-hidden="true">
                      <td
                    colSpan={5}
                    style={{ height: tableRows.paddingBottom, padding: 0, border: 0 }} />

                    </tr>
                }
                </>
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>);

}
