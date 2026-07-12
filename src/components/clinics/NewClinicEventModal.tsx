import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Textarea, Label } from '../ui/Forms';
import { focusFirstError } from '../../lib/focusFirstError';
import { DateTimePicker } from '../ui/DateTimePicker';
import { LocationPicker, LocationMode } from '../transports/LocationPicker';
import { Button } from '../ui/Button';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { AddContactModal } from '../contacts/AddContactModal';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import { AddressValue } from '../../types';
import { track } from '../../lib/analytics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ClinicForm = {
  dateTime: string;
  location: AddressValue | null;
  locationSavedLocationId?: string;
  locationMode: LocationMode;
  vetId: string;
  contactId: string;
  transportId: string;
  // `''` lets the user clear the field while typing; coerced to a number on submit.
  capacity: number | '';
  notes: string;
};

const INITIAL: ClinicForm = {
  dateTime: '',
  location: null,
  locationSavedLocationId: undefined,
  locationMode: 'address',
  vetId: '',
  contactId: '',
  transportId: '',
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
    nextErrors.capacity = 'Animal slots must be at least 1.';
  }
  return nextErrors;
}

export function NewClinicEventModal({ isOpen, onClose }: Props) {
  const { addClinicEvent, peopleIndex: people, savedLocations } = useWhisker();
  const { currentPersonId } = useAuth();
  // The creator becomes the Clinic Coordinator — the accountable owner who
  // receives the upcoming-clinic reminder and the overdue completion nudge.
  const me = currentPersonId ?
  people.find((p) => p.id === currentPersonId) :
  undefined;
  const [form, setForm] = useState<ClinicForm>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  // Which person field (if any) is creating a new contact inline.
  const [createTarget, setCreateTarget] = useState<
    'vet' | 'contact' | 'transport' | null>(
    null);

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
    if (Object.keys(nextErrors).length > 0) {
      const ids = [
      nextErrors.dateTime && 'datetime',
      nextErrors.capacity && 'capacity',
      nextErrors.location && 'location'].
      filter((v): v is string => Boolean(v));
      requestAnimationFrame(() => focusFirstError(ids));
      return;
    }
    // Saved location → store its friendly name as the display text; the copied
    // address still rides along in location_address for maps.
    const savedLoc = form.locationSavedLocationId ?
    savedLocations.find((l) => l.id === form.locationSavedLocationId) :
    undefined;
    addClinicEvent({
      date_time: new Date(form.dateTime).toISOString(),
      location: savedLoc ? savedLoc.name : form.location?.formatted.trim() ?? '',
      location_address: form.location,
      location_saved_location_id: form.locationSavedLocationId ?? null,
      veterinarian_person_id: form.vetId || undefined,
      contact_person_id: form.contactId || undefined,
      transport_coordinator_person_id: form.transportId || undefined,
      coordinator_person_id: currentPersonId ?? undefined,
      slot_capacity: Number(form.capacity),
      status: 'planning',
      notes: form.notes.trim() || undefined
    });
    track('clinic_event_created');
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
            <Label htmlFor="contact">Clinic contact (optional)</Label>
            <PersonSearchPicker
              id="contact"
              people={people}
              value={form.contactId}
              onChange={(value) => set('contactId', value)}
              onCreateNew={() => setCreateTarget('contact')}
              placeholder="Search staff, volunteers, or vets…" />

          </div>
          <div>
            {/* Read-only — the creator becomes the clinic coordinator. */}
            <Label>Clinic coordinator</Label>
            <div className="flex h-11 w-full items-center rounded-lg border border-border bg-background/60 px-3.5 text-sm text-text-primary">
              {me ? `${me.first_name} ${me.last_name}` : 'You'}
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

      {/* Inline "New Contact" flow — stacks above the clinic form, which keeps
          its state so the new person lands back in the field that opened it. */}
      <AddContactModal
        isOpen={createTarget !== null}
        defaultRoles={[
        createTarget === 'vet' ?
        'vet' :
        createTarget === 'transport' ?
        'transport' :
        'rescue_staff']
        }
        onCreated={(person) =>
        setForm((prev) => ({
          ...prev,
          [createTarget === 'vet' ?
          'vetId' :
          createTarget === 'transport' ?
          'transportId' :
          'contactId']: person.id
        }))
        }
        onClose={() => setCreateTarget(null)} />

    </Modal>);

}
