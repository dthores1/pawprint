import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Select, Textarea, Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { FormSection } from '../ui/FormSection';
import { AgeInformationFields, AgeInputMode } from './AgeInformationFields';
import { BreedCombobox } from './BreedCombobox';
import { TraitMultiSelect } from './TraitMultiSelect';
import { LitterForm } from './LitterForm';
import { SiteSearchPicker } from '../ui/SiteSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalStatus, Sex, Priority, AgeUnit } from '../../types';
import { deriveAgeInfo } from '../../lib/age';
import { breedFieldLabel } from '../../lib/speciesIcons';
import { enabledSpeciesList, defaultSpeciesId } from '../../lib/orgCatalog';
import { focusFirstError } from '../../lib/focusFirstError';
interface AddAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which sub-form to open on first render (e.g. 'litter' from the Litters tab). */
  initialMode?: AddMode;
  /**
   * Pre-link created animal(s) to a Rescue Site (e.g. when launched from a
   * Site profile). When set, the Site field shows the locked site instead of
   * a picker.
   */
  initialSiteId?: string;
}
const INITIAL = {
  name: '',
  // Operational identifier (e.g. `DanBH-1`). Either name or rescue_id (or both)
  // is required — the DB CHECK enforces it, and so does the submit validator.
  rescue_id: '',
  // Species name + catalog id. Defaulted to the first catalog species once it
  // loads (see effect below); both are written on save.
  species: '',
  species_id: '',
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
    asOf,
    unknown: ageMode === 'unknown'
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

// Validatable fields in visual (top-to-bottom) order, so a failed submit can
// scroll to the FIRST offending field. The modal is tall enough that an error
// below the fold otherwise makes the save look like it silently did nothing.
const FIELD_ORDER: FormField[] = [
'name',
'rescue_id',
'primary_photo_url',
'birthdate',
'intake_date',
'intake_source'];

// The age error lives on the `birthdate` key, but the visible input id depends
// on which age-input mode is currently showing.
function errorFieldDomId(field: FormField, ageMode: AgeInputMode): string {
  if (field === 'birthdate') {
    return ageMode === 'age' ? 'estimated_age_value' : 'estimated_birthdate';
  }
  return field;
}
type AddMode = 'single' | 'litter';

export function AddAnimalModal({
  isOpen,
  onClose,
  initialMode = 'single',
  initialSiteId
}: AddAnimalModalProps) {
  const {
    addAnimal,
    setAnimalTraits,
    species: speciesCatalog,
    organizationSpecies,
    sites
  } = useWhisker();
  const [traitIds, setTraitIds] = useState<string[]>([]);
  const enabledSpecies = enabledSpeciesList(speciesCatalog, organizationSpecies);
  const [mode, setMode] = useState<AddMode>(initialMode);
  const [formData, setFormData] = useState(INITIAL);
  const [siteId, setSiteId] = useState(initialSiteId ?? '');
  const lockedSite = initialSiteId ? sites.find((s) => s.id === initialSiteId) : null;
  const [ageMode, setAgeMode] = useState<AgeInputMode>('birthdate');
  const [errors, setErrors] = useState<FormErrors>({});
  // Lifted from LitterForm so the modal's sticky footer can show the correct
  // button state ("Add Litter (N)" / "Adding…", disabled while submitting).
  // The litter starts with 2 members (see LitterForm); matches the form's
  // initial state so the button label is correct before any user interaction.
  const [litterMembersCount, setLitterMembersCount] = useState(2);
  const [litterSubmitting, setLitterSubmitting] = useState(false);
  // Default to the org's default species (or first enabled) once loaded.
  useEffect(() => {
    if (formData.species_id) return;
    const enabled = enabledSpeciesList(speciesCatalog, organizationSpecies);
    if (enabled.length === 0) return;
    const defId = defaultSpeciesId(speciesCatalog, organizationSpecies);
    const pick = enabled.find((s) => s.id === defId) ?? enabled[0];
    setFormData((prev) => ({ ...prev, species: pick.name, species_id: pick.id }));
  }, [speciesCatalog, organizationSpecies, formData.species_id]);
  const selectedSpecies = speciesCatalog.find((s) => s.id === formData.species_id);
  // Open on the requested sub-form each time the modal is shown.
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setSiteId(initialSiteId ?? '');
      // Launched from a Rescue Site → default the intake source to match (unless
      // the user has already typed something).
      if (initialSiteId) {
        setFormData((prev) => ({
          ...prev,
          intake_source: prev.intake_source || 'Rescue Site'
        }));
      }
    }
  }, [isOpen, initialMode, initialSiteId]);
  const handleClose = () => {
    setFormData(INITIAL);
    setTraitIds([]);
    setAgeMode('birthdate');
    setErrors({});
    setMode(initialMode);
    setSiteId(initialSiteId ?? '');
    setLitterMembersCount(2);
    setLitterSubmitting(false);
    onClose();
  };
  // Estimated age means "current age", so anchor it to today — not intake.
  const asOf = new Date().toISOString().split('T')[0];
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateForm(formData, ageMode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      // Bring the first offending field into view so a below-the-fold error
      // can't read as a silent no-op. rAF lets the error state paint first.
      const ids = FIELD_ORDER.filter((f) => nextErrors[f]).map((f) =>
      errorFieldDomId(f, ageMode)
      );
      requestAnimationFrame(() => focusFirstError(ids));
      return;
    }
    const ageInfo = deriveAgeInfo({
      birthdate: ageMode === 'birthdate' ? formData.birthdate : '',
      ageValue: ageMode === 'age' ? formData.ageValue : '',
      ageUnit: formData.ageUnit,
      asOf,
      unknown: ageMode === 'unknown'
    });
    const created = await addAnimal({
      name: formData.name.trim() || undefined,
      rescue_id: formData.rescue_id.trim() || undefined,
      species: formData.species,
      species_id: formData.species_id || undefined,
      sex: formData.sex,
      breed_id: formData.breed_id,
      breed_text: formData.breed_text,
      intake_date: formData.intake_date,
      intake_source: formData.intake_source.trim(),
      site_id: siteId || undefined,
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
    // Assign any chosen traits once the animal row exists.
    if (created && traitIds.length > 0) {
      setAnimalTraits(created.id, traitIds);
    }
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
      title={mode === 'litter' ? 'Add Litter' : 'Add New Animal'}
      footer={
      mode === 'litter' ?
      <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
            type="submit"
            form="add-litter-form"
            disabled={litterSubmitting}>
              {litterSubmitting ?
            'Adding…' :
            `Add Litter (${litterMembersCount})`}
            </Button>
          </div> :
      <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" form="add-animal-form">
              Add Animal
            </Button>
          </div>
      }>

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
        <LitterForm
          onClose={handleClose}
          formId="add-litter-form"
          siteId={siteId || undefined}
          lockedSiteName={lockedSite?.name}
          onMembersCountChange={setLitterMembersCount}
          onSubmittingChange={setLitterSubmitting} /> :


        <form
          id="add-animal-form"
          onSubmit={handleSubmit}
          className="space-y-4"
          noValidate>
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
            {/* Species picker is hidden when the org only accepts one species —
                it's auto-selected (see default effect). */}
            {enabledSpecies.length > 1 &&
            <div>
              <Label htmlFor="species" required>Species</Label>
              <Select
                id="species"
                name="species"
                value={formData.species_id}
                onChange={(e) => {
                  const next = speciesCatalog.find((s) => s.id === e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    species_id: next?.id ?? '',
                    species: next?.name ?? '',
                    // Species changed → previously chosen breed no longer applies.
                    breed_id: undefined,
                    breed_text: undefined
                  }));
                }}>

                {enabledSpecies.map((s) =>
                <option key={s.id} value={s.id}>{s.name}</option>
                )}
              </Select>
            </div>
            }
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
            <Label htmlFor="breed">{breedFieldLabel(selectedSpecies?.slug)}</Label>
            <BreedCombobox
              id="breed"
              speciesId={formData.species_id}
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
          <div>
            <Label htmlFor="site">Rescue Site (optional)</Label>
            {lockedSite ?
            <div className="px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-sm font-medium text-text-primary">
                {lockedSite.name}
              </div> :

            <SiteSearchPicker
              id="site"
              sites={sites}
              value={siteId}
              onChange={setSiteId} />
            }
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

        {/* — Traits (optional, collapsed by default) — */}
        <FormSection title="Traits" collapsible defaultOpen={false}>
          <p className="text-xs text-text-secondary -mt-1 mb-2">
            Optional — usually added after the animal has been assessed.
          </p>
          <TraitMultiSelect
            speciesId={formData.species_id || undefined}
            selectedIds={traitIds}
            onChange={setTraitIds} />
        </FormSection>

        <p className="text-xs text-text-secondary">
          New animals start as <span className="font-medium">Intake</span> /{' '}
          <span className="font-medium">Normal</span> priority. Use{' '}
          <span className="font-medium">Edit</span> or{' '}
          <span className="font-medium">Place in Foster</span> on the profile to
          update status.
        </p>
        </form>
        }
      </div>
    </Modal>);

}