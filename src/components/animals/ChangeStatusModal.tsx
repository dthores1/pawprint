import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label, FieldError } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { FormSection } from '../ui/FormSection';
import { Button } from '../ui/Button';
import { AgeInformationFields, AgeInputMode } from './AgeInformationFields';
import { BreedCombobox } from './BreedCombobox';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalStatus, Priority, Species, Sex, AgeUnit } from '../../types';
import { deriveAgeInfo } from '../../lib/age';

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

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
  const { animals, updateAnimal, deleteAnimal, addNote } = useWhisker();
  const navigate = useNavigate();
  const animal = animals.find((a) => a.id === animalId);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('Dog');
  const [sex, setSex] = useState<Sex>('Unknown');
  const [breedId, setBreedId] = useState<string | undefined>();
  const [breedText, setBreedText] = useState<string | undefined>();
  const [birthdate, setBirthdate] = useState('');
  const [ageValue, setAgeValue] = useState('');
  const [ageUnit, setAgeUnit] = useState<AgeUnit>('months');
  const [ageMode, setAgeMode] = useState<AgeInputMode>('birthdate');
  const [ageError, setAgeError] = useState<string | undefined>();
  const [status, setStatus] = useState<AnimalStatus>('intake');
  const [priority, setPriority] = useState<Priority>('normal');
  const [isOnHold, setIsOnHold] = useState(false);
  const [behaviorConcern, setBehaviorConcern] = useState(false);
  const [medicalConcern, setMedicalConcern] = useState(false);
  const [intakeDate, setIntakeDate] = useState('');
  const [intakeSource, setIntakeSource] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [intakeDateError, setIntakeDateError] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [reason, setReason] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Hydrate from the animal each time the modal opens, so external updates
  // are reflected and the user always starts from the current state. We
  // preserve the original input mode: animals entered via estimated age open
  // with the age fields populated (not the derived birthdate).
  useEffect(() => {
    if (!isOpen || !animal) return;
    setName(animal.name);
    setSpecies(animal.species);
    setSex(animal.sex);
    setBreedId(animal.breed_id);
    setBreedText(animal.breed_text);
    if (animal.birthdate_source === 'estimated_age') {
      setAgeMode('age');
      setBirthdate('');
      setAgeValue(
        animal.estimated_age_value != null ?
        String(animal.estimated_age_value) :
        ''
      );
      setAgeUnit(animal.estimated_age_unit ?? 'months');
    } else {
      setAgeMode('birthdate');
      setBirthdate(animal.estimated_birth_date);
      setAgeValue('');
      setAgeUnit('months');
    }
    setAgeError(undefined);
    setStatus(animal.status);
    setPriority(animal.priority);
    setIsOnHold(!!animal.is_on_hold);
    setBehaviorConcern(!!animal.has_behavior_concern);
    setMedicalConcern(!!animal.has_medical_concern);
    setIntakeDate(animal.intake_date);
    setIntakeSource(animal.intake_source ?? '');
    setPhotoUrl(animal.primary_photo_url ?? '');
    setDescription(animal.description ?? '');
    setIntakeDateError(undefined);
    setPhotoError(undefined);
    setReason('');
    setInternalNotes(animal.internal_notes ?? '');
  }, [isOpen, animal]);

  if (!animal) return null;

  // Estimated age means the animal's *current* age. Keep an unchanged stored
  // estimate stable by reusing its original anchor; the moment the age inputs
  // change, re-anchor to today so a freshly entered age is read as "age now".
  const today = new Date().toISOString().split('T')[0];
  const origAgeValue =
  animal.birthdate_source === 'estimated_age' &&
  animal.estimated_age_value != null ?
  String(animal.estimated_age_value) :
  '';
  const origAgeUnit = animal.estimated_age_unit ?? 'months';
  const ageInputsChanged =
  ageMode === 'age' && (ageValue !== origAgeValue || ageUnit !== origAgeUnit);
  const ageAsOf = ageInputsChanged ?
  today :
  animal.estimated_age_as_of || animal.intake_date || today;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ageInfo = deriveAgeInfo({
      birthdate: ageMode === 'birthdate' ? birthdate : '',
      ageValue: ageMode === 'age' ? ageValue : '',
      ageUnit,
      asOf: ageAsOf
    });
    if (!ageInfo.valid) {
      setAgeError('Enter a birthdate or an estimated age.');
      return;
    }
    if (!intakeDate) {
      setIntakeDateError('Intake date is required.');
      return;
    }
    if (!isValidUrl(photoUrl.trim())) {
      setPhotoError('Enter a valid URL.');
      return;
    }
    const changes: string[] = [];
    if (status !== animal.status)
    changes.push(`status: ${animal.status} → ${status}`);
    if (priority !== animal.priority)
    changes.push(`priority: ${animal.priority} → ${priority}`);
    const flagChange = (
    label: string,
    next: boolean,
    prev: boolean | undefined) =>
    {
      if (next !== !!prev) changes.push(`${label}: ${next ? 'on' : 'off'}`);
    };
    flagChange('on hold', isOnHold, animal.is_on_hold);
    flagChange('behavior concern', behaviorConcern, animal.has_behavior_concern);
    flagChange('medical concern', medicalConcern, animal.has_medical_concern);

    updateAnimal(animalId, {
      name: name.trim() || animal.name,
      species,
      sex,
      breed_id: breedId,
      breed_text: breedText,
      estimated_birth_date: ageInfo.estimated_birth_date,
      birthdate_source: ageInfo.birthdate_source,
      estimated_age_value: ageInfo.estimated_age_value,
      estimated_age_unit: ageInfo.estimated_age_unit,
      estimated_age_as_of: ageInfo.estimated_age_as_of,
      status,
      priority,
      is_on_hold: isOnHold,
      has_behavior_concern: behaviorConcern,
      has_medical_concern: medicalConcern,
      intake_date: intakeDate,
      intake_source: intakeSource.trim(),
      primary_photo_url: photoUrl.trim() || undefined,
      description: description.trim(),
      internal_notes: internalNotes.trim() || undefined
    });

    // A filled timeline note always logs; field changes are prepended for context.
    if (reason.trim()) {
      const body =
      changes.length > 0 ?
      `${changes.join(', ')}. Note: ${reason.trim()}` :
      reason.trim();
      addNote({
        animal_id: animalId,
        author_name: 'Current User',
        note_type: 'general',
        body
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (
    window.confirm(
      `Delete ${animal.name}? This permanently removes the animal record and can't be undone.`
    ))
    {
      deleteAnimal(animalId);
      onClose();
      navigate('/animals');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${animal.name}`}
      className="max-w-2xl">

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <FormSection title="Basic Information">
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
            <Label htmlFor="edit_breed">Breed</Label>
            <BreedCombobox
              id="edit_breed"
              species={species}
              breedId={breedId}
              breedText={breedText}
              onChange={(next) => {
                setBreedId(next.breed_id);
                setBreedText(next.breed_text);
              }} />

          </div>
          <div>
            <Label htmlFor="edit_photo">Photo URL (optional)</Label>
            <Input
              id="edit_photo"
              type="url"
              value={photoUrl}
              onChange={(e) => {
                setPhotoUrl(e.target.value);
                setPhotoError(undefined);
              }}
              className={photoError && 'border-red-500 focus:ring-red-500'}
              placeholder="https://..." />

            <FieldError>{photoError}</FieldError>
          </div>
        </FormSection>

        {/* Age & Intake */}
        <FormSection title="Age & Intake">
          <AgeInformationFields
            birthdate={birthdate}
            ageValue={ageValue}
            ageUnit={ageUnit}
            asOfDate={ageAsOf}
            mode={ageMode}
            onModeChange={setAgeMode}
            onBirthdate={(v) => {
              setBirthdate(v);
              setAgeError(undefined);
            }}
            onAgeValue={(v) => {
              setAgeValue(v);
              setAgeError(undefined);
            }}
            onAgeUnit={setAgeUnit}
            error={ageError} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_intake_date">Intake Date</Label>
              <DatePicker
                id="edit_intake_date"
                error={Boolean(intakeDateError)}
                value={intakeDate}
                onChange={(v) => {
                  setIntakeDate(v);
                  setIntakeDateError(undefined);
                }} />

              <FieldError>{intakeDateError}</FieldError>
            </div>
            <div>
              <Label htmlFor="edit_intake_source">Intake Source</Label>
              <Input
                id="edit_intake_source"
                value={intakeSource}
                onChange={(e) => setIntakeSource(e.target.value)}
                placeholder="e.g. City Shelter Transfer" />

            </div>
          </div>
        </FormSection>

        {/* Status & Priority */}
        <FormSection title="Status & Priority">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_status">Status</Label>
              <Select
                id="edit_status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AnimalStatus)}>

                <option value="intake">Intake</option>
                <option value="medical">Medical</option>
                <option value="not_ready">Not Ready</option>
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
        </FormSection>

        {/* Care Considerations */}
        <FormSection title="Care Considerations">
          <div className="space-y-6">
            {[
            {
              heading: 'Operational',
              items: [
              {
                label: 'On Hold',
                checked: isOnHold,
                set: setIsOnHold,
                help: 'Temporarily unavailable for adoption or transfer'
              }]
            },
            {
              heading: 'Care Considerations',
              items: [
              {
                label: 'Behavior Concern',
                checked: behaviorConcern,
                set: setBehaviorConcern,
                help: 'Behavioral considerations staff or fosters should know'
              },
              {
                label: 'Medical Concern',
                checked: medicalConcern,
                set: setMedicalConcern,
                help: 'Medical considerations requiring ongoing awareness'
              }]
            }].
            map((group) =>
            <div key={group.heading}>
                <h4 className="text-xs uppercase tracking-wider font-semibold text-text-secondary mb-3">
                  {group.heading}
                </h4>
                <div className="space-y-5">
                  {group.items.map((item) =>
                <div key={item.label}>
                      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-text-primary">
                        <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.set(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary" />

                        {item.label}
                      </label>
                      <p className="text-xs text-text-secondary mt-2 ml-[26px]">
                        {item.help}
                      </p>
                    </div>
                )}
                </div>
              </div>
            )}
          </div>
        </FormSection>

        {/* Notes & Activity */}
        <FormSection title="Notes & Activity">
          <div>
            <Label htmlFor="edit_description">Intake Notes</Label>
            <Textarea
              id="edit_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Initial observations or intake information…"
              rows={3} />

            <p className="text-xs text-text-secondary mt-1">
              Initial observations or intake information.
            </p>
          </div>
          <div>
            <Label htmlFor="edit_internal_notes">Care Notes</Label>
            <Textarea
              id="edit_internal_notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Staff-only context that isn't part of the public description…"
              rows={4} />

            <p className="text-xs text-text-secondary mt-1">
              Persistent internal notes about behavior, care needs, routines, preferences, or handling.
            </p>
          </div>
          <div>
            <Label htmlFor="edit_reason">Add Timeline Note (optional)</Label>
            <Textarea
              id="edit_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a note to the activity timeline…"
              rows={2} />

            <p className="text-xs text-text-secondary mt-1">
              Logged to the animal activity timeline.
            </p>
          </div>
        </FormSection>

        <div className="pt-5 flex items-center justify-between gap-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            className="text-[#9B3A3A] hover:bg-[#F5D7D7]/60 hover:text-[#9B3A3A]">

            Delete
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </div>
      </form>
    </Modal>);

}
