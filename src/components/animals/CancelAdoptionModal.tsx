import React, { useState } from 'react';
import { AlertTriangleIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Label, Textarea } from '../ui/Forms';
import { useWhisker } from '../../context/WhiskerContext';
import { animalDisplayName } from '../../lib/utils';

interface CancelAdoptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  adoptionId: string;
}

export function CancelAdoptionModal({
  isOpen,
  onClose,
  adoptionId
}: CancelAdoptionModalProps) {
  const { adoptions, animals, cancelAdoption } = useWhisker();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const adoption = adoptions.find((a) => a.id === adoptionId);
  const animal = adoption ?
  animals.find((an) => an.id === adoption.animal_id) :
  undefined;
  const animalName = animal ? animalDisplayName(animal) : 'This animal';

  const handleConfirm = async () => {
    setSubmitting(true);
    cancelAdoption(adoptionId, reason.trim() || undefined);
    setSubmitting(false);
    setReason('');
    onClose();
  };

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cancel Adoption"
      footer={
      <div className="flex justify-end gap-3">
          <Button
          type="button"
          variant="ghost"
          onClick={handleClose}
          disabled={submitting}>
            Keep Adoption
          </Button>
          <Button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="bg-[#9B3A3A] hover:bg-[#7F2F2F] text-white">
            {submitting ? 'Cancelling…' : 'Cancel Adoption'}
          </Button>
        </div>
      }>

      <div className="space-y-5">
        <div className="flex gap-3 p-4 rounded-lg bg-[#FBE7D2]/40 border border-[#F3D2B0]">
          <AlertTriangleIcon className="w-5 h-5 text-[#B4641E] shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-sm">
            <p className="font-medium text-text-primary">
              Cancel this adoption?
            </p>
            <p className="text-text-secondary leading-relaxed">
              The adoption record is kept in history and{' '}
              <span className="font-medium text-text-primary">{animalName}</span>{' '}
              will be released from hold and become selectable again.
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="cancel_reason">Reason (optional)</Label>
          <Textarea
            id="cancel_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Adopter withdrew, didn't pass home check…"
            rows={3} />
        </div>
      </div>
    </Modal>);
}
