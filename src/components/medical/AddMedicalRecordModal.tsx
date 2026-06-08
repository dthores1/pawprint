import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Label } from '../ui/Forms';
import { AnimalSearchPicker } from '../ui/AnimalSearchPicker';
import { AddMedicalModal } from '../animals/AddMedicalModal';
import { useWhisker } from '../../context/WhiskerContext';
import { Animal } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Global "Add Medical Record" entry point used on the Medical → Records tab.
// The medical form needs a full (heavy) Animal row, so this is a two-step flow:
// pick an animal, resolve its full record via `ensureAnimal`, then hand off to
// the same AddMedicalModal used on the animal profile.
export function AddMedicalRecordModal({ isOpen, onClose }: Props) {
  const { animalsIndex, ensureAnimal } = useWhisker();
  const [animalId, setAnimalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [animal, setAnimal] = useState<Animal | null>(null);

  const handleClose = () => {
    setAnimalId('');
    setAnimal(null);
    setLoading(false);
    onClose();
  };

  const handleContinue = async () => {
    if (!animalId) return;
    setLoading(true);
    const heavy = await ensureAnimal(animalId);
    setLoading(false);
    if (heavy) setAnimal(heavy);
  };

  // Step 2 — the real medical form, scoped to the chosen animal.
  if (animal) {
    return (
      <AddMedicalModal
        isOpen={true}
        animalId={animal.id}
        animal={animal}
        onClose={handleClose} />);

  }

  // Step 1 — choose the animal.
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Medical Record"
      footer={
      <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={!animalId || loading}>
            {loading ? 'Loading…' : 'Continue'}
          </Button>
        </div>
      }>

      <div className="space-y-2">
        <Label htmlFor="medical-record-animal" required>
          Animal
        </Label>
        <AnimalSearchPicker
          id="medical-record-animal"
          animals={animalsIndex}
          value={animalId}
          onChange={setAnimalId}
          placeholder="Search animals by name or ID…" />

        <p className="text-sm text-text-secondary">
          Choose the animal this medical record is for.
        </p>
      </div>
    </Modal>);

}
