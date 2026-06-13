import React, { useEffect, useMemo, useState } from 'react';
import { add, parseISO, format } from 'date-fns';
import { AlertCircleIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Select, Textarea, Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { ClinicEventSearchPicker } from '../ui/ClinicEventSearchPicker';
import { Button } from '../ui/Button';
import { formatDate, animalDisplayName } from '../../lib/utils';
import { focusFirstError } from '../../lib/focusFirstError';
import { useWhisker } from '../../context/WhiskerContext';
import {
  PROCEDURE_TYPE_OPTIONS,
  PROCEDURE_TYPE_LABELS,
  getProcedureOptions,
  getDefaultProcedure,
  getProcedureLabel,
  showCustomProcedureName,
  showProductName,
  showMicrochipNumber,
  showClinicalDetail,
  ROUTE_OPTIONS,
  DOSE_UNIT_OPTIONS,
  deriveProcedureName } from
'../../lib/medicalOptions';
import {
  Animal,
  ProcedureType,
  Procedure,
  Route,
  DoseUnit,
  MedicalStatus,
  AgeUnit,
  MedicalRecord } from
'../../types';

interface AddMedicalModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
  animal: Animal;
  /**
   * When provided, the modal switches to edit mode: form is pre-populated
   * with the record's current values and Save calls `updateMedicalRecord`
   * instead of creating a new row.
   */
  record?: MedicalRecord;
}
type FormErrors = {
  procedure?: string;
  custom_procedure_name?: string;
  performed_date?: string;
  due_date?: string;
};
// Validatable fields in visual order; on a blocked submit we scroll to the
// first one with an error (its key matches the input's DOM id).
const ERROR_FIELD_ORDER: (keyof FormErrors)[] = [
'procedure',
'custom_procedure_name',
'performed_date',
'due_date'];
// Only these procedure types are commonly recurring, so the "next due" prompt
// is offered just for them (keeps the form low-friction for one-off records).
const RECURRING_TYPES = new Set<ProcedureType>([
'vaccine',
'parasite_prevention',
'exam',
'surgery',
'medication']
);
// Procedure types that should never have more than one active record per
// animal — duplicates are blocked unless the existing one is cancelled.
const UNIQUE_TYPES = new Set<ProcedureType>(['spay_neuter', 'microchip']);
const STATUS_LABELS: Record<MedicalStatus, string> = {
  completed: 'completed',
  due: 'due',
  scheduled: 'scheduled',
  overdue: 'overdue',
  cancelled: 'cancelled',
  not_applicable: 'not applicable'
};
const AGE_UNITS: AgeUnit[] = ['days', 'weeks', 'months', 'years'];

// base + N units → yyyy-MM-dd (or '' when inputs are incomplete).
function computeNextDue(base: string, value: number, unit: AgeUnit): string {
  if (!base || !value || value <= 0) return '';
  return format(add(parseISO(base), { [unit]: value }), 'yyyy-MM-dd');
}
// Indefinite article matching the leading vowel sound of the next word.
// Cheap heuristic — fine for the closed set of status labels we use here.
function articleFor(word: string): 'a' | 'an' {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}
type FormState = {
  procedure_type: ProcedureType;
  procedure: string;
  custom_procedure_name: string;
  product_name: string;
  status: MedicalStatus;
  performed_date: string;
  due_date: string;
  provider_contact_id: string;
  provider_name: string;
  clinic_id: string;
  facility_name: string;
  microchip_number: string;
  lot_number: string;
  manufacturer: string;
  dosage: string;
  dose_unit: string;
  route: string;
  body_location: string;
  expiration_date: string;
  notes: string;
  next_due_date: string;
};
const EMPTY_FORM: FormState = {
  procedure_type: 'vaccine',
  procedure: '',
  custom_procedure_name: '',
  product_name: '',
  status: 'completed',
  performed_date: '',
  due_date: '',
  provider_contact_id: '',
  provider_name: '',
  clinic_id: '',
  facility_name: '',
  microchip_number: '',
  lot_number: '',
  manufacturer: '',
  dosage: '',
  dose_unit: '',
  route: '',
  body_location: '',
  expiration_date: '',
  notes: '',
  next_due_date: ''
};
function formStateFromRecord(r: MedicalRecord | undefined): FormState {
  if (!r) return EMPTY_FORM;
  return {
    procedure_type: r.procedure_type,
    // Legacy rows have no structured procedure but may carry a backfilled
    // custom name — default them to "Other" so that name stays visible/editable.
    procedure: r.procedure ?? (r.custom_procedure_name ? 'other' : ''),
    custom_procedure_name: r.custom_procedure_name ?? '',
    product_name: r.product_name ?? '',
    status: r.status,
    performed_date: r.performed_date ?? '',
    due_date: r.due_date ?? '',
    provider_contact_id: r.provider_contact_id ?? '',
    provider_name: r.provider_name ?? '',
    clinic_id: r.clinic_id ?? '',
    facility_name: r.facility_name ?? '',
    microchip_number: r.microchip_number ?? '',
    lot_number: r.lot_number ?? '',
    manufacturer: r.manufacturer ?? '',
    dosage: r.dosage != null ? String(r.dosage) : '',
    dose_unit: r.dose_unit ?? '',
    route: r.route ?? '',
    body_location: r.body_location ?? '',
    expiration_date: r.expiration_date ?? '',
    notes: r.notes ?? '',
    next_due_date: r.next_due_date ?? ''
  };
}

