import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select, Textarea, Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { useWhisker } from '../../context/WhiskerContext';
import { Animal } from '../../types';
import { animalDisplayName } from '../../lib/utils';
import { track } from '../../lib/analytics';

interface RequestReassignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  animal: Animal;
}

// Reasons an assigned foster might ask a coordinator to find a new placement.
const REASONS = [
'Moving',
'Capacity constraints',
'Unable to continue volunteering',
'Traveling',
'Health',
'Behavioral concerns',
'Other'] as
const;

/**
 * The assigned foster can't reassign themselves (that's a manager action). This
 * modal lets them flag that the animal needs a new placement. It records the
 * request as an open action item (so it surfaces in the Action Needed banner and
 * admin views) plus a timeline note capturing the reason / desired date — no new
 * table; same primitives the rest of the app uses.
 */
export function RequestReassignmentModal({
  isOpen,
  onClose,
  animal
}: RequestReassignmentModalProps) {
  const { actionItems, addActionItem, addNote } = useWhisker();
  const [reason, setReason] = useState<(typeof REASONS)[number]>('Moving');
  const [note, setNote] = useState('');
  const [desiredDate, setDesiredDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('Moving');
      setNote('');
      setDesiredDate('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const datePart = desiredDate ? `, desired by ${desiredDate}` : '';
    // At most one open action item per animal — if one already exists, just log
    // the note rather than colliding with the partial-unique constraint.
    const hasOpenItem = actionItems.some(
      (a) => a.animal_id === animal.id && a.status === 'open'
    );
    if (!hasOpenItem) {
      addActionItem({
        animal_id: animal.id,
        description: `Foster reassignment requested — ${reason}${datePart}`,
        priority: 'needs_attention'
      });
    }
    const bodyParts = [`Foster reassignment requested. Reason: ${reason}.`];
    if (desiredDate) bodyParts.push(`Desired date: ${desiredDate}.`);
    if (note.trim()) bodyParts.push(note.trim());
    addNote({
      animal_id: animal.id,
      author_name: 'Current User',
      note_type: 'general',
      body: bodyParts.join(' ')
    });
    track('reassignment_requested', { animal_id: animal.id });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Request reassignment — ${animalDisplayName(animal)}`}
      size="md"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="request-reassignment-form">
            Submit Request
          </Button>
        </div>
      }>

      <form
        id="request-reassignment-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-4">

        <p className="text-sm text-text-secondary">
          A coordinator will be notified to arrange a new foster. This doesn't
          change the placement on its own.
        </p>

        <div>
          <Label htmlFor="reassign_reason" required>Reason</Label>
          <Select
            id="reassign_reason"
            value={reason}
            onChange={(e) =>
            setReason(e.target.value as (typeof REASONS)[number])
            }>

            {REASONS.map((r) =>
            <option key={r} value={r}>{r}</option>
            )}
          </Select>
        </div>

        <div>
          <Label htmlFor="reassign_date">Desired date (optional)</Label>
          <DatePicker
            id="reassign_date"
            value={desiredDate}
            onChange={setDesiredDate} />
        </div>

        <div>
          <Label htmlFor="reassign_note">Note (optional)</Label>
          <Textarea
            id="reassign_note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the coordinator should know…"
            rows={3} />
        </div>
      </form>
    </Modal>);

}
