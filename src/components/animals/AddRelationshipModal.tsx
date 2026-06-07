import React, { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { AnimalSearchPicker } from '../ui/AnimalSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalRelationship } from '../../types';
import { animalDisplayName } from '../../lib/utils';
interface AddRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}
const RELATIONSHIP_TYPES: {
  value: AnimalRelationship['relationship_type'];
  label: string;
}[] = [
{
  value: 'mother',
  label: 'Mother'
},
{
  value: 'father',
  label: 'Father'
},
{
  value: 'child',
  label: 'Child'
},
{
  value: 'sibling',
  label: 'Sibling'
},
{
  value: 'bonded_pair',
  label: 'Bonded Pair'
}];

export function AddRelationshipModal({
  isOpen,
  onClose,
  animalId
}: AddRelationshipModalProps) {
  // Index so a deceased/adopted relative can still be picked.
  const {
    animalsIndex: animals,
    relationships,
    litters,
    addRelationship,
    updateAnimal
  } = useWhisker();
  const [selectedId, setSelectedId] = useState('');
  const [type, setType] =
  useState<AnimalRelationship['relationship_type']>('sibling');
  const [notes, setNotes] = useState('');
  // When relating a sibling that's already in a litter, prefer adding this
  // animal to that litter (litter membership *is* the sibling link) rather than
  // creating a duplicate explicit relationship. Checked by default.
  const [addToLitter, setAddToLitter] = useState(true);
  const selectedAnimal = animals.find((a) => a.id === selectedId) ?? null;
  // Hide the current animal and any animals it is already related to.
  const excludeIds = useMemo(() => {
    const ids = relationships.
    filter((r) => r.animal_id === animalId || r.related_animal_id === animalId).
    map((r) =>
    r.animal_id === animalId ? r.related_animal_id : r.animal_id
    );
    return [animalId, ...ids];
  }, [relationships, animalId]);
  const reset = () => {
    setSelectedId('');
    setType('sibling');
    setNotes('');
    setAddToLitter(true);
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  // Sibling-of-a-littered-animal → offer to add this animal to that litter.
  const currentAnimal = animals.find((a) => a.id === animalId);
  const selectedLitter =
  selectedAnimal?.litter_id ?
  litters.find((l) => l.id === selectedAnimal.litter_id) :
  undefined;
  const showLitterOption = type === 'sibling' && !!selectedAnimal?.litter_id;
  const litterName = selectedLitter?.name?.trim() || 'their litter';
  const willMoveLitter =
  showLitterOption &&
  !!currentAnimal?.litter_id &&
  currentAnimal.litter_id !== selectedAnimal?.litter_id;
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) return;
    if (showLitterOption && addToLitter && selectedAnimal.litter_id) {
      // Litter membership satisfies the sibling link — no relationship row.
      updateAnimal(animalId, { litter_id: selectedAnimal.litter_id });
    } else {
      addRelationship({
        animal_id: animalId,
        related_animal_id: selectedAnimal.id,
        relationship_type: type,
        notes: notes.trim() || undefined
      });
    }
    handleClose();
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Relationship"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
          type="submit"
          form="add-relationship-form"
          disabled={!selectedAnimal}>
            {showLitterOption && addToLitter ? 'Add to Litter' : 'Save Relationship'}
          </Button>
        </div>
      }>

      <form
        id="add-relationship-form"
        onSubmit={handleSubmit}
        className="space-y-5">
        <div>
          <Label required>Related Animal</Label>
          <AnimalSearchPicker
            animals={animals}
            value={selectedId}
            onChange={setSelectedId}
            excludeIds={excludeIds}
            placeholder="Search by name or ID..." />

        </div>

        <div>
          <Label htmlFor="relationship_type" required>Relationship Type</Label>
          <Select
            id="relationship_type"
            value={type}
            onChange={(e) =>
            setType(e.target.value as AnimalRelationship['relationship_type'])
            }
            disabled={!selectedAnimal}>
            
            {RELATIONSHIP_TYPES.map((t) =>
            <option key={t.value} value={t.value}>
                {t.label}
              </option>
            )}
          </Select>
        </div>

        {!(showLitterOption && addToLitter) &&
        <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Must be adopted together..."
            disabled={!selectedAnimal} />

          </div>
        }

        {showLitterOption &&
        <label className="flex items-start gap-2.5 rounded-lg border border-border bg-background/50 p-3 cursor-pointer">
            <input
            type="checkbox"
            checked={addToLitter}
            onChange={(e) => setAddToLitter(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary" />

            <span className="text-sm text-text-primary">
              Add{' '}
              <span className="font-medium">
                {currentAnimal ? animalDisplayName(currentAnimal) : 'this animal'}
              </span>{' '}
              to <span className="font-medium">{litterName}</span>
              <span className="block text-xs text-text-secondary mt-0.5">
                {willMoveLitter ?
              `Moves them from their current litter — littermates become siblings automatically.` :
              `Littermates are siblings automatically, so no separate relationship is needed.`}
              </span>
            </span>
          </label>
        }
      </form>
    </Modal>);

}