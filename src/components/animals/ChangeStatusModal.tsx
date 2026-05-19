import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalStatus, Priority, Species, Sex } from '../../types';

// File name kept for now (the import path is stable); the modal has expanded
// from "change status & priority" to a general "Edit animal" modal.
interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}
export function ChangeStatusModal({
  isOpen,
  onClose,
  animalId
}: ChangeStatusModalProps) {
  const { animals, updateAnimal, addNote } = useWhisker();
  const animal = animals.find((a) => a.id === animalId);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('Dog');
  const [sex, setSex] = useState<Sex>('Unknown');
  const [dob, setDob] = useState('');
  const [status, setStatus] = useState<AnimalStatus>('intake');
  const [priority, setPriority] = useState<Priority>('normal');
  const [reason, setReason] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Hydrate from the animal each time the modal opens, so external updates
  // are reflected and the user always starts from the current state.
  useEffect(() => {
    if (!isOpen || !animal) return;
    setName(animal.name);
    setSpecies(animal.species);
    setSex(animal.sex);
    setDob(animal.estimated_birth_date);
    setStatus(animal.status);
    setPriority(animal.priority);
    setReason('');
    setInternalNotes(animal.internal_notes ?? '');
  }, [isOpen, animal]);

  if (!animal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const changes: string[] = [];
    if (status !== animal.status)
    changes.push(`status: ${animal.status} → ${status}`);
    if (priority !== animal.priority)
    changes.push(`priority: ${animal.priority} → ${priority}`);

    updateAnimal(animalId, {
      name: name.trim() || animal.name,
      species,
      sex,
      estimated_birth_date: dob,
      status,
      priority,
      internal_notes: internalNotes.trim() || undefined
    });

    if (changes.length > 0 && reason.trim()) {
      addNote({
        animal_id: animalId,
        author_name: 'Current User',
        note_type: 'general',
        body: `${changes.join(', ')}. Reason: ${reason}`
      });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${animal.name}`}
      className="max-w-2xl">

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <section className="space-y-4">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-text-secondary">
            Basic Information
          </h3>
          <div>
            <Label htmlFor="edit_name">Name</Label>
            <Input
              id="edit_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required />

          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_species">Species</Label>
              <Select
                id="edit_species"
                value={species}
                onChange={(e) => setSpecies(e.target.value as Species)}>

                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
                <option value="Other">Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_sex">Sex</Label>
              <Select
                id="edit_sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex)}>

                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unknown">Unknown</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="edit_dob">Date of Birth (estimated)</Label>
            <Input
              id="edit_dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)} />

          </div>
        </section>

        {/* Status & Priority */}
        <section className="space-y-4 pt-2 border-t border-border">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-text-secondary pt-4">
            Status & Priority
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_status">Status</Label>
              <Select
                id="edit_status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AnimalStatus)}>

                <option value="intake">Intake</option>
                <option value="medical">Medical</option>
                <option value="hold">Hold</option>
                <option value="fostered">Fostered</option>
                <option value="adoptable">Adoptable</option>
                <option value="adopted">Adopted</option>
                <option value="hospice">Hospice</option>
                <option value="deceased">Deceased</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_priority">Priority</Label>
              <Select
                id="edit_priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}>

                <option value="normal">Normal</option>
                <option value="needs_attention">Needs Attention</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="edit_reason">Reason / Note (Optional)</Label>
            <Textarea
              id="edit_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What changed?"
              rows={2} />

            <p className="text-xs text-text-secondary mt-1">
              Logged as a note when status or priority changes.
            </p>
          </div>
        </section>

        {/* Notes */}
        <section className="space-y-4 pt-2 border-t border-border">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-text-secondary pt-4">
            Notes
          </h3>
          <div>
            <Label htmlFor="edit_internal_notes">Internal Notes</Label>
            <Textarea
              id="edit_internal_notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Staff-only context that isn't part of the public description…"
              rows={4} />

          </div>
        </section>

        <div className="pt-5 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>);

}
