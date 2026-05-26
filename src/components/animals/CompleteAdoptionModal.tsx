import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { CheckIcon } from 'lucide-react';
import { useWhisker } from '../../context/WhiskerContext';
import { animalDisplayName } from '../../lib/utils';

interface CompleteAdoptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  adoptionId: string;
}

// Finalize an adoption. This is the consequential step: the animal becomes
// Adopted, the adopter is stamped on the animal, and any active foster
// placement is closed.
export function CompleteAdoptionModal({
  isOpen,
  onClose,
  adoptionId
}: CompleteAdoptionModalProps) {
  const { adoptions, animals, people, completeAdoption } = useWhisker();
  const adoption = adoptions.find((a) => a.id === adoptionId);
  const animal = adoption ?
  animals.find((a) => a.id === adoption.animal_id) :
  undefined;
  const adopter = adoption ?
  people.find((p) => p.id === adoption.adopter_id) :
  undefined;

  const [donation, setDonation] = useState('');

  useEffect(() => {
    if (!isOpen || !adoption) return;
    setDonation(
      adoption.donation_amount != null ? String(adoption.donation_amount) : ''
    );
  }, [isOpen, adoption]);

  if (!adoption || !animal) return null;

  const handleConfirm = () => {
    const parsed = donation.trim() === '' ? undefined : Number(donation);
    completeAdoption(
      adoptionId,
      parsed != null && !isNaN(parsed) ? parsed : undefined
    );
    onClose();
  };

  const adopterName = adopter ?
  `${adopter.first_name} ${adopter.last_name}` :
  'the adopter';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete Adoption">
      <div className="space-y-5">
        <p className="text-sm text-text-primary">
          This finalizes the adoption of{' '}
          <span className="font-medium">{animalDisplayName(animal)}</span> by{' '}
          <span className="font-medium">{adopterName}</span>.
        </p>
        <div className="rounded-xl bg-background border border-border p-4 space-y-1.5 text-sm text-text-secondary">
          <p>
            • {animalDisplayName(animal)}'s status becomes{' '}
            <span className="font-medium text-text-primary">Adopted</span>
          </p>
          <p>• {adopterName} is recorded as the adopter</p>
          <p>• Any active foster placement is closed</p>
        </div>
        <div>
          <Label htmlFor="complete_donation">Donation Amount (optional)</Label>
          <Input
            id="complete_donation"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={donation}
            onChange={(e) => setDonation(e.target.value)}
            placeholder="e.g. 75.00" />

        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            <CheckIcon className="w-4 h-4 mr-2" />
            Complete Adoption
          </Button>
        </div>
      </div>
    </Modal>);

}
