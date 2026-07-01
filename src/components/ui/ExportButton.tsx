import { useEffect, useState } from 'react';
import { DownloadIcon, CheckIcon } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { CsvColumn, downloadCsv } from '../../lib/csv';
import { useIsAdmin } from '../../lib/useIsAdmin';
import { cn } from '../../lib/utils';

interface ExportButtonProps<T> {
  /** Title-case entity name for the dialog title, e.g. "Animals". */
  entityLabel: string;
  /** Lowercase plural noun used in counts, e.g. "animals", "foster parents". */
  noun: string;
  /** Filename stem: whiskerville-<filenameBase>-<scope>-<date>.csv */
  filenameBase: string;
  columns: CsvColumn<T>[];
  /** Rows currently visible (after the page's filters/sort/tabs). */
  current: T[];
  /** Org-complete rows. Only read once `allComplete` is true. */
  allRows: T[];
  /** Org total, known up front (from the lightweight index). */
  allCount: number;
  /**
   * Whether `allRows` actually holds every row yet. Collections that load their
   * full set up front (medical, clinics) pass true; scoped ones (animals,
   * contacts, fosters) pass their loaded flag and an `ensureAllLoaded` loader.
   */
  allComplete?: boolean;
  /** Loads the remaining rows into the page's collection when "All" is chosen. */
  ensureAllLoaded?: () => Promise<void>;
  /** Extra classes for the trigger button (e.g. compact in a filter row). */
  triggerClassName?: string;
}

type Scope = 'current' | 'all';

// Admin-only export. The button opens a dialog so the user explicitly chooses
// between the current filtered view and the whole organization — the previous
// silent "export whatever's filtered" was unclear. Renders nothing for
// non-admins.
export function ExportButton<T>({
  entityLabel,
  noun,
  filenameBase,
  columns,
  current,
  allRows,
  allCount,
  allComplete = true,
  ensureAllLoaded,
  triggerClassName
}: ExportButtonProps<T>) {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>('current');
  // True while the full org dataset is being fetched for an "All" export. The
  // actual download happens in the effect below, once `allComplete` flips true
  // and the page has re-rendered with the complete `allRows`.
  const [pendingAll, setPendingAll] = useState(false);

  useEffect(() => {
    if (pendingAll && allComplete) {
      downloadCsv(`${filenameBase}-all`, columns, allRows);
      setPendingAll(false);
      setOpen(false);
      setScope('current');
    }
  }, [pendingAll, allComplete, allRows, columns, filenameBase]);

  if (!isAdmin) return null;

  const close = () => {
    setOpen(false);
    setPendingAll(false);
    setScope('current');
  };

  // When the current view already shows every org row (e.g. historical toggle on,
  // no filters), the two options are identical — collapse to a single confirm and
  // export `current`, which by definition holds the full set.
  const currentIsAll = allCount > 0 && current.length === allCount;

  const handleExport = () => {
    if (currentIsAll) {
      downloadCsv(`${filenameBase}-all`, columns, current);
      close();
      return;
    }
    if (scope === 'current') {
      downloadCsv(`${filenameBase}-current-view`, columns, current);
      close();
      return;
    }
    if (allComplete) {
      downloadCsv(`${filenameBase}-all`, columns, allRows);
      close();
    } else {
      // Load the rest, then the effect fires once the data is in.
      setPendingAll(true);
      ensureAllLoaded?.();
    }
  };

  const noData = currentIsAll ?
  current.length === 0 :
  scope === 'current' ?
  current.length === 0 :
  allCount === 0;

  return (
    <>
      <Button
        variant="soft"
        onClick={() => setOpen(true)}
        className={cn('gap-2', triggerClassName)}>

        <DownloadIcon className="w-4 h-4" />
        Export
      </Button>

      <Modal
        isOpen={open}
        onClose={close}
        title={`Export ${entityLabel}`}
        footer={
        <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={pendingAll}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={pendingAll || noData}>
              {pendingAll ? 'Exporting…' : 'Export'}
            </Button>
          </div>
        }>

        {currentIsAll ?
        <p className="text-sm text-text-secondary">
            This will export all {allCount} {noun} in your organization.
          </p> :

        <>
            <p className="text-sm text-text-secondary mb-3">
              What do you want to export?
            </p>
            <div className="space-y-2">
              <ScopeOption
              selected={scope === 'current'}
              onSelect={() => setScope('current')}
              title="Current view"
              description={`${current.length} ${noun} matching your current filters`} />

              <ScopeOption
              selected={scope === 'all'}
              onSelect={() => setScope('all')}
              title={`All ${noun}`}
              description={`${allCount} ${noun} in this organization`} />

            </div>
          </>
        }
      </Modal>
    </>);

}

interface ScopeOptionProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}
function ScopeOption({
  selected,
  onSelect,
  title,
  description
}: ScopeOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-3 text-left p-3 rounded-xl border transition-colors',
        selected ?
        'border-primary bg-primary/5' :
        'border-border bg-card hover:bg-background'
      )}>

      <span
        className={cn(
          'mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
          selected ? 'border-primary bg-primary text-white' : 'border-border'
        )}>

        {selected && <CheckIcon className="w-3 h-3" />}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-text-primary">{title}</span>
        <span className="block text-sm text-text-secondary">{description}</span>
      </span>
    </button>);

}
