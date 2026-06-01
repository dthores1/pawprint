import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Select, Textarea, Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { FormSection } from '../ui/FormSection';
import { AgeInformationFields, AgeInputMode } from './AgeInformationFields';
import { BreedCombobox } from './BreedCombobox';
import { LitterForm } from './LitterForm';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalStatus, Species, Sex, Priority, AgeUnit } from '../../types';
import { deriveAgeInfo } from '../../lib/age';
interface AddAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which sub-form to open on first render (e.g. 'litter' from the Litters tab). */
  initialMode?: AddMode;
}
const INITIAL = {
  name: '',
  // Operational identifier (e.g. `DanBH-1`). Either name or rescue_id (or both)
  // is required — the DB CHECK enforces it, and so does the submit validator.
  rescue_id: '',
  species: 'Dog' as Species,
  sex: 'Unknown' as Sex,
  breed_id: undefined as string | undefined,
  breed_text: undefined as string | undefined,
  // Age is captured as either a birthdate or an estimated age (resolved to a
  // canonical estimated_birth_date on submit).
  birthdate: '',
  ageValue: '',
  ageUnit: 'months' as AgeUnit,
  intake_date: new Date().toISOString().split('T')[0],
  intake_source: '',
  status: 'intake' as AnimalStatus,
  priority: 'normal' as Priority,
  description: '',
  microchip_number: '',
  primary_photo_url: ''
};
type AnimalForm = typeof INITIAL;
type FormField = keyof AnimalForm;
type FormErrors = Partial<Record<FormField, string>>;
const NAME_OR_RESCUE_ID_MESSAGE =
'Animals must have either a Name or Rescue ID.';

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateForm(formData: AnimalForm, ageMode: AgeInputMode): FormErrors {
  const nextErrors: FormErrors = {};
  if (!formData.name.trim() && !formData.rescue_id.trim()) {
    // Surface the same message on both fields so it's visible regardless of
    // which one the user is looking at.
    nextErrors.name = NAME_OR_RESCUE_ID_MESSAGE;
    nextErrors.rescue_id = NAME_OR_RESCUE_ID_MESSAGE;
  }
  // Require enough age info to derive a birthdate (one path or the other).
  // Estimated age is anchored to today (it's the animal's *current* age),
  // independent of when it was taken in.
  const asOf = new Date().toISOString().split('T')[0];
  const ageInfo = deriveAgeInfo({
    birthdate: ageMode === 'birthdate' ? formData.birthdate : '',
    ageValue: ageMode === 'age' ? formData.ageValue : '',
    ageUnit: formData.ageUnit,
    asOf
  });
  if (!ageInfo.valid) {
    nextErrors.birthdate = 'Enter a birthdate or an estimated age.';
  }
  if (!formData.intake_date) nextErrors.intake_date = 'Intake date is required.';
  if (!formData.intake_source.trim()) {
    nextErrors.intake_source = 'Intake source is required.';
  }
  if (!isValidUrl(formData.primary_photo_url)) {
    nextErrors.primary_photo_url = 'Enter a valid URL.';
  }
  return nextErrors;
}
type AddMode = 'single' | 'litter';

