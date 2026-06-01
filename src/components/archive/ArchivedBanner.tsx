import { useState } from 'react';
import { ArchiveIcon, RotateCcwIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { useCanRestore } from './useCanArchive';
import { ArchiveTable, Person } from '../../types';
import { formatDate } from '../../lib/utils';

interface Props {
  table: ArchiveTable;
  id: string;
  deletedAt?: string | null;
  /** auth.users.id of the person who archived the record. */
  deletedBy?: string | null;
  /** Loaded people roster — used to resolve a name for the archiver. */
  people: Person[];
  /** Optional callback fired after a successful restore (e.g. dismiss banner). */
  onRestored?: () => void;
}

/**
 * Sits at the top of a detail page when the record being viewed is archived.
 * The page is expected to disable its own action buttons / forms; the banner
 * only owns the "this is archived" callout and the Restore action.
 */
export function ArchivedBanner({
  table,
  id,
  deletedAt,
  deletedBy,
  people,
  onRestored
}: Props) {
  const { restoreRecord } = useWhisker();
  const canRestore = useCanRestore(deletedBy);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // people.user_id is the auth.users.id; match against deletedBy.
  const archiver = deletedBy ?
  people.find((p) => p.user_id === deletedBy) :
  undefined;
  const archiverName = archiver ?
  `${archiver.first_name} ${archiver.last_name}` :
  'an admin';

  const handleRestore = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await restoreRecord(table, id);
      onRestored?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#E5E2DC] bg-[#F3EFEA] p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-white/60 text-[#6B6B6B] shrink-0">
        <ArchiveIcon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text-primary">
          This record has been archived.
        </p>
        <p className="text-sm text-text-secondary mt-0.5">
          Archived by {archiverName}
          {deletedAt && ` on ${formatDate(deletedAt)}`}. It is hidden from
          lists; restore it to bring it back.
        </p>
        {error &&
        <p className="text-sm text-[#9B3A3A] mt-2">{error}</p>
        }
      </div>
      {canRestore &&
      <Button
        size="sm"
        variant="outline"
        onClick={handleRestore}
        disabled={submitting}
        className="shrink-0">

          <RotateCcwIcon className="w-4 h-4 mr-1.5" />
          {submitting ? 'Restoring…' : 'Restore'}
        </Button>
      }
    </div>);

}
