import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select, Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { AdoptionCancelReason } from '../../types';
import {
  ADOPTION_REJECTED_REASONS,
  ADOPTION_REJECTED_REASON_LABELS,
  ADOPTION_APPLICANT_CANCEL_REASONS,
  ADOPTION_APPLICANT_CANCEL_REASON_LABELS,
  adoptionAnimalIds } from
'../../lib/adoptions';
import { animalDisplayName } from '../../lib/utils';
import { track } from '../../lib/analytics';

interface CloseAdoptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  adoptionId: string;
}

// 'adopted' closes the adoption successfully (status='completed', with the
// animal-side effects); the rest are the lost statuses. Rejected and
// Cancelled by Applicant carry a per-status reason.
type CloseOutcome =
'adopted' |
'rejected' |
'cancelled_by_applicant' |
'duplicate';

// Close an adoption with a final outcome — successful or not. Progressing an
// active adoption stays in UpdateAdoptionModal; this is the only exit.
export function CloseAdoptionModal({
  isOpen,
  onClose,
  adoptionId
}: CloseAdoptionModalProps) {
  const { adoptions, animalsIndex, people, completeAdoption, cancelAdoption } =
  useWhisker();
  const adoption = adoptions.find((a) => a.id === adoptionId);
  // Every animal on the record — a bonded pair closes as a unit.
  const recordAnimals = adoption ?
  adoptionAnimalIds(adoption).
  map((id) => animalsIndex.find((a) => a.id === id)).
  filter((a): a is NonNullable<typeof a> => !!a) :
  [];
  const adopter = adoption ?
  people.find((p) => p.id === adoption.adopter_id) :
  undefined;

  const [outcome, setOutcome] = useState<CloseOutcome | ''>('');
  const [reason, setReason] = useState<AdoptionCancelReason | ''>('');
  const [donation, setDonation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !adoption) return;
    setOutcome('');
    setReason('');
    setDonation(
      adoption.donation_amount != null ? String(adoption.donation_amount) : ''
    );
    setNotes(adoption.notes ?? '');
  }, [isOpen, adoption]);

  if (!adoption) return null;

  const animalName =
  recordAnimals.length > 0 ?
  recordAnimals.map((a) => animalDisplayName(a)).join(' & ') :
  'the animal';
  const plural = recordAnimals.length > 1;
  const adopterName = adopter ?
  `${adopter.first_name} ${adopter.last_name}` :
  'the adopter';

  // Rejected / Cancelled by Applicant each carry a required, status-specific
  // reason; Duplicate needs none.
  const reasonOptions =
  outcome === 'rejected' ?
  ADOPTION_REJECTED_REASONS.map((r) => ({
    value: r,
    label: ADOPTION_REJECTED_REASON_LABELS[r]
  })) :
  outcome === 'cancelled_by_applicant' ?
  ADOPTION_APPLICANT_CANCEL_REASONS.map((r) => ({
    value: r,
    label: ADOPTION_APPLICANT_CANCEL_REASON_LABELS[r]
  })) :
  null;
  const needsReason = reasonOptions !== null;
  const canSave = !!outcome && (!needsReason || !!reason);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !outcome) return;
    if (outcome === 'adopted') {
      const parsed = donation.trim() === '' ? undefined : Number(donation);
      completeAdoption(
        adoptionId,
        parsed != null && !isNaN(parsed) ? parsed : undefined,
        notes
      );
      track('adoption_completed', { animal_id: adoption.animal_id });
    } else {
      cancelAdoption(
        adoptionId,
        outcome,
        needsReason && reason ? reason : undefined,
        notes
      );
      track('adoption_cancelled', {
        animal_id: adoption.animal_id,
        status: outcome,
        reason: needsReason ? reason : undefined
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
          <Button type="submit" form="close-adoption-form" disabled={!canSave}>
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
            onChange={(e) => {
              setOutcome(e.target.value as CloseOutcome | '');
              setReason('');
            }}>

            <option value="" disabled>
              Select an outcome…
            </option>
            <option value="adopted">Adopted</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled_by_applicant">
              Cancelled by Applicant
            </option>
            <option value="duplicate">Duplicate Application</option>
          </Select>
        </div>

        {reasonOptions &&
        <div>
            <Label htmlFor="close_reason">Reason</Label>
            <Select
            id="close_reason"
            value={reason}
            required
            onChange={(e) =>
            setReason(e.target.value as AdoptionCancelReason | '')
            }>

              <option value="" disabled>
                Select a reason…
              </option>
              {reasonOptions.map((r) =>
            <option key={r.value} value={r.value}>
                  {r.label}
                </option>
            )}
            </Select>
          </div>
        }

        {outcome === 'adopted' &&
        <>
            <div className="rounded-xl bg-background border border-border p-4 space-y-1.5 text-sm text-text-secondary">
              <p>
                • {animalName}
                {plural ? ' both become' : "'s status becomes"}{' '}
                <span className="font-medium text-text-primary">Adopted</span>
              </p>
              <p>• {adopterName} is recorded as the adopter</p>
              <p>
                • Any active foster placement{plural ? 's are' : ' is'} closed
              </p>
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
            {plural && ' The bonded pair closes as a unit.'}
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
