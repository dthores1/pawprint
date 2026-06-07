import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Textarea, Label } from '../ui/Forms';
import { DateTimePicker } from '../ui/DateTimePicker';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
import { Button } from '../ui/Button';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { AddressValue } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ClinicForm = {
  dateTime: string;
  location: AddressValue | null;
  vetId: string;
  contactId: string;
  // `''` lets the user clear the field while typing; coerced to a number on submit.
  capacity: number | '';
  notes: string;
};

const INITIAL: ClinicForm = {
  dateTime: '',
  location: null,
  vetId: '',
  contactId: '',
  capacity: 8,
  notes: ''
};

type FormField = keyof ClinicForm;
type FormErrors = Partial<Record<FormField, string>>;

function validateForm(form: ClinicForm): FormErrors {
  const nextErrors: FormErrors = {};
  if (!form.dateTime) nextErrors.dateTime = 'Date & time is required.';
  if (!form.location?.formatted.trim())
  nextErrors.location = 'Location is required.';
  if (form.capacity === '' || form.capacity < 1) {
    nextErrors.capacity = 'Slot capacity must be at least 1.';
  }
  return nextErrors;
}

export function NewClinicEventModal({ isOpen, onClose }: Props) {
  const { addClinicEvent, peopleIndex: people } = useWhisker();
  const [form, setForm] = useState<ClinicForm>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});

  // Vet picker filters to people with role 'vet'. Contact picker accepts
  // anyone — some clinics have one person serving both roles, while at
  // others the contact is a rescue staffer or vet tech.

  const set = <K extends FormField,>(key: K, value: ClinicForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleClose = () => {
    setForm(INITIAL);
    setErrors({});
    onClose();
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    addClinicEvent({
      date_time: new Date(form.dateTime).toISOString(),
      location: form.location?.formatted.trim() ?? '',
      location_address: form.location,
      veterinarian_person_id: form.vetId || undefined,
      contact_person_id: form.contactId || undefined,
      slot_capacity: Number(form.capacity),
      status: 'planning',
      notes: form.notes.trim() || undefined
    });
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Clinic"
      className="max-w-2xl"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-clinic-form">
            Create Clinic
          </Button>
        </div>
      }>

      <form
        id="new-clinic-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="datetime" required>Date & time</Label>
            <DateTimePicker
              id="datetime"
              required
              error={Boolean(errors.dateTime)}
              value={form.dateTime}
              onChange={(v) => set('dateTime', v)} />
            <FieldError id="datetime_error">{errors.dateTime}</FieldError>
          </div>
          <div>
            <Label htmlFor="capacity" required>Slot capacity</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              aria-invalid={Boolean(errors.capacity)}
              aria-describedby={errors.capacity ? 'capacity_error' : undefined}
              className={errors.capacity && 'border-red-500 focus:ring-red-500'}
              value={form.capacity}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  set('capacity', '');
                  return;
                }
                const parsed = parseInt(raw, 10);
                set('capacity', Number.isNaN(parsed) ? '' : parsed);
              }} />
            <FieldError id="capacity_error">{errors.capacity}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="location" required>Location</Label>
          <AddressAutocomplete
            id="location"
            error={Boolean(errors.location)}
            value={form.location}
            onChange={(addr) => set('location', addr)}
            placeholder="Clinic name or address" />
          <FieldError id="location_error">{errors.location}</FieldError>
        </div>

        <div>
          <Label htmlFor="vet">Veterinarian</Label>
          <PersonSearchPicker
            id="vet"
            people={people}
            role="vet"
            value={form.vetId}
            onChange={(value) => set('vetId', value)}
            placeholder="Search veterinarians by name or organization…" />

        </div>
        <div>
          <Label htmlFor="contact">Clinic contact (optional)</Label>
          <PersonSearchPicker
            id="contact"
            people={people}
            value={form.contactId}
            onChange={(value) => set('contactId', value)}
            placeholder="Search staff, volunteers, or vets…" />

        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Drop-off windows, special instructions…"
            rows={3} />

        </div>
      </form>
    </Modal>);

}
