import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Label, Select, Textarea, FieldError } from '../ui/Forms';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { animalDisplayName } from '../../lib/utils';
import { focusFirstError } from '../../lib/focusFirstError';
import {
  ADOPTION_RETURN_REASONS,
  ADOPTION_RETURN_REASON_LABELS } from
'../../lib/adoptions';
import { AdoptionReturnReason } from '../../types';
import { track } from '../../lib/analytics';

interface AdoptionReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}

// Today as a local `yyyy-MM-dd` (what DatePicker expects). Stored verbatim — no
// time component — so it never shifts across timezones on display.
function todayLocalDate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

// Records the return of an adopted animal. If a completed adoption record exists
// it's flipped to `returned`; otherwise we capture the original adopter inline
// and create the (already-returned) record. Either way the animal re-enters care.
export function AdoptionReturnModal({
  isOpen,
  onClose,
  animalId
}: AdoptionReturnModalProps) {
  const {
    animals,
    peopleIndex: people,
    adoptions,
    returnAdoption,
    recordAdoptionReturn
  } = useWhisker();
  const animal = animals.find((a) => a.id === animalId);

  // The most recent completed adoption is the one we reverse. Sort by the
  // completion timestamp (falling back to created_at) so "latest" is reliable.
  const completedAdoption = useMemo(() => {
    return adoptions.
    filter((a) => a.animal_id === animalId && a.status === 'completed').
    sort((a, b) =>
    (b.completed_at ?? b.created_at).localeCompare(
      a.completed_at ?? a.created_at
    )
    )[0];
  }, [adoptions, animalId]);
  const hasRecord = Boolean(completedAdoption);

  const [returnedAt, setReturnedAt] = useState('');
  const [reason, setReason] = useState<AdoptionReturnReason | ''>('');
  const [notes, setNotes] = useState('');
  const [adopterId, setAdopterId] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // Initialize on open; clear on close.
  useEffect(() => {
    if (!isOpen) {
      setReturnedAt('');
      setReason('');
      setNotes('');
      setAdopterId('');
      setError(undefined);
      setSubmitting(false);
      return;
    }
    setReturnedAt(todayLocalDate());
    // Prefill the adopter with the animal's recorded adopter when we have one.
    setAdopterId(animal?.adopted_by_id ?? '');
  }, [isOpen, animal?.adopted_by_id]);

  if (!animal) return null;

  // Directory contacts only (exclude app-user self records) for the picker.
  const directory = people.filter((p) => !p.user_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnedAt) {
      setError('A return date is required.');
      requestAnimationFrame(() => focusFirstError(['returned_at']));
      return;
    }
    if (!reason) {
      setError('A return reason is required.');
      requestAnimationFrame(() => focusFirstError(['return_reason']));
      return;
    }
    if (!hasRecord && !adopterId) {
      setError('Select the original adopter.');
      requestAnimationFrame(() => focusFirstError(['return_adopter']));
      return;
    }
    setSubmitting(true);
    // Stored as a date-only string (timestamptz column casts it to midnight) so
    // the displayed day never shifts across timezones.
    if (hasRecord) {
      returnAdoption(completedAdoption.id, {
        returned_at: returnedAt,
        return_reason: reason,
        return_notes: notes.trim() || undefined
      });
    } else {
      await recordAdoptionReturn({
        animal_id: animal.id,
        adopter_id: adopterId,
        returned_at: returnedAt,
        return_reason: reason,
        return_notes: notes.trim() || undefined
      });
    }
    track('adoption_returned', { animal_id: animal.id });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Adoption Return for ${animalDisplayName(animal)}`}
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
          type="submit"
          form="adoption-return-form"
          disabled={submitting}>
            {submitting ? 'Recording…' : 'Record Return'}
          </Button>
        </div>
      }>

      <form id="adoption-return-form" onSubmit={handleSubmit} className="space-y-5">
        {hasRecord ?
        <p className="text-sm text-text-secondary">
            Record this return against the completed adoption on file. Once saved,{' '}
            {animalDisplayName(animal)} comes back into care for reassessment.
          </p> :

        <p className="text-sm text-text-secondary">
            Before recording this return, we need the original adoption
            information for {animalDisplayName(animal)}.
          </p>
        }

        {!hasRecord &&
        <>
            <div>
              <Label>Animal</Label>
              <div className="flex h-11 w-full items-center rounded-lg border border-border bg-background px-3.5 text-sm text-text-secondary">
                {animalDisplayName(animal)}
              </div>
            </div>
            <div id="return_adopter" style={{ scrollMarginTop: '1rem' }}>
              <Label required>Adopter</Label>
              <PersonSearchPicker
              people={directory}
              value={adopterId}
              onChange={(id) => {
                setAdopterId(id);
                setError(undefined);
              }}
              placeholder="Search contacts by name or email…" />

            </div>
            <div>
              <Label>Adoption status</Label>
              <div className="flex h-11 w-full items-center rounded-lg border border-border bg-background px-3.5 text-sm text-text-secondary">
                Returned
              </div>
            </div>
          </>
        }

        <div>
          <Label htmlFor="returned_at" required>Returned on</Label>
          <DatePicker
            id="returned_at"
            required
            value={returnedAt}
            onChange={(v) => {
              setReturnedAt(v);
              setError(undefined);
            }} />

        </div>

        <div>
          <Label htmlFor="return_reason" required>Return reason</Label>
          <Select
            id="return_reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as AdoptionReturnReason);
              setError(undefined);
            }}>

            <option value="" disabled>
              Select a reason…
            </option>
            {ADOPTION_RETURN_REASONS.map((r) =>
            <option key={r} value={r}>
                {ADOPTION_RETURN_REASON_LABELS[r]}
              </option>
            )}
          </Select>
        </div>

        <div>
          <Label htmlFor="return_notes">Notes (optional)</Label>
          <Textarea
            id="return_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the team should know about this return…" />

        </div>

        {error && <FieldError>{error}</FieldError>}
      </form>
    </Modal>);

}