export function AddAnimalModal({
  isOpen,
  onClose,
  initialMode = 'single'
}: AddAnimalModalProps) {
  const { addAnimal } = useWhisker();
  const [mode, setMode] = useState<AddMode>(initialMode);
  const [formData, setFormData] = useState(INITIAL);
  const [ageMode, setAgeMode] = useState<AgeInputMode>('birthdate');
  const [errors, setErrors] = useState<FormErrors>({});
  // Open on the requested sub-form each time the modal is shown.
  useEffect(() => {
    if (isOpen) setMode(initialMode);
  }, [isOpen, initialMode]);
  const handleClose = () => {
    setFormData(INITIAL);
    setAgeMode('birthdate');
    setErrors({});
    setMode(initialMode);
    onClose();
  };
  // Estimated age means "current age", so anchor it to today — not intake.
  const asOf = new Date().toISOString().split('T')[0];
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateForm(formData, ageMode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const ageInfo = deriveAgeInfo({
      birthdate: ageMode === 'birthdate' ? formData.birthdate : '',
      ageValue: ageMode === 'age' ? formData.ageValue : '',
      ageUnit: formData.ageUnit,
      asOf
    });
    addAnimal({
      name: formData.name.trim() || undefined,
      rescue_id: formData.rescue_id.trim() || undefined,
      species: formData.species,
      sex: formData.sex,
      breed_id: formData.breed_id,
      breed_text: formData.breed_text,
      intake_date: formData.intake_date,
      intake_source: formData.intake_source.trim(),
      status: formData.status,
      priority: formData.priority,
      description: formData.description.trim(),
      microchip_number: formData.microchip_number.trim(),
      primary_photo_url: formData.primary_photo_url.trim(),
      estimated_birth_date: ageInfo.estimated_birth_date,
      birthdate_source: ageInfo.birthdate_source,
      estimated_age_value: ageInfo.estimated_age_value,
      estimated_age_unit: ageInfo.estimated_age_unit,
      estimated_age_as_of: ageInfo.estimated_age_as_of
    });
    handleClose();
  };
  const handleChange = (
  e: React.ChangeEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>

  {
    const { name, value } = e.target;
    const fieldName = name as FormField;
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value
    }));
    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    }
  };
  // Age inputs are managed directly (not by name) and clear the age error.
  const setAgeField = (patch: Partial<AnimalForm>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    if (errors.birthdate) {
      setErrors((prev) => ({ ...prev, birthdate: undefined }));
    }
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'litter' ? 'Add Litter' : 'Add New Animal'}>

      <div className="space-y-4">
        {/* — What are you adding? — */}
        <div className="rounded-xl border border-border bg-background/50 p-4">
          <p className="text-xs uppercase tracking-wider font-semibold text-text-secondary mb-3">
            What are you adding?
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="radio"
                name="add_mode"
                checked={mode === 'single'}
                onChange={() => setMode('single')}
                className="w-4 h-4 text-primary focus:ring-primary" />

              Single Animal
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="radio"
                name="add_mode"
                checked={mode === 'litter'}
                onChange={() => setMode('litter')}
                className="w-4 h-4 text-primary focus:ring-primary" />

              Litter
            </label>
          </div>
        </div>

        {mode === 'litter' ?
        <LitterForm onClose={handleClose} /> :

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* — Basic Information — */}
        <FormSection title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'name_error' : undefined}
                className={errors.name && 'border-red-500 focus:ring-red-500'}
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Biscuit" />
              <FieldError id="name_error">{errors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="rescue_id">Rescue ID</Label>
              <Input
                id="rescue_id"
                name="rescue_id"
                aria-invalid={Boolean(errors.rescue_id)}
                aria-describedby={
                errors.rescue_id ? 'rescue_id_error' : undefined
                }
                className={
                errors.rescue_id ?
                'border-red-500 focus:ring-red-500 font-mono' :
                'font-mono'
                }
                value={formData.rescue_id}
                onChange={handleChange}
                placeholder="Rescue-assigned ID" />

              <FieldError id="rescue_id_error">{errors.rescue_id}</FieldError>
            </div>
          </div>
          <p className="text-xs text-text-secondary -mt-2">
            Either a Name or a Rescue ID is required. Most animals will have
            both.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="species" required>Species</Label>
              <Select
                id="species"
                name="species"
                value={formData.species}
                onChange={handleChange}>

                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
                <option value="Other">Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="sex" required>Sex</Label>
              <Select
                id="sex"
                name="sex"
                value={formData.sex}
                onChange={handleChange}>

                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unknown">Unknown</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="breed">Breed</Label>
            <BreedCombobox
              id="breed"
              species={formData.species}
              breedId={formData.breed_id}
              breedText={formData.breed_text}
              onChange={(next) =>
              setFormData((prev) => ({ ...prev, ...next }))
              } />

          </div>
          <div>
            <Label htmlFor="primary_photo_url">Photo URL (optional)</Label>
            <Input
              id="primary_photo_url"
              name="primary_photo_url"
              type="url"
              aria-invalid={Boolean(errors.primary_photo_url)}
              aria-describedby={
              errors.primary_photo_url ? 'primary_photo_url_error' : undefined
              }
              className={
              errors.primary_photo_url && 'border-red-500 focus:ring-red-500'
              }
              value={formData.primary_photo_url}
              onChange={handleChange}
              placeholder="https://..." />

            <FieldError id="primary_photo_url_error">
              {errors.primary_photo_url}
            </FieldError>
          </div>
        </FormSection>

        {/* — Age & Intake — */}
        <FormSection title="Age & Intake">
          <AgeInformationFields
            birthdate={formData.birthdate}
            ageValue={formData.ageValue}
            ageUnit={formData.ageUnit}
            asOfDate={asOf}
            mode={ageMode}
            onModeChange={setAgeMode}
            onBirthdate={(v) => setAgeField({ birthdate: v })}
            onAgeValue={(v) => setAgeField({ ageValue: v })}
            onAgeUnit={(v) => setAgeField({ ageUnit: v })}
            error={errors.birthdate} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="intake_date" required>Intake Date</Label>
              <DatePicker
                id="intake_date"
                required
                error={Boolean(errors.intake_date)}
                value={formData.intake_date}
                onChange={(v) => {
                  setFormData((prev) => ({ ...prev, intake_date: v }));
                  if (errors.intake_date) {
                    setErrors((prev) => ({ ...prev, intake_date: undefined }));
                  }
                }} />
              <FieldError id="intake_date_error">
                {errors.intake_date}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="intake_source" required>Intake Source</Label>
              <Input
                id="intake_source"
                name="intake_source"
                aria-invalid={Boolean(errors.intake_source)}
                aria-describedby={
                errors.intake_source ? 'intake_source_error' : undefined
                }
                className={
                errors.intake_source && 'border-red-500 focus:ring-red-500'
                }
                value={formData.intake_source}
                onChange={handleChange}
                placeholder="e.g. City Shelter Transfer" />
              <FieldError id="intake_source_error">
                {errors.intake_source}
              </FieldError>
            </div>
          </div>
        </FormSection>

        {/* — Intake Notes — */}
        <FormSection title="Intake Notes">
          <div>
            <Textarea
              id="description"
              name="description"
              aria-label="Intake notes"
              value={formData.description}
              onChange={handleChange}
              placeholder="Initial observations or intake information…"
              rows={3} />

            <p className="text-xs text-text-secondary mt-1">
              Initial observations or intake information.
            </p>
          </div>
        </FormSection>

        <p className="text-xs text-text-secondary">
          New animals start as <span className="font-medium">Intake</span> /{' '}
          <span className="font-medium">Normal</span> priority. Use{' '}
          <span className="font-medium">Edit</span> or{' '}
          <span className="font-medium">Place in Foster</span> on the profile to
          update status.
        </p>

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Add Animal</Button>
        </div>
        </form>
        }
      </div>
    </Modal>);

}