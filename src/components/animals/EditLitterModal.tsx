import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label, FieldError } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { BreedCombobox } from './BreedCombobox';
import { AnimalSearchPicker } from '../ui/AnimalSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { Species } from '../../types';
import { litterMembers } from '../../lib/litters';

interface EditLitterModalProps {
  isOpen: boolean;
  onClose: () => void;
  litterId: string;
}

// "Update Group" — edit the litter's shared metadata. Does not cascade to member
// animals (each keeps its own record); this edits the grouping object itself.
export function EditLitterModal({
  isOpen,
  onClose,
  litterId
}: EditLitterModalProps) {
  const { litters, animals, updateLitter } = useWhisker();
  const litter = litters.find((l) => l.id === litterId);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('Cat');
  const [breedId, setBreedId] = useState<string | undefined>();
  const [breedText, setBreedText] = useState<string | undefined>();
  const [estimatedBirthDate, setEstimatedBirthDate] = useState('');
  const [intakeDate, setIntakeDate] = useState('');
  const [intakeSource, setIntakeSource] = useState('');
  const [motherId, setMotherId] = useState('');
  const [notes, setNotes] = useState('');
  const [intakeError, setIntakeError] = useState<string | undefined>();

  useEffect(() => {
    if (!isOpen || !litter) return;
    setName(litter.name ?? '');
    setSpecies(litter.species);
    setBreedId(litter.breed_id);
    setBreedText(litter.breed_text);
    setEstimatedBirthDate(litter.estimated_birth_date ?? '');
    setIntakeDate(litter.intake_date);
    setIntakeSource(litter.intake_source ?? '');
    setMotherId(litter.mother_animal_id ?? '');
    setNotes(litter.notes ?? '');
    setIntakeError(undefined);
  }, [isOpen, litter]);

  if (!litter) return null;

  // The mother is not a member of her own litter.
  const memberIds = litterMembers(animals, litterId).map((a) => a.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeDate) {
      setIntakeError('Intake date is required.');
      return;
    }
    updateLitter(litterId, {
      name: name.trim() || undefined,
      species,
      breed_id: breedId,
      breed_text: breedText,
      estimated_birth_date: estimatedBirthDate || undefined,
      intake_date: intakeDate,
      intake_source: intakeSource.trim() || undefined,
      mother_animal_id: motherId || undefined,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Litter"
      className="max-w-2xl">

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="litter_edit_name">Litter Name (optional)</Label>
          <Input
            id="litter_edit_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Cookie Litter" />

        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="litter_edit_species" required>Species</Label>
            <Select
              id="litter_edit_species"
              value={species}
              onChange={(e) => {
                setSpecies(e.target.value as Species);
                setBreedId(undefined);
                setBreedText(undefined);
              }}>

              <option value="Dog">Dog</option>
              <option value="Cat">Cat</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="litter_edit_breed">Breed</Label>
            <BreedCombobox
              id="litter_edit_breed"
              species={species}
              breedId={breedId}
              breedText={breedText}
              onChange={(next) => {
                setBreedId(next.breed_id);
                setBreedText(next.breed_text);
              }} />

          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="litter_edit_birthdate">
              Estimated Birthdate (optional)
            </Label>
            <DatePicker
              id="litter_edit_birthdate"
              value={estimatedBirthDate}
              onChange={setEstimatedBirthDate} />

          </div>
          <div>
            <Label htmlFor="litter_edit_intake" required>Intake Date</Label>
            <DatePicker
              id="litter_edit_intake"
              required
              error={Boolean(intakeError)}
              value={intakeDate}
              onChange={(v) => {
                setIntakeDate(v);
                setIntakeError(undefined);
              }}
              align="end" />

            <FieldError>{intakeError}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="litter_edit_source">Intake Source (optional)</Label>
          <Input
            id="litter_edit_source"
            value={intakeSource}
            onChange={(e) => setIntakeSource(e.target.value)}
            placeholder="e.g. Surrendered with mother" />

        </div>

        <div>
          <Label>Mother (optional)</Label>
          <AnimalSearchPicker
            animals={animals}
            value={motherId}
            onChange={setMotherId}
            excludeIds={memberIds}
            placeholder="Search for the mother…" />

        </div>

        <div>
          <Label htmlFor="litter_edit_notes">Litter Notes (optional)</Label>
          <Textarea
            id="litter_edit_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything that applies to the whole litter…" />

        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>);

}
