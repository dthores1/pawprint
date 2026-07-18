import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select, Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { AdoptionCancelReason } from '../../types';
import {
  ADOPTION_CANCEL_REASONS,
  ADOPTION_CANCEL_REASON_LABELS } from
'../../lib/adoptions';
import { animalDisplayName } from '../../lib/utils';
import { track } from '../../lib/analytics';

interface CloseAdoptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  adoptionId: string;
}

// 'adopted' closes the adoption successfully (status='completed', with the
// animal-side effects); every other outcome closes it unsuccessfully
// (status='cancelled' with the structured reason).
type CloseOutcome = 'adopted' | AdoptionCancelReason;

// Close an adoption with a final outcome — successful or not. Progressing an
// active adoption stays in UpdateAdoptionModal; this is the only exit.
export function CloseAdoptionModal({
  isOpen,
  onClose,
  adoptionId
}: CloseAdoptionModalProps) {
  const { adoptions, animals, people, completeAdoption, cancelAdoption } =
  useWhisker();
  const adoption = adoptions.find((a) => a.id === adoptionId);
  const animal = adoption ?
  animals.find((a) => a.id === adoption.animal_id) :
  undefined;
  const adopter = adoption ?
  people.find((p) => p.id === adoption.adopter_id) :
  undefined;

  const [outcome, setOutcome] = useState<CloseOutcome | ''>('');
  const [donation, setDonation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !adoption) return;
    setOutcome('');
    setDonation(
      adoption.donation_amount != null ? String(adoption.donation_amount) : ''
    );
    setNotes(adoption.notes ?? '');
  }, [isOpen, adoption]);

  if (!adoption) return null;

  const animalName = animal ? animalDisplayName(animal) : 'the animal';
  const adopterName = adopter ?
  `${adopter.first_name} ${adopter.last_name}` :
  'the adopter';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome) return;
    if (outcome === 'adopted') {
      const parsed = donation.trim() === '' ? undefined : Number(donation);
      completeAdoption(
        adoptionId,
        parsed != null && !isNaN(parsed) ? parsed : undefined,
        notes
      );
      track('adoption_completed', { animal_id: adoption.animal_id });
    } else {
      cancelAdoption(adoptionId, outcome, notes);
      track('adoption_cancelled', {
        animal_id: adoption.animal_id,
        reason: outcome
      });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Close Adoption"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="close-adoption-form" disabled={!outcome}>
            Close Adoption
          </Button>
        </div>
      }>

      <form
        id="close-adoption-form"
        onSubmit={handleSubmit}
        className="space-y-5">
        <div>
          <Label htmlFor="close_outcome">Outcome</Label>
          <Select
            id="close_outcome"
            value={outcome}
            required
            onChange={(e) => setOutcome(e.target.value as CloseOutcome | '')}>

            <option value="" disabled>
              Select an outcome…
            </option>
            <option value="adopted">Adopted</option>
            {ADOPTION_CANCEL_REASONS.map((r) =>
            <option key={r} value={r}>
                {ADOPTION_CANCEL_REASON_LABELS[r]}
              </option>
            )}
          </Select>
        </div>

        {outcome === 'adopted' &&
        <>
            <div className="rounded-xl bg-background border border-border p-4 space-y-1.5 text-sm text-text-secondary">
              <p>
                • {animalName}'s status becomes{' '}
                <span className="font-medium text-text-primary">Adopted</span>
              </p>
              <p>• {adopterName} is recorded as the adopter</p>
              <p>• Any active foster placement is closed</p>
            </div>
            <div>
              <Label htmlFor="close_donation">Donation Amount (optional)</Label>
              <Input
              id="close_donation"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={donation}
              onChange={(e) => setDonation(e.target.value)}
              placeholder="e.g. 75.00" />

              <p className="text-xs text-text-secondary mt-1">
                Suggested donation made with the adoption paperwork.
              </p>
            </div>
          </>
        }

        {outcome && outcome !== 'adopted' &&
        <p className="text-sm text-text-secondary leading-relaxed">
            The adoption record is kept in history and{' '}
            <span className="font-medium text-text-primary">{animalName}</span>{' '}
            will be released from hold and become selectable again.
          </p>
        }

        <div>
          <Label htmlFor="close_notes">Notes (optional)</Label>
          <Textarea
            id="close_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything relevant to this outcome…"
            rows={3} />

        </div>
      </form>
    </Modal>);

}
