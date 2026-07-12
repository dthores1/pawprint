import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Textarea, Label, Select } from '../ui/Forms';
import { focusFirstError } from '../../lib/focusFirstError';
import { DateTimePicker } from '../ui/DateTimePicker';
import { LocationPicker, LocationMode } from '../transports/LocationPicker';
import { Button } from '../ui/Button';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { AddContactModal } from '../contacts/AddContactModal';
import { useWhisker } from '../../context/WhiskerContext';
import { AddressValue, ClinicEvent, ClinicEventStatus } from '../../types';

const STATUS_LABEL: Record<ClinicEventStatus, string> = {
  planning: 'Planning',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled'
};
const STATUS_ORDER: ClinicEventStatus[] = [
'planning',
'scheduled',
'in_progress',
'completed',
'cancelled'];


interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: ClinicEvent;
  /** Field to focus when the modal opens (e.g. the card's slot count link). */
  initialFocus?: 'capacity';
}

type ClinicForm = {
  dateTime: string;
  status: ClinicEventStatus;
  location: AddressValue | null;
  locationSavedLocationId?: string;
  locationMode: LocationMode;
  vetId: string;
  contactId: string;
  transportId: string;
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
    location: e.location_address ?? null,
    locationSavedLocationId: e.location_saved_location_id ?? undefined,
    locationMode: e.location_saved_location_id ? 'saved' : 'address',
    vetId: e.veterinarian_person_id ?? '',
    contactId: e.contact_person_id ?? '',
    transportId: e.transport_coordinator_person_id ?? '',
    capacity: e.slot_capacity,
    notes: e.notes ?? ''
  };
}

function validateForm(form: ClinicForm): FormErrors {
  const next: FormErrors = {};
  if (!form.dateTime) next.dateTime = 'Date & time is required.';
  if (!form.location?.formatted.trim())
  next.location = 'Location is required.';
  if (form.capacity === '' || form.capacity < 1) {
    next.capacity = 'Animal slots must be at least 1.';
  }
  return next;
}

// Each person field can create a new contact inline (which form field it sets +
// the role to pre-check in the New Contact form).
const PERSON_FIELD_META = {
  vet: { field: 'vetId', role: 'vet' },
  contact: { field: 'contactId', role: 'rescue_staff' },
  transport: { field: 'transportId', role: 'transport' }
} as const;
type PersonTarget = keyof typeof PERSON_FIELD_META;

