import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select, Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { AdoptionStatus } from '../../types';
import {
  ADOPTION_FLOW,
  ADOPTION_STATUS_LABELS,
  adoptionStatusPatch } from
'../../lib/adoptions';
import { track } from '../../lib/analytics';

interface UpdateAdoptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  adoptionId: string;
}

// Move an in-progress adoption along the workflow + record donation / notes.
// Completing and cancelling are handled by dedicated actions (side effects).
export function UpdateAdoptionModal({
  isOpen,
  onClose,
  adoptionId
}: UpdateAdoptionModalProps) {
  const { adoptions, updateAdoption } = useWhisker();
  const adoption = adoptions.find((a) => a.id === adoptionId);

  const [status, setStatus] = useState<AdoptionStatus>('inquiry');
  const [donation, setDonation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !adoption) return;
    setStatus(
      ADOPTION_FLOW.includes(adoption.status) ? adoption.status : 'inquiry'
    );
    setDonation(
      adoption.donation_amount != null ? String(adoption.donation_amount) : ''
    );
    setNotes(adoption.notes ?? '');
  }, [isOpen, adoption]);

  if (!adoption) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDonation = donation.trim() === '' ? undefined : Number(donation);
    updateAdoption(adoptionId, {
      ...adoptionStatusPatch(adoption, status),
      donation_amount:
      parsedDonation != null && !isNaN(parsedDonation) ?
      parsedDonation :
      undefined,
      notes: notes.trim() || undefined
    });
    track('adoption_updated', { animal_id: adoption.animal_id });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Adoption"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="update-adoption-form">
            Save
          </Button>
        </div>
      }>

      <form
        id="update-adoption-form"
        onSubmit={handleSubmit}
        className="space-y-5">
        <div>
          <Label htmlFor="adoption_status">Status</Label>
          <Select
            id="adoption_status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AdoptionStatus)}>

            {ADOPTION_FLOW.map((s) =>
            <option key={s} value={s}>
                {ADOPTION_STATUS_LABELS[s]}
              </option>
            )}
          </Select>
        </div>
        <div>
          <Label htmlFor="adoption_donation">Donation Amount (optional)</Label>
          <Input
            id="adoption_donation"
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
        <div>
          <Label htmlFor="adoption_notes">Notes (optional)</Label>
          <Textarea
            id="adoption_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything relevant to this adoption…"
            rows={3} />

        </div>
      </form>
    </Modal>);

}
