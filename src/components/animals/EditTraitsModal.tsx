import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TraitMultiSelect } from './TraitMultiSelect';
import { useWhisker } from '../../context/WhiskerContext';
import { Animal } from '../../types';
import { animalDisplayName } from '../../lib/utils';
import { track } from '../../lib/analytics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  animal: Animal;
}

// Assign/remove traits on an animal. Wraps the shared TraitMultiSelect and
// diffs the selection on save via setAnimalTraits.
export function EditTraitsModal({ isOpen, onClose, animal }: Props) {
  const { animalTraits, setAnimalTraits } = useWhisker();
  const [selected, setSelected] = useState<string[]>([]);
  // The at-open selection — passed to TraitMultiSelect for stable ordering.
  const [initialSelected, setInitialSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const current = animalTraits.
    filter((at) => at.animal_id === animal.id).
    map((at) => at.trait_id);
    setSelected(current);
    setInitialSelected(current);
    // animalTraits intentionally excluded — snapshot at open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, animal.id]);

  const save = () => {
    setAnimalTraits(animal.id, selected);
    track('traits_updated', {
      animal_id: animal.id,
      trait_count: selected.length
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${animalDisplayName(animal)} | Edit Traits`}
      footer={
      <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      }>

      <div className="space-y-3">
        <TraitMultiSelect
          speciesId={animal.species_id}
          selectedIds={selected}
          initialSelectedIds={initialSelected}
          onChange={setSelected} />
        <Link
          to="/settings"
          onClick={onClose}
          className="block text-xs font-medium text-primary hover:underline">

          Manage traits in Settings
        </Link>
      </div>
    </Modal>);

}
