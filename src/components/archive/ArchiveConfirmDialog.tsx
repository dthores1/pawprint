import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AlertTriangleIcon, Trash2Icon } from 'lucide-react';
import { ArchiveTable } from '../../types';
import { useWhisker } from '../../context/WhiskerContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Which DB table the record belongs to. Drives the archive_record RPC call. */
  table: ArchiveTable;
  /** UUID of the record to archive. */
  id: string;
  /**
   * Human-readable label for what's being archived, e.g. "this note" or "Niki".
   * Shown verbatim in the body and confirmation button.
   */
  entityLabel: string;
  /**
   * Singular noun for the record type, e.g. "note", "animal", "clinic".
   * Used for the dialog title ("Archive note?").
   */
  typeLabel: string;
  /** Optional callback fired after a successful archive. */
  onArchived?: () => void;
}

export function ArchiveConfirmDialog({
  isOpen,
  onClose,
  table,
  id,
  entityLabel,
  typeLabel,
  onArchived
}: Props) {
  const { archiveRecord } = useWhisker();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await archiveRecord(table, id);
      onArchived?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Archive ${typeLabel}?`}
      footer={
      <div className="flex justify-end gap-3">
          <Button
          type="button"
          variant="ghost"
          onClick={handleClose}
          disabled={submitting}>
            Cancel
          </Button>
          <Button
          type="button"
          variant="danger"
          onClick={handleConfirm}
          disabled={submitting}>
            <Trash2Icon className="w-4 h-4 mr-1.5" />
            {submitting ? 'Archiving…' : `Archive ${typeLabel}`}
          </Button>
        </div>
      }>

      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F8E7C8] bg-[#FFF7E6] text-sm text-[#A36B00]">
          <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              Archive <span className="font-semibold">{entityLabel}</span>?
            </p>
            <p className="mt-1 text-xs">
              This {typeLabel} will be hidden from lists but can be restored from
              the Recycle Bin later.
            </p>
          </div>
        </div>

        {error &&
        <p className="text-sm text-[#9B3A3A] bg-[#FBE9E9] border border-[#F5D7D7] rounded-lg px-3 py-2">
            {error}
          </p>
        }
      </div>
    </Modal>);

}
