import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Textarea, Label, Select } from '../ui/Forms';
import { DateTimePicker } from '../ui/DateTimePicker';
import { Button } from '../ui/Button';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { ClinicEvent, ClinicEventStatus } from '../../types';

const STATUS_LABEL: Record<ClinicEventStatus, string> = {
  planning: 'Planning',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  canceled: 'Canceled'
};
const STATUS_ORDER: ClinicEventStatus[] = [
'planning',
'scheduled',
'in_progress',
'completed',
'canceled'];


interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: ClinicEvent;
}

type ClinicForm = {
  dateTime: string;
  status: ClinicEventStatus;
  location: string;
  vetId: string;
  contactId: string;
  transportId: string;
  intakeId: string;
  capacity: number | '';
  notes: string;
};

type FormField = keyof ClinicForm;
type FormErrors = Partial<Record<FormField, string>>;

// `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, no zone suffix.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`);

}

function fromEvent(e: ClinicEvent): ClinicForm {
  return {
    dateTime: toLocalInput(e.date_time),
    status: e.status,
    location: e.location,
    vetId: e.veterinarian_person_id ?? '',
    contactId: e.contact_person_id ?? '',
    transportId: e.transport_coordinator_person_id ?? '',
    intakeId: e.intake_coordinator_person_id ?? '',
    capacity: e.slot_capacity,
    notes: e.notes ?? ''
  };
}

function validateForm(form: ClinicForm): FormErrors {
  const next: FormErrors = {};
  if (!form.dateTime) next.dateTime = 'Date & time is required.';
  if (!form.location.trim()) next.location = 'Location is required.';
  if (form.capacity === '' || form.capacity < 1) {
    next.capacity = 'Slot capacity must be at least 1.';
  }
  return next;
}

export function EditClinicEventModal({ isOpen, onClose, event }: Props) {
  const { updateClinicEvent, people } = useWhisker();
  const [form, setForm] = useState<ClinicForm>(() => fromEvent(event));
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (isOpen) {
      setForm(fromEvent(event));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event.id]);

  const set = <K extends FormField,>(key: K, value: ClinicForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = validateForm(form);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Cast to `any` so we can explicitly pass `null` to clear an optional
    // person FK — `Partial<ClinicEvent>` only allows `string | undefined`,
    // and `undefined` would get dropped before reaching Postgres.
    const clear = (id: string) => id || null as any;
    updateClinicEvent(event.id, {
      date_time: new Date(form.dateTime).toISOString(),
      status: form.status,
      location: form.location.trim(),
      veterinarian_person_id: clear(form.vetId),
      contact_person_id: clear(form.contactId),
      transport_coordinator_person_id: clear(form.transportId),
      intake_coordinator_person_id: clear(form.intakeId),
      slot_capacity: Number(form.capacity),
      notes: form.notes.trim() || (null as any)
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Clinic"
      className="max-w-2xl">

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="datetime">Date & time</Label>
            <DateTimePicker
              id="datetime"
              error={Boolean(errors.dateTime)}
              value={form.dateTime}
              onChange={(v) => set('dateTime', v)} />

            <FieldError id="datetime_error">{errors.dateTime}</FieldError>
          </div>
          <div>
            <Label htmlFor="capacity">Slot capacity</Label>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => set('status', e.target.value as ClinicEventStatus)}>

              {STATUS_ORDER.map((s) =>
              <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              )}
            </Select>
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              aria-invalid={Boolean(errors.location)}
              aria-describedby={errors.location ? 'location_error' : undefined}
              className={errors.location && 'border-red-500 focus:ring-red-500'}
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Clinic name and address" />

            <FieldError id="location_error">{errors.location}</FieldError>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="vet">Veterinarian</Label>
            <PersonSearchPicker
              id="vet"
              people={people}
              role="vet"
              value={form.vetId}
              onChange={(value) => set('vetId', value)}
              placeholder="Search veterinarians…" />

          </div>
          <div>
            <Label htmlFor="contact">Clinic contact</Label>
            <PersonSearchPicker
              id="contact"
              people={people}
              value={form.contactId}
              onChange={(value) => set('contactId', value)}
              placeholder="Search staff, volunteers, or vets…" />

          </div>
          <div>
            <Label htmlFor="transport">Transport coordinator</Label>
            <PersonSearchPicker
              id="transport"
              people={people}
              value={form.transportId}
              onChange={(value) => set('transportId', value)}
              placeholder="Search people…" />

          </div>
          <div>
            <Label htmlFor="intake">Intake coordinator</Label>
            <PersonSearchPicker
              id="intake"
              people={people}
              value={form.intakeId}
              onChange={(value) => set('intakeId', value)}
              placeholder="Search people…" />

          </div>
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

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>);

}