export function AddMedicalModal({
  isOpen,
  onClose,
  animalId,
  animal,
  record
}: AddMedicalModalProps) {
  const {
    addMedicalRecord,
    updateMedicalRecord,
    updateAnimal,
    peopleIndex: people,
    clinicEvents,
    medicalRecords
  } = useWhisker();
  const isEditMode = !!record;
  const [formData, setFormData] = useState<FormState>(() =>
  formStateFromRecord(record)
  );
  const [errors, setErrors] = useState<FormErrors>({});
  // Each lookup falls back to free text: pick from contacts/clinics, or type.
  const [performedByMode, setPerformedByMode] = useState<'contact' | 'manual'>(
    record?.provider_name && !record.provider_contact_id ? 'manual' : 'contact'
  );
  const [facilityMode, setFacilityMode] = useState<'clinic' | 'other'>(
    record?.facility_name && !record.clinic_id ? 'other' : 'clinic'
  );
  // Next-due input mode: relative interval (default) or an explicit date.
  const [nextDueMode, setNextDueMode] = useState<'relative' | 'date'>(
    record?.next_due_date ? 'date' : 'relative'
  );
  const [intervalValue, setIntervalValue] = useState('');
  const [intervalUnit, setIntervalUnit] = useState<AgeUnit>('months');
  // Escape hatch for a completed record whose exact date genuinely isn't known
  // (historic vaccines, imported records, "altered before intake", etc.). The
  // date stays required by default; this lets the user explicitly opt out.
  const [dateUnknown, setDateUnknown] = useState<boolean>(
    !!record && record.status === 'completed' && !record.performed_date
  );

  // Re-populate the form whenever the modal is opened (or the editing target
  // changes), so closing and reopening the modal always reflects the current
  // record/blank state instead of stale values from the previous session.
  useEffect(() => {
    if (!isOpen) return;
    setFormData(formStateFromRecord(record));
    setErrors({});
    setPerformedByMode(
      record?.provider_name && !record.provider_contact_id ?
      'manual' :
      'contact'
    );
    setFacilityMode(
      record?.facility_name && !record.clinic_id ? 'other' : 'clinic'
    );
    setNextDueMode(record?.next_due_date ? 'date' : 'relative');
    setIntervalValue('');
    setIntervalUnit('months');
    setDateUnknown(
      !!record && record.status === 'completed' && !record.performed_date
    );
  }, [isOpen, record]);

  // Valid `procedure` options for the current type, gated by species/sex.
  const procedureOptions = useMemo(
    () =>
    getProcedureOptions({
      procedureType: formData.procedure_type,
      species: animal.species,
      sex: animal.sex
    }),
    [formData.procedure_type, animal.species, animal.sex]
  );

  // When the type (or animal's species/sex) changes the valid option set, drop
  // a now-invalid `procedure` and pre-select the sensible default for the type
  // (e.g. vaccine → rabies, microchip → implant, spay/neuter → matches sex).
  useEffect(() => {
    setFormData((prev) => {
      if (procedureOptions.some((o) => o.value === prev.procedure)) return prev;
      return {
        ...prev,
        procedure: getDefaultProcedure({
          procedureType: prev.procedure_type,
          species: animal.species,
          sex: animal.sex
        }),
        custom_procedure_name: ''
      };
    });
    // procedureOptions is derived from these deps; re-running on it directly
    // would loop, so we key off the underlying inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.procedure_type, animal.species, animal.sex]);

  const showCustom = showCustomProcedureName(formData.procedure);
  const showProduct = showProductName(formData.procedure_type);
  const showMicrochip = showMicrochipNumber(formData.procedure_type);
  const showDetail = showClinicalDetail(formData.procedure_type);
  const procedureFieldLabel = getProcedureLabel(formData.procedure_type);

  // The date the next-due offset is measured from (and the gate for showing it).
  const baseDate =
  formData.status === 'completed' ? formData.performed_date : formData.due_date;
  const showNextDue = RECURRING_TYPES.has(formData.procedure_type) && !!baseDate;

  // Duplicate detection — at most one non-cancelled spay/neuter or microchip
  // record per animal. In edit mode we exclude the current record itself so
  // the user can keep editing the existing row without tripping the warning.
  const conflictingRecord = useMemo(() => {
    if (!UNIQUE_TYPES.has(formData.procedure_type)) return undefined;
    return medicalRecords.find(
      (m) =>
      m.animal_id === animalId &&
      m.procedure_type === formData.procedure_type &&
      m.status !== 'cancelled' &&
      m.id !== record?.id
    );
  }, [animalId, formData.procedure_type, medicalRecords, record?.id]);
  const duplicateMessage = conflictingRecord ?
  (() => {
    const typeLabel = PROCEDURE_TYPE_LABELS[conflictingRecord.procedure_type];
    const statusLabel = STATUS_LABELS[conflictingRecord.status];
    return `${animalDisplayName(animal)} already has ${articleFor(statusLabel)} ${statusLabel} ${typeLabel}. Please edit the existing ${typeLabel} medical record.`;
  })() :
  null;
  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!formData.procedure) {
      next.procedure = `${procedureFieldLabel} is required.`;
    } else if (
    formData.procedure === 'other' &&
    !formData.custom_procedure_name.trim())
    {
      next.custom_procedure_name = 'Please name the procedure.';
    }
    if (formData.status === 'completed') {
      if (!dateUnknown && !formData.performed_date) {
        next.performed_date = 'Date performed is required.';
      }
    } else if (!formData.due_date) {
      next.due_date = 'Due date is required.';
    }
    return next;
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateMessage) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const ids = ERROR_FIELD_ORDER.filter((f) => nextErrors[f]);
      requestAnimationFrame(() => focusFirstError(ids));
      return;
    }
    const microchipNumber =
    showMicrochip ? formData.microchip_number.trim() : '';
    const performedDate =
    formData.status === 'completed' && !dateUnknown ?
    formData.performed_date :
    undefined;
    const dueDate =
    formData.status !== 'completed' ? formData.due_date : undefined;
    const nextDueDate = showNextDue ?
    formData.next_due_date || undefined :
    undefined;

    const procedure = formData.procedure ?
    (formData.procedure as Procedure) :
    undefined;
    const procedureName = deriveProcedureName({
      procedure_type: formData.procedure_type,
      procedure,
      custom_procedure_name: formData.custom_procedure_name
    });
    const dosageNum = Number(formData.dosage);
    // Build a fully-specified payload so switching a type *clears* the fields
    // that no longer apply (empty strings normalize to null on write) rather
    // than leaving stale values behind.
    const payload: Omit<MedicalRecord, 'id'> = {
      animal_id: animalId,
      procedure_type: formData.procedure_type,
      procedure,
      procedure_name: procedureName,
      custom_procedure_name: showCustom ?
      formData.custom_procedure_name.trim() :
      '',
      product_name: showProduct ? formData.product_name.trim() : '',
      status: formData.status,
      performed_date: performedDate,
      due_date: dueDate,
      provider_contact_id: formData.provider_contact_id || undefined,
      provider_name: formData.provider_name || undefined,
      clinic_id: formData.clinic_id || undefined,
      facility_name: formData.facility_name || undefined,
      microchip_number: showMicrochip ? microchipNumber : '',
      lot_number: showDetail ? formData.lot_number.trim() : '',
      manufacturer: showDetail ? formData.manufacturer.trim() : '',
      // '' clears the numeric column on write (normalizes to null), so editing
      // a record and blanking the dosage actually removes it.
      dosage: (showDetail && formData.dosage && Number.isFinite(dosageNum) ?
      dosageNum :
      '') as unknown as number,
      // '' clears the column on write (normalizes to null); the enum cast is a
      // controlled lie since '' never reaches the typed DB value.
      dose_unit: (showDetail ? formData.dose_unit : '') as DoseUnit,
      route: (showDetail ? formData.route : '') as Route,
      body_location: showDetail ? formData.body_location.trim() : '',
      expiration_date: showDetail ? formData.expiration_date : '',
      notes: formData.notes || undefined,
      next_due_date: nextDueDate
    };

    if (isEditMode && record) {
      updateMedicalRecord(record.id, payload);
    } else {
      addMedicalRecord(payload);
    }
    // Mirror the chip number onto the animal record so the readiness checklist
    // flips immediately and the chip badge in the hero reflects reality. We
    // only overwrite when the user actually provided one this time — leaving
    // an existing chip number alone if the field's blank.
    if (microchipNumber && microchipNumber !== (animal.microchip_number ?? '')) {
      updateAnimal(animalId, { microchip_number: microchipNumber });
    }
    onClose();
  };
  const handleChange = (
  e: React.ChangeEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
  {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name in errors && errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };
  // Setting the performed/due date also re-derives next_due_date when a relative
  // interval is already entered (so the offset tracks the base date).
  const handleBaseDateChange = (field: 'performed_date' | 'due_date', v: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: v,
      next_due_date:
      nextDueMode === 'relative' && intervalValue ?
      computeNextDue(v, Number(intervalValue), intervalUnit) :
      prev.next_due_date
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };
  const setInterval = (valueStr: string, unit: AgeUnit) => {
    setIntervalValue(valueStr);
    setIntervalUnit(unit);
    setFormData((prev) => ({
      ...prev,
      next_due_date: computeNextDue(baseDate, Number(valueStr), unit)
    }));
  };
  const titleSuffix = isEditMode ? 'Edit Medical Record' : 'Add Medical Record';
  const submitLabel = isEditMode ? 'Update Record' : 'Save Record';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={animalDisplayName(animal) + ' | ' + titleSuffix}
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
          type="submit"
          form="add-medical-form"
          disabled={!!duplicateMessage}>

            {submitLabel}
          </Button>
        </div>
      }>

      <form
        id="add-medical-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="procedure_type" required>Type</Label>
            <Select
              id="procedure_type"
              name="procedure_type"
              value={formData.procedure_type}
              onChange={handleChange}>

              {PROCEDURE_TYPE_OPTIONS.map((o) =>
              <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              )}
            </Select>
            {duplicateMessage &&
            <p
              role="alert"
              className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-[#A36B00]">

                <AlertCircleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{duplicateMessage}</span>
              </p>
            }
          </div>
          <div>
            <Label htmlFor="status" required>Status</Label>
            <Select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}>

              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
              <option value="due">Due</option>
              {isEditMode && <option value="overdue">Overdue</option>}
              {isEditMode && <option value="cancelled">Cancelled</option>}
              {isEditMode &&
              <option value="not_applicable">Not applicable</option>}
            </Select>
          </div>
        </div>

        {/* Structured subtype — options depend on the type (and, for vaccines
            and spay/neuter, the animal's species/sex). */}
        <div>
          <Label htmlFor="procedure" required>{procedureFieldLabel}</Label>
          <Select
            id="procedure"
            name="procedure"
            aria-invalid={Boolean(errors.procedure)}
            className={errors.procedure ? 'border-red-500 focus:ring-red-500' : undefined}
            value={formData.procedure}
            onChange={handleChange}>

            {procedureOptions.length !== 1 &&
            <option value="">Select…</option>}
            {procedureOptions.map((o) =>
            <option key={o.value} value={o.value}>
                {o.label}
              </option>
            )}
          </Select>
          <FieldError id="procedure_error">{errors.procedure}</FieldError>
        </div>

        {/* Custom name — only when the structured subtype is "Other". */}
        {showCustom &&
        <div>
            <Label htmlFor="custom_procedure_name" required>
              Custom Procedure Name
            </Label>
            <Input
            id="custom_procedure_name"
            name="custom_procedure_name"
            aria-invalid={Boolean(errors.custom_procedure_name)}
            className={errors.custom_procedure_name ? 'border-red-500 focus:ring-red-500' : undefined}
            value={formData.custom_procedure_name}
            onChange={handleChange}
            placeholder="Describe the procedure" />
            <FieldError id="custom_procedure_name_error">
              {errors.custom_procedure_name}
            </FieldError>
          </div>
        }

        {/* Optional product / treatment brand. */}
        {showProduct &&
        <div>
            <Label htmlFor="product_name">Product / Treatment</Label>
            <Input
            id="product_name"
            name="product_name"
            value={formData.product_name}
            onChange={handleChange}
            placeholder="e.g. Revolution Plus, Frontline" />
          </div>
        }

        {/* Microchip number — only relevant when the procedure type is
            Microchip. Optional: the chip may be implanted before the number
            is on hand. Saving copies the value onto animals.microchip_number. */}
        {showMicrochip &&
        <div>
            <Label htmlFor="microchip_number">Microchip Number</Label>
            <Input
            id="microchip_number"
            name="microchip_number"
            value={formData.microchip_number}
            onChange={handleChange}
            placeholder="e.g. 985112345678901" />

            <p className="mt-1 text-xs text-text-secondary">
              Optional — leave blank if you don't have the number yet.
            </p>
          </div>
        }

        {formData.status === 'completed' ?
        <div>
            <Label htmlFor="performed_date" required={!dateUnknown}>
              Date Performed
            </Label>
            <DatePicker
            id="performed_date"
            required={!dateUnknown}
            disabled={dateUnknown}
            error={Boolean(errors.performed_date)}
            value={dateUnknown ? '' : formData.performed_date}
            onChange={(v) => handleBaseDateChange('performed_date', v)} />
            <FieldError id="performed_date_error">{errors.performed_date}</FieldError>
            {dateUnknown ?
            <label className="mt-2 inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                type="checkbox"
                checked={dateUnknown}
                onChange={(e) => setDateUnknown(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer" />

                <span className="text-text-secondary">
                  Date unknown — this record will be saved without a date.
                </span>
              </label> :

            <button
              type="button"
              onClick={() => setDateUnknown(true)}
              className="mt-2 text-xs font-medium text-primary hover:underline">

                Can't find the date?
              </button>
            }
          </div> :

        <div>
            <Label htmlFor="due_date" required>Due Date</Label>
            <DatePicker
            id="due_date"
            required
            error={Boolean(errors.due_date)}
            value={formData.due_date}
            onChange={(v) => handleBaseDateChange('due_date', v)} />
            <FieldError id="due_date_error">{errors.due_date}</FieldError>
          </div>
        }

        {/* Clinical detail — meaningful for administered products (vaccines,
            medications, parasite preventatives). */}
        {showDetail &&
        <div className="rounded-xl border border-border bg-background/50 p-4 space-y-4">
            <p className="text-sm font-medium text-text-primary">
              Clinical detail{' '}
              <span className="font-normal text-text-secondary">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lot_number">Lot Number</Label>
                <Input
                id="lot_number"
                name="lot_number"
                value={formData.lot_number}
                onChange={handleChange}
                placeholder="e.g. A1234B" />
              </div>
              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                id="manufacturer"
                name="manufacturer"
                value={formData.manufacturer}
                onChange={handleChange}
                placeholder="e.g. Zoetis" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dosage">Dosage</Label>
                <div className="flex gap-2">
                  <Input
                  id="dosage"
                  name="dosage"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={formData.dosage}
                  onChange={handleChange}
                  placeholder="e.g. 1" />
                  <Select
                  aria-label="Dose unit"
                  name="dose_unit"
                  value={formData.dose_unit}
                  onChange={handleChange}
                  className="w-32">
                    <option value="">unit…</option>
                    {DOSE_UNIT_OPTIONS.map((o) =>
                  <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                  )}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="route">Route</Label>
                <Select
                id="route"
                name="route"
                value={formData.route}
                onChange={handleChange}>
                  <option value="">Select…</option>
                  {ROUTE_OPTIONS.map((o) =>
                <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                )}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="body_location">Body Location</Label>
                <Input
                id="body_location"
                name="body_location"
                value={formData.body_location}
                onChange={handleChange}
                placeholder="e.g. left rear leg" />
              </div>
              <div>
                <Label htmlFor="expiration_date">Expiration Date</Label>
                <DatePicker
                id="expiration_date"
                align="end"
                value={formData.expiration_date}
                onChange={(v) =>
                setFormData((prev) => ({ ...prev, expiration_date: v }))
                } />
              </div>
            </div>
          </div>
        }

        {/* Performed by — known contact or free-text fallback */}
        <div>
          <Label htmlFor="performed_by">Performed by</Label>
          {performedByMode === 'contact' ?
          <>
              <PersonSearchPicker
              id="performed_by"
              people={people}
              value={formData.provider_contact_id}
              onChange={(personId) =>
              setFormData((prev) => ({
                ...prev,
                provider_contact_id: personId,
                provider_name: ''
              }))
              }
              placeholder="Search vets, staff, or volunteers…" />

              <button
              type="button"
              onClick={() => {
                setPerformedByMode('manual');
                setFormData((prev) => ({ ...prev, provider_contact_id: '' }));
              }}
              className="mt-2 text-xs text-primary hover:underline">

                Not listed? Enter name manually
              </button>
            </> :

          <>
              <Input
              id="performed_by"
              value={formData.provider_name}
              onChange={(e) =>
              setFormData((prev) => ({ ...prev, provider_name: e.target.value }))
              }
              placeholder="e.g. Dr. Smith, shelter volunteer…" />

              <button
              type="button"
              onClick={() => {
                setPerformedByMode('contact');
                setFormData((prev) => ({ ...prev, provider_name: '' }));
              }}
              className="mt-2 text-xs text-primary hover:underline">

                Search contacts instead
              </button>
            </>
          }
        </div>

        {/* Facility / Event — scheduled clinic or free-text facility */}
        <div>
          <Label htmlFor="facility">Facility / Event</Label>
          {facilityMode === 'clinic' ?
          <>
              <ClinicEventSearchPicker
              id="facility"
              events={clinicEvents}
              value={formData.clinic_id}
              onChange={(eventId) =>
              setFormData((prev) => ({
                ...prev,
                clinic_id: eventId,
                facility_name: ''
              }))
              } />

              <button
              type="button"
              onClick={() => {
                setFacilityMode('other');
                setFormData((prev) => ({ ...prev, clinic_id: '' }));
              }}
              className="mt-2 text-xs text-primary hover:underline">

                Other facility
              </button>
            </> :

          <>
              <Input
              id="facility"
              value={formData.facility_name}
              onChange={(e) =>
              setFormData((prev) => ({ ...prev, facility_name: e.target.value }))
              }
              placeholder="e.g. Northside Animal Hospital" />

              <button
              type="button"
              onClick={() => {
                setFacilityMode('clinic');
                setFormData((prev) => ({ ...prev, facility_name: '' }));
              }}
              className="mt-2 text-xs text-primary hover:underline">

                Choose a clinic instead
              </button>
            </>
          }
        </div>

        {showNextDue &&
        <div className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Next due date{' '}
                <span className="font-normal text-text-secondary">
                  (optional)
                </span>
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                For recurring procedures — e.g. a rabies booster due in a year.
              </p>
            </div>

            {nextDueMode === 'relative' ?
          <div>
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span>in</span>
                  <Input
                type="number"
                min="1"
                inputMode="numeric"
                aria-label="Interval amount"
                placeholder="e.g. 6"
                value={intervalValue}
                onChange={(e) => setInterval(e.target.value, intervalUnit)}
                className="w-20" />

                  <Select
                aria-label="Interval unit"
                value={intervalUnit}
                onChange={(e) =>
                setInterval(intervalValue, e.target.value as AgeUnit)
                }
                className="w-32">

                    {AGE_UNITS.map((u) =>
                <option key={u} value={u}>
                        {u}
                      </option>
                )}
                  </Select>
                  {formData.next_due_date &&
              <span className="text-text-primary font-medium whitespace-nowrap">
                      → {formatDate(formData.next_due_date)}
                    </span>
              }
                </div>
                <button
              type="button"
              onClick={() => setNextDueMode('date')}
              className="mt-2 text-xs text-primary hover:underline">

                  Enter a date instead
                </button>
              </div> :

          <div>
                <DatePicker
              id="next_due_date"
              value={formData.next_due_date}
              onChange={(v) =>
              setFormData((prev) => ({ ...prev, next_due_date: v }))
              } />

                <button
              type="button"
              onClick={() => setNextDueMode('relative')}
              className="mt-2 text-xs text-primary hover:underline">

                  Enter a relative time instead
                </button>
              </div>
          }
          </div>
        }

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any additional details..." />

        </div>
      </form>
    </Modal>);

}
