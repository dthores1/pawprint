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
import { useWhisker } from '../../context/WhiskerContext';
import {
  Animal,
  ProcedureType,
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
  procedure_name?: string;
  performed_date?: string;
  due_date?: string;
};
// Only these procedure types are commonly recurring, so the "next due" prompt
// is offered just for them (keeps the form low-friction for one-off records).
const RECURRING_TYPES = new Set<ProcedureType>([
'vaccine',
'exam',
'surgery',
'medication']
);
// Procedure types that should never have more than one active record per
// animal — duplicates are blocked unless the existing one is canceled.
const UNIQUE_TYPES = new Set<ProcedureType>(['spay_neuter', 'microchip']);
const PROCEDURE_TYPE_LABELS: Record<ProcedureType, string> = {
  vaccine: 'Vaccine',
  exam: 'Exam',
  spay_neuter: 'Spay/Neuter',
  medication: 'Medication',
  surgery: 'Surgery',
  microchip: 'Microchip',
  deworming: 'Deworming',
  test: 'Test'
};
const STATUS_LABELS: Record<MedicalStatus, string> = {
  completed: 'completed',
  due: 'due',
  scheduled: 'scheduled',
  overdue: 'overdue',
  canceled: 'canceled'
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
  procedure_name: string;
  status: MedicalStatus;
  performed_date: string;
  due_date: string;
  provider_contact_id: string;
  provider_name: string;
  clinic_id: string;
  facility_name: string;
  microchip_number: string;
  notes: string;
  next_due_date: string;
};
const EMPTY_FORM: FormState = {
  procedure_type: 'vaccine',
  procedure_name: '',
  status: 'completed',
  performed_date: '',
  due_date: '',
  provider_contact_id: '',
  provider_name: '',
  clinic_id: '',
  facility_name: '',
  microchip_number: '',
  notes: '',
  next_due_date: ''
};
function formStateFromRecord(r: MedicalRecord | undefined): FormState {
  if (!r) return EMPTY_FORM;
  return {
    procedure_type: r.procedure_type,
    procedure_name: r.procedure_name,
    status: r.status,
    performed_date: r.performed_date ?? '',
    due_date: r.due_date ?? '',
    provider_contact_id: r.provider_contact_id ?? '',
    provider_name: r.provider_name ?? '',
    clinic_id: r.clinic_id ?? '',
    facility_name: r.facility_name ?? '',
    microchip_number: r.microchip_number ?? '',
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
    people,
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
  }, [isOpen, record]);

  // The date the next-due offset is measured from (and the gate for showing it).
  const baseDate =
  formData.status === 'completed' ? formData.performed_date : formData.due_date;
  const showNextDue = RECURRING_TYPES.has(formData.procedure_type) && !!baseDate;

  // Duplicate detection — at most one non-canceled spay/neuter or microchip
  // record per animal. In edit mode we exclude the current record itself so
  // the user can keep editing the existing row without tripping the warning.
  const conflictingRecord = useMemo(() => {
    if (!UNIQUE_TYPES.has(formData.procedure_type)) return undefined;
    return medicalRecords.find(
      (m) =>
      m.animal_id === animalId &&
      m.procedure_type === formData.procedure_type &&
      m.status !== 'canceled' &&
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
    if (!formData.procedure_name.trim()) {
      next.procedure_name = 'Procedure name is required.';
    }
    if (formData.status === 'completed') {
      if (!formData.performed_date) {
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
    if (Object.keys(nextErrors).length > 0) return;
    const microchipNumber =
    formData.procedure_type === 'microchip' ?
    formData.microchip_number.trim() :
    '';
    const performedDate =
    formData.status === 'completed' ? formData.performed_date : undefined;
    const dueDate =
    formData.status !== 'completed' ? formData.due_date : undefined;
    const nextDueDate = showNextDue ?
    formData.next_due_date || undefined :
    undefined;
    if (isEditMode && record) {
      updateMedicalRecord(record.id, {
        procedure_type: formData.procedure_type,
        procedure_name: formData.procedure_name,
        status: formData.status,
        performed_date: performedDate,
        due_date: dueDate,
        provider_contact_id: formData.provider_contact_id || undefined,
        provider_name: formData.provider_name || undefined,
        clinic_id: formData.clinic_id || undefined,
        facility_name: formData.facility_name || undefined,
        microchip_number: microchipNumber || undefined,
        notes: formData.notes || undefined,
        next_due_date: nextDueDate
      });
    } else {
      addMedicalRecord({
        animal_id: animalId,
        ...formData,
        microchip_number: microchipNumber || undefined,
        performed_date: performedDate,
        due_date: dueDate,
        next_due_date: nextDueDate
      });
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

              <option value="vaccine">Vaccine</option>
              <option value="exam">Exam</option>
              <option value="spay_neuter">Spay/Neuter</option>
              <option value="medication">Medication</option>
              <option value="surgery">Surgery</option>
              <option value="microchip">Microchip</option>
              <option value="deworming">Deworming</option>
              <option value="test">Test</option>
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
              {isEditMode && <option value="canceled">Canceled</option>}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="procedure_name" required>Procedure Name</Label>
          <Input
            id="procedure_name"
            name="procedure_name"
            aria-invalid={Boolean(errors.procedure_name)}
            aria-describedby={errors.procedure_name ? 'procedure_name_error' : undefined}
            className={errors.procedure_name ? 'border-red-500 focus:ring-red-500' : undefined}
            value={formData.procedure_name}
            onChange={handleChange}
            placeholder="e.g. Rabies Vaccine" />
          <FieldError id="procedure_name_error">{errors.procedure_name}</FieldError>
        </div>

        {/* Microchip number — only relevant when the procedure type is
            Microchip. Optional: the chip may be implanted before the number
            is on hand. Saving copies the value onto animals.microchip_number. */}
        {formData.procedure_type === 'microchip' &&
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
            <Label htmlFor="performed_date" required>Date Performed</Label>
            <DatePicker
            id="performed_date"
            required
            error={Boolean(errors.performed_date)}
            value={formData.performed_date}
            onChange={(v) => handleBaseDateChange('performed_date', v)} />
            <FieldError id="performed_date_error">{errors.performed_date}</FieldError>
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
