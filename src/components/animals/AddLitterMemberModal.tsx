import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { Sex } from '../../types';
import { litterMembers, memberNoun, litterLabel } from '../../lib/litters';
import { track } from '../../lib/analytics';

interface AddLitterMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  litterId: string;
}

// Add one animal to an existing litter — stamped with the litter's shared
// metadata (species, breed, dates) + litter_id, capturing only what differs.
export function AddLitterMemberModal({
  isOpen,
  onClose,
  litterId
}: AddLitterMemberModalProps) {
  // Index so the existing-member count includes any who aged out of care.
  const { litters, animalsIndex: animals, addAnimal, breeds } = useWhisker();
  const litter = litters.find((l) => l.id === litterId);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('Unknown');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setSex('Unknown');
    setDescription('');
  }, [isOpen]);

  if (!litter) return null;

  const count = litterMembers(animals, litterId).length;
  const noun = memberNoun(litter.species, 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAnimal({
      name: name.trim() || `${noun[0].toUpperCase()}${noun.slice(1)} ${count + 1}`,
      species: litter.species,
      sex,
      breed_id: litter.breed_id,
      breed_text: litter.breed_text,
      estimated_birth_date: litter.estimated_birth_date ?? '',
      intake_date: litter.intake_date,
      intake_source: litter.intake_source ?? '',
      status: 'intake',
      priority: 'normal',
      description: description.trim(),
      litter_id: litterId
    } as Parameters<typeof addAnimal>[0]);
    track('litter_member_added', { litter_id: litterId });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Animal to ${litterLabel(litter, breeds)}`}
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-litter-member-form">
            Add Animal
          </Button>
        </div>
      }>

      <form
        id="add-litter-member-form"
        onSubmit={handleSubmit}
        className="space-y-4">
        <p className="text-xs text-text-secondary">
          Inherits the litter's species, breed, and intake details. Starts as{' '}
          <span className="font-medium">Intake</span> /{' '}
          <span className="font-medium">Normal</span> priority.
        </p>
        <div>
          <Label htmlFor="member_name">Name</Label>
          <Input
            id="member_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${noun[0].toUpperCase()}${noun.slice(1)} name (optional)`} />

        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="member_sex">Sex</Label>
            <Select
              id="member_sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}>

              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Unknown">Unknown</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="member_desc">Markings / Notes (optional)</Label>
          <Textarea
            id="member_desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Distinguishing markings or notes…" />

        </div>
      </form>
    </Modal>);

}
