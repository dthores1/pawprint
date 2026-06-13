import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label, FieldError } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { FormSection } from '../ui/FormSection';
import { Button } from '../ui/Button';
import { AgeInformationFields, AgeInputMode } from './AgeInformationFields';
import { focusFirstError } from '../../lib/focusFirstError';
import { BreedCombobox } from './BreedCombobox';
import { TraitMultiSelect } from './TraitMultiSelect';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalStatus, Priority, Sex, AgeUnit } from '../../types';
import { deriveAgeInfo } from '../../lib/age';
import { animalDisplayName } from '../../lib/utils';
import { breedFieldLabel } from '../../lib/speciesIcons';
import { enabledSpeciesList } from '../../lib/orgCatalog';

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function ConcernCheckbox({
  label,
  checked,
  onChange,
  help
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-text-primary">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded text-primary focus:ring-primary" />
        {label}
      </label>
      <p className="text-xs text-text-secondary mt-2 ml-[26px]">{help}</p>
    </div>);
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
  const {
    animals,
    updateAnimal,
    deleteAnimal,
    addNote,
    species: speciesCatalog,
    organizationSpecies,
    animalTraits,
    setAnimalTraits
  } = useWhisker();
  const navigate = useNavigate();
  const animal = animals.find((a) => a.id === animalId);

  const [name, setName] = useState('');
  const [rescueId, setRescueId] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [species, setSpecies] = useState<string>('');
  const [speciesId, setSpeciesId] = useState<string>('');
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
  const [microchipNumber, setMicrochipNumber] = useState('');
  const [description, setDescription] = useState('');
  const [intakeDateError, setIntakeDateError] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [reason, setReason] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [traitIds, setTraitIds] = useState<string[]>([]);
  // At-open trait selection (stable ordering snapshot for TraitMultiSelect).
  const [initialTraitIds, setInitialTraitIds] = useState<string[]>([]);

  // Hydrate from the animal each time the modal opens, so external updates
  // are reflected and the user always starts from the current state. We
  // preserve the original input mode: animals entered via estimated age open
  // with the age fields populated (not the derived birthdate).
  useEffect(() => {
    if (!isOpen || !animal) return;
    setName(animal.name ?? '');
    setRescueId(animal.rescue_id ?? '');
    setNameError(undefined);
    setSpecies(animal.species);
    // Prefer the stored species_id; fall back to matching the legacy name for
    // any row that predates the species_id backfill.
    setSpeciesId(
      animal.species_id ??
      speciesCatalog.find((s) => s.name === animal.species)?.id ??
      ''
    );
    setSex(animal.sex);
    setBreedId(animal.breed_id);
    setBreedText(animal.breed_text);
    const currentTraits = animalTraits.
    filter((at) => at.animal_id === animal.id).
    map((at) => at.trait_id);
    setTraitIds(currentTraits);
    setInitialTraitIds(currentTraits);
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
    setMicrochipNumber(animal.microchip_number ?? '');
    setDescription(animal.description ?? '');
    setIntakeDateError(undefined);
    setPhotoError(undefined);
    setReason('');
    setInternalNotes(animal.internal_notes ?? '');
    // Snapshot from the animal at open; collections (animalTraits/speciesCatalog)
    // intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Validation runs top-to-bottom and stops at the first failure; scroll that
    // field into view so the block isn't invisible when it's below the fold.
    if (!name.trim() && !rescueId.trim()) {
      setNameError('Animals must have either a Name or Rescue ID.');
      requestAnimationFrame(() => focusFirstError(['edit_name']));
      return;
    }
    const ageInfo = deriveAgeInfo({
      birthdate: ageMode === 'birthdate' ? birthdate : '',
      ageValue: ageMode === 'age' ? ageValue : '',
      ageUnit,
      asOf: ageAsOf
    });
    if (!ageInfo.valid) {
      setAgeError('Enter a birthdate or an estimated age.');
      const ageId =
      ageMode === 'age' ? 'estimated_age_value' : 'estimated_birthdate';
      requestAnimationFrame(() => focusFirstError([ageId]));
      return;
    }
    if (!intakeDate) {
      setIntakeDateError('Intake date is required.');
      requestAnimationFrame(() => focusFirstError(['edit_intake_date']));
      return;
    }
    if (!isValidUrl(photoUrl.trim())) {
      setPhotoError('Enter a valid URL.');
      requestAnimationFrame(() => focusFirstError(['edit_photo']));
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
      name: name.trim() || undefined,
      rescue_id: rescueId.trim() || undefined,
      species,
      species_id: speciesId || undefined,
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
      microchip_number: microchipNumber.trim() || undefined,
      description: description.trim(),
      internal_notes: internalNotes.trim() || undefined
    });

    setAnimalTraits(animalId, traitIds);

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
      `Delete ${animalDisplayName(animal)}? This permanently removes the animal record and can't be undone.`
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
      title={`Edit ${animalDisplayName(animal)}`}
      size="lg"
      footer={
      <div className="flex items-center justify-between gap-3">
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
            <Button type="submit" form="edit-animal-form">
              Save Changes
            </Button>
          </div>
        </div>
      }>

      <form id="edit-animal-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <FormSection title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_name">Name</Label>
              <Input
                id="edit_name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(undefined);
                }}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'edit_name_error' : undefined}
                className={nameError && 'border-red-500 focus:ring-red-500'}
                placeholder="e.g. Biscuit" />

              <FieldError id="edit_name_error">{nameError}</FieldError>
            </div>
            <div>
              <Label htmlFor="edit_rescue_id">Rescue ID</Label>
              <Input
                id="edit_rescue_id"
                value={rescueId}
                onChange={(e) => {
                  setRescueId(e.target.value);
                  if (nameError) setNameError(undefined);
                }}
                aria-invalid={Boolean(nameError)}
                className={
                nameError ?
                'border-red-500 focus:ring-red-500 font-mono' :
                'font-mono'
                }
                placeholder="e.g. DanBH-1" />

            </div>
          </div>
          <p className="text-xs text-text-secondary -mt-2">
            Either a Name or a Rescue ID is required.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_species" required>Species</Label>
              <Select
                id="edit_species"
                value={speciesId}
                onChange={(e) => {
                  const next = speciesCatalog.find((s) => s.id === e.target.value);
                  setSpeciesId(next?.id ?? '');
                  setSpecies(next?.name ?? '');
                  // Species changed → clear the now-mismatched breed.
                  setBreedId(undefined);
                  setBreedText(undefined);
                }}>

                {(() => {
                  // Org-enabled species, plus the animal's current species even
                  // if it's since been disabled (so editing never drops it).
                  const enabled = enabledSpeciesList(speciesCatalog, organizationSpecies);
                  const cur = speciesCatalog.find((s) => s.id === speciesId);
                  const opts =
                  cur && !enabled.some((s) => s.id === cur.id) ?
                  [cur, ...enabled] :
                  enabled;
                  return opts.map((s) =>
                  <option key={s.id} value={s.id}>{s.name}</option>
                  );
                })()}
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_sex" required>Sex</Label>
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
            <Label htmlFor="edit_breed">
              {breedFieldLabel(
                speciesCatalog.find((s) => s.id === speciesId)?.slug
              )}
            </Label>
            <BreedCombobox
              id="edit_breed"
              speciesId={speciesId}
              breedId={breedId}
              breedText={breedText}
              onChange={(next) => {
                setBreedId(next.breed_id);
                setBreedText(next.breed_text);
              }} />

          </div>
          {/* Photo URL field — temporarily hidden in favour of the hero
              upload flow. Keep the state hydrated so the field can be
              uncommented later without rebuilding the wiring. */}
          {/*
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
          */}
          <div>
            <Label htmlFor="edit_microchip">Microchip Number</Label>
            <Input
              id="edit_microchip"
              value={microchipNumber}
              onChange={(e) => setMicrochipNumber(e.target.value)}
              placeholder="e.g. 985112345678901" />

            <p className="mt-1 text-xs text-text-secondary">
              Optional. The readiness checklist will mark Microchipped once a
              chip number is on file.
            </p>
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
              <Label htmlFor="edit_intake_date" required>Intake Date</Label>
              <DatePicker
                id="edit_intake_date"
                required
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
              <Label htmlFor="edit_status" required>Status</Label>
              <Select
                id="edit_status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AnimalStatus)}>

                <option value="intake">Intake</option>
                <option value="in_care">In Care</option>
                <option value="adoptable">Adoptable</option>
                <option value="adopted">Adopted</option>
                <option value="released">Released</option>
                <option value="hospice">Hospice</option>
                <option value="deceased">Deceased</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_priority" required>Priority</Label>
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
          <div className="space-y-5">
            <div>
              <h4 className="text-xs uppercase tracking-wider font-semibold text-text-secondary mb-3">
                Operational
              </h4>
              <ConcernCheckbox
                label="On Hold"
                checked={isOnHold}
                onChange={setIsOnHold}
                help="Temporarily unavailable for adoption or transfer" />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wider font-semibold text-text-secondary mb-3">
                Care Considerations
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <ConcernCheckbox
                  label="Behavior Concern"
                  checked={behaviorConcern}
                  onChange={setBehaviorConcern}
                  help="Behavioral considerations staff or fosters should know" />
                <ConcernCheckbox
                  label="Medical Concern"
                  checked={medicalConcern}
                  onChange={setMedicalConcern}
                  help="Medical considerations requiring ongoing awareness" />
              </div>
            </div>
          </div>
        </FormSection>

        {/* Traits — expanded by default if the animal already has some. The key
            forces a remount once the hydrated selection is known so defaultOpen
            reflects it. */}
        <FormSection
          key={`traits-${animalId}-${initialTraitIds.length > 0}`}
          title="Traits"
          collapsible
          defaultOpen={initialTraitIds.length > 0}>
          <TraitMultiSelect
            speciesId={speciesId || undefined}
            selectedIds={traitIds}
            initialSelectedIds={initialTraitIds}
            onChange={setTraitIds} />
        </FormSection>

        {/* Notes & Activity */}
        <FormSection title="Notes & Activity" collapsible defaultOpen={false}>
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

      </form>
    </Modal>);

}
