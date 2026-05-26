import React, { useState } from 'react';
import { add, parseISO, format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { ClinicEventSearchPicker } from '../ui/ClinicEventSearchPicker';
import { Button } from '../ui/Button';
import { formatDate } from '../../lib/utils';
import { useWhisker } from '../../context/WhiskerContext';
import { ProcedureType, MedicalStatus, AgeUnit } from '../../types';
interface AddMedicalModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}
// Only these procedure types are commonly recurring, so the "next due" prompt
// is offered just for them (keeps the form low-friction for one-off records).
const RECURRING_TYPES = new Set<ProcedureType>([
'vaccine',
'exam',
'surgery',
'medication']
);
const AGE_UNITS: AgeUnit[] = ['days', 'weeks', 'months', 'years'];

// base + N units → yyyy-MM-dd (or '' when inputs are incomplete).
function computeNextDue(base: string, value: number, unit: AgeUnit): string {
  if (!base || !value || value <= 0) return '';
  return format(add(parseISO(base), { [unit]: value }), 'yyyy-MM-dd');
}

export function AddMedicalModal({
  isOpen,
  onClose,
  animalId
}: AddMedicalModalProps) {
  const { addMedicalRecord, people, clinicEvents } = useWhisker();
  const INITIAL = {
    procedure_type: 'vaccine' as ProcedureType,
    procedure_name: '',
    status: 'completed' as MedicalStatus,
    performed_date: '',
    due_date: '',
    provider_contact_id: '',
    provider_name: '',
    clinic_id: '',
    facility_name: '',
    notes: '',
    next_due_date: ''
  };
  const [formData, setFormData] = useState(INITIAL);
  // Each lookup falls back to free text: pick from contacts/clinics, or type.
  const [performedByMode, setPerformedByMode] = useState<'contact' | 'manual'>(
    'contact'
  );
  const [facilityMode, setFacilityMode] = useState<'clinic' | 'other'>('clinic');
  // Next-due input mode: relative interval (default) or an explicit date.
  const [nextDueMode, setNextDueMode] = useState<'relative' | 'date'>('relative');
  const [intervalValue, setIntervalValue] = useState('');
  const [intervalUnit, setIntervalUnit] = useState<AgeUnit>('months');

  // The date the next-due offset is measured from (and the gate for showing it).
  const baseDate =
  formData.status === 'completed' ? formData.performed_date : formData.due_date;
  const showNextDue = RECURRING_TYPES.has(formData.procedure_type) && !!baseDate;

  const reset = () => {
    setFormData(INITIAL);
    setPerformedByMode('contact');
    setFacilityMode('clinic');
    setNextDueMode('relative');
    setIntervalValue('');
    setIntervalUnit('months');
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMedicalRecord({
      animal_id: animalId,
      ...formData,
      performed_date:
      formData.status === 'completed' ? formData.performed_date : undefined,
      due_date: formData.status !== 'completed' ? formData.due_date : undefined,
      next_due_date: showNextDue ? formData.next_due_date || undefined : undefined
    });
    onClose();
    reset();
  };
  const handleChange = (
  e: React.ChangeEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
  {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  // Setting the performed/due date also re-derives next_due_date when a relative
  // interval is already entered (so the offset tracks the base date).
  const handleBaseDateChange = (field: 'performed_date' | 'due_date', v: string) =>
  setFormData((prev) => ({
    ...prev,
    [field]: v,
    next_due_date:
    nextDueMode === 'relative' && intervalValue ?
    computeNextDue(v, Number(intervalValue), intervalUnit) :
    prev.next_due_date
  }));
  const setInterval = (valueStr: string, unit: AgeUnit) => {
    setIntervalValue(valueStr);
    setIntervalUnit(unit);
    setFormData((prev) => ({
      ...prev,
      next_due_date: computeNextDue(baseDate, Number(valueStr), unit)
    }));
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Medical Record">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="procedure_type">Type</Label>
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
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}>

              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
              <option value="due">Due</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="procedure_name">Procedure Name</Label>
          <Input
            id="procedure_name"
            name="procedure_name"
            required
            value={formData.procedure_name}
            onChange={handleChange}
            placeholder="e.g. Rabies Vaccine" />

        </div>

        {formData.status === 'completed' ?
        <div>
            <Label htmlFor="performed_date">Date Performed</Label>
            <DatePicker
            id="performed_date"
            value={formData.performed_date}
            onChange={(v) => handleBaseDateChange('performed_date', v)} />

          </div> :

        <div>
            <Label htmlFor="due_date">Due Date</Label>
            <DatePicker
            id="due_date"
            value={formData.due_date}
            onChange={(v) => handleBaseDateChange('due_date', v)} />

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

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Record</Button>
        </div>
      </form>
    </Modal>);

}