export function EditClinicEventModal({ isOpen, onClose, event, initialFocus }: Props) {
  const { updateClinicEvent, peopleIndex: people, savedLocations } = useWhisker();
  const [form, setForm] = useState<ClinicForm>(() => fromEvent(event));
  const [errors, setErrors] = useState<FormErrors>({});
  const [createTarget, setCreateTarget] = useState<PersonTarget | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(fromEvent(event));
      setErrors({});
      if (initialFocus === 'capacity') {
        // rAF so the modal's contents have painted before we grab focus.
        requestAnimationFrame(() => {
          const el = document.getElementById('capacity');
          if (el instanceof HTMLInputElement) {
            el.focus();
            el.select();
          }
        });
      }
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
    if (Object.keys(next).length > 0) {
      const ids = [
      next.dateTime && 'datetime',
      next.capacity && 'capacity',
      next.location && 'location'].
      filter((v): v is string => Boolean(v));
      requestAnimationFrame(() => focusFirstError(ids));
      return;
    }
    // Cast to `any` so we can explicitly pass `null` to clear an optional
    // person FK — `Partial<ClinicEvent>` only allows `string | undefined`,
    // and `undefined` would get dropped before reaching Postgres.
    const clear = (id: string) => id || null as any;
    const savedLoc = form.locationSavedLocationId ?
    savedLocations.find((l) => l.id === form.locationSavedLocationId) :
    undefined;
    updateClinicEvent(event.id, {
      date_time: new Date(form.dateTime).toISOString(),
      status: form.status,
      location: savedLoc ? savedLoc.name : form.location?.formatted.trim() ?? '',
      location_address: form.location,
      location_saved_location_id: form.locationSavedLocationId ?? null,
      veterinarian_person_id: clear(form.vetId),
      contact_person_id: clear(form.contactId),
      transport_coordinator_person_id: clear(form.transportId),
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
      className="max-w-2xl"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-clinic-form">
            Save Changes
          </Button>
        </div>
      }>

      <form
        id="edit-clinic-form"
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
            <Label htmlFor="capacity" required>Animal slots</Label>
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
            <Label htmlFor="status" required>Status</Label>
            <Select
              id="status"
              value={form.status}
              disabled={event.status === 'completed'}
              onChange={(e) => set('status', e.target.value as ClinicEventStatus)}>

              {/* "Completed" is intentionally not selectable here — completing a
                  clinic must go through the Complete Clinic flow so the medical
                  records get created. It's only shown when already completed. */}
              {(event.status === 'completed' ?
              STATUS_ORDER :
              STATUS_ORDER.filter((s) => s !== 'completed')).
              map((s) =>
              <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              )}
            </Select>
            {event.status !== 'completed' &&
            <p className="mt-1.5 text-xs text-text-secondary">
                To mark a clinic completed, use “Complete Clinic” — it records
                attendance and creates the medical records.
              </p>
            }
          </div>
          <div>
            <Label htmlFor="location" required>Location</Label>
            <LocationPicker
              id="location"
              error={Boolean(errors.location)}
              value={form.location}
              savedLocationId={form.locationSavedLocationId}
              mode={form.locationMode}
              onModeChange={(m) => set('locationMode', m)}
              onChange={(addr, savedId) => {
                setForm((prev) => ({
                  ...prev,
                  location: addr,
                  locationSavedLocationId: savedId
                }));
                if (errors.location) {
                  setErrors((prev) => ({ ...prev, location: undefined }));
                }
              }}
              placeholder="Clinic address…"
              freeTextHint="No exact address — it won’t show on the map." />

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
              onCreateNew={() => setCreateTarget('vet')}
              placeholder="Search veterinarians…" />

          </div>
          <div>
            <Label htmlFor="contact">Clinic contact</Label>
            <PersonSearchPicker
              id="contact"
              people={people}
              value={form.contactId}
              onChange={(value) => set('contactId', value)}
              onCreateNew={() => setCreateTarget('contact')}
              placeholder="Search staff, volunteers, or vets…" />

          </div>
          <div>
            {/* Read-only — the coordinator is whoever created the clinic. */}
            <Label>Clinic coordinator</Label>
            <div className="flex h-11 w-full items-center rounded-lg border border-border bg-background/60 px-3.5 text-sm text-text-primary">
              {(() => {
                const coord = event.coordinator_person_id ?
                people.find((p) => p.id === event.coordinator_person_id) :
                undefined;
                return coord ?
                `${coord.first_name} ${coord.last_name}` :
                'Not recorded';
              })()}
            </div>
          </div>
          <div>
            <Label htmlFor="transport">Transport coordinator</Label>
            <PersonSearchPicker
              id="transport"
              people={people}
              value={form.transportId}
              onChange={(value) => set('transportId', value)}
              onCreateNew={() => setCreateTarget('transport')}
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
      </form>

      {/* Inline "New Contact" flow — stacks above the form, which keeps its state
          so the new person lands back in the field that opened it. */}
      <AddContactModal
        isOpen={createTarget !== null}
        defaultRoles={createTarget ? [PERSON_FIELD_META[createTarget].role] : []}
        onCreated={(person) => {
          if (!createTarget) return;
          const field = PERSON_FIELD_META[createTarget].field;
          setForm((prev) => ({ ...prev, [field]: person.id }));
        }}
        onClose={() => setCreateTarget(null)} />

    </Modal>);

}
