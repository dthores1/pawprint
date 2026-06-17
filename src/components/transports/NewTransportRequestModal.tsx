import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Select, Textarea, Label } from '../ui/Forms';
import { FormSection } from '../ui/FormSection';
import { focusFirstError } from '../../lib/focusFirstError';
import { DateTimePicker } from '../ui/DateTimePicker';
import { DatePicker } from '../ui/DatePicker';
import { LocationPicker, LocationMode } from './LocationPicker';
import { Button } from '../ui/Button';
import { AnimalSearchPicker } from '../ui/AnimalSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import {
  AddressValue,
  TransportRequest,
  TransportRequestType,
  TransportScheduleType,
  TransportRequestUrgency } from
'../../types';

const SCHEDULE_OPTIONS: { value: TransportScheduleType; label: string }[] = [
{ value: 'exact', label: 'Exact time' },
{ value: 'flexible', label: 'Flexible' },
{ value: 'asap', label: 'ASAP' },
{ value: 'coordinate_later', label: 'Date TBD' }];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * When supplied, switches the modal to edit mode: form is pre-populated
   * with the request's current values and Save calls updateTransportRequest
   * instead of addTransportRequest.
   */
  request?: TransportRequest;
}

// `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, no zone suffix.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`);

}

export function NewTransportRequestModal({ isOpen, onClose, request }: Props) {
  const {
    addTransportRequest,
    updateTransportRequest,
    animalsIndex: animals
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const isEditMode = !!request;
  const [type, setType] = useState<TransportRequestType>('animal');
  const [urgency, setUrgency] = useState<TransportRequestUrgency>('normal');
  const [animalId, setAnimalId] = useState('');
  const [pickup, setPickup] = useState<AddressValue | null>(null);
  const [dropoff, setDropoff] = useState<AddressValue | null>(null);
  const [pickupSavedLocationId, setPickupSavedLocationId] = useState<string | undefined>();
  const [dropoffSavedLocationId, setDropoffSavedLocationId] = useState<string | undefined>();
  const [pickupMode, setPickupMode] = useState<LocationMode>('address');
  const [dropoffMode, setDropoffMode] = useState<LocationMode>('address');
  const [scheduleType, setScheduleType] = useState<TransportScheduleType>('exact');
  const [pickupTime, setPickupTime] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [errors, setErrors] = useState<{
    animalId?: string;
    pickup?: string;
    dropoff?: string;
    pickupTime?: string;
    window?: string;
  }>({});
  const [notes, setNotes] = useState('');

  // Re-seed when opened (or when the editing target changes). In create mode
  // this resets to blank; in edit mode it loads the current request values.
  useEffect(() => {
    if (!isOpen) return;
    if (request) {
      setType(request.type);
      setUrgency(request.urgency);
      setAnimalId(request.animal_id ?? '');
      setPickup(
        request.pickup_address ??
        (request.pickup_location ?
        { formatted: request.pickup_location } as AddressValue :
        null)
      );
      setDropoff(
        request.dropoff_address ??
        (request.dropoff_location ?
        { formatted: request.dropoff_location } as AddressValue :
        null)
      );
      setPickupSavedLocationId(request.pickup_saved_location_id ?? undefined);
      setDropoffSavedLocationId(request.dropoff_saved_location_id ?? undefined);
      setPickupMode(request.pickup_saved_location_id ? 'saved' : 'address');
      setDropoffMode(request.dropoff_saved_location_id ? 'saved' : 'address');
      setScheduleType(request.schedule_type ?? 'exact');
      setPickupTime(
        request.requested_pickup_time ?
        toLocalInput(request.requested_pickup_time) :
        ''
      );
      setWindowStart(request.preferred_window_start ?? '');
      setWindowEnd(request.preferred_window_end ?? '');
      setNotes(request.notes ?? '');
    } else {
      setType('animal');
      setUrgency('normal');
      setAnimalId('');
      setPickup(null);
      setDropoff(null);
      setPickupSavedLocationId(undefined);
      setDropoffSavedLocationId(undefined);
      setPickupMode('address');
      setDropoffMode('address');
      setScheduleType('exact');
      setPickupTime('');
      setWindowStart('');
      setWindowEnd('');
      setNotes('');
    }
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, request?.id]);

  const handleClose = () => {
    onClose();
  };
  const handlePickupTimeChange = (v: string) => {
    setPickupTime(v);
    if (errors.pickupTime) {
      setErrors((prev) => ({ ...prev, pickupTime: undefined }));
    }
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (type === 'animal' && !animalId) {
      nextErrors.animalId = 'Animal is required.';
    }
    if (!pickup?.formatted.trim())
    nextErrors.pickup = 'Pickup location is required.';
    if (!dropoff?.formatted.trim())
    nextErrors.dropoff = 'Dropoff location is required.';
    // An exact time is only required for the 'exact' schedule type.
    if (scheduleType === 'exact' && !pickupTime) {
      nextErrors.pickupTime = 'Pickup time is required.';
    }
    if (
      scheduleType === 'flexible' &&
      windowStart && windowEnd && windowStart > windowEnd)
    {
      nextErrors.window = 'The end date can’t be before the start date.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const ids = [
      nextErrors.animalId && 'animal',
      nextErrors.pickup && 'pickup',
      nextErrors.dropoff && 'dropoff',
      nextErrors.pickupTime && 'pickup_time',
      nextErrors.window && 'window_start'].
      filter((v): v is string => Boolean(v));
      requestAnimationFrame(() => focusFirstError(ids));
      return;
    }
    // Exact time → ISO; guard against past times, but only on a real change
    // (reopening edit mode minutes later shouldn't trip "past time").
    let pickupIso: string | undefined;
    if (scheduleType === 'exact') {
      const pickupDate = new Date(pickupTime);
      const originalIso = request?.requested_pickup_time ?
      new Date(request.requested_pickup_time).toISOString() :
      null;
      const changedTime = pickupDate.toISOString() !== originalIso;
      if (changedTime && pickupDate.getTime() < Date.now()) {
        setErrors({ pickupTime: 'Pickup time must be in the future.' });
        requestAnimationFrame(() => focusFirstError(['pickup_time']));
        return;
      }
      pickupIso = pickupDate.toISOString();
    }
    // Only the fields relevant to the schedule type are sent; the rest are
    // nulled ('' → null in the API layer) so switching types stays consistent.
    const timingFields = {
      schedule_type: scheduleType,
      requested_pickup_time: scheduleType === 'exact' ? pickupIso : '',
      preferred_window_start: scheduleType === 'flexible' ? windowStart : '',
      preferred_window_end: scheduleType === 'flexible' ? windowEnd : ''
    };
    if (request) {
      updateTransportRequest(request.id, {
        type,
        urgency,
        animal_id: animalId || undefined,
        pickup_location: pickup?.formatted.trim() ?? '',
        dropoff_location: dropoff?.formatted.trim() ?? '',
        pickup_address: pickup ?? undefined,
        dropoff_address: dropoff ?? undefined,
        pickup_saved_location_id: pickupSavedLocationId ?? null,
        dropoff_saved_location_id: dropoffSavedLocationId ?? null,
        ...timingFields,
        notes: notes.trim() || undefined
      });
    } else {
      addTransportRequest({
        type,
        status: 'open',
        urgency,
        requested_by_person_id: currentPersonId ?? '',
        animal_id: animalId || undefined,
        pickup_location: pickup?.formatted.trim() ?? '',
        dropoff_location: dropoff?.formatted.trim() ?? '',
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_saved_location_id: pickupSavedLocationId ?? null,
        dropoff_saved_location_id: dropoffSavedLocationId ?? null,
        ...timingFields,
        notes: notes.trim() || undefined
      });
    }
    handleClose();
  };
  const showAnimalPicker = type === 'animal';
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? 'Edit Transport Request' : 'New Transport Request'}
      className="max-w-2xl"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="transport-request-form">
            {isEditMode ? 'Save Changes' : 'Submit Request'}
          </Button>
        </div>
      }>

      <form
        id="transport-request-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate>

        <FormSection title="Request details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type" required>Type</Label>
              <Select
                id="type"
                value={type}
                onChange={(e) =>
                setType(e.target.value as TransportRequestType)
                }>

                <option value="animal">Animal</option>
                <option value="supplies">Supplies</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="urgency" required>Urgency</Label>
              <Select
                id="urgency"
                value={urgency}
                onChange={(e) =>
                setUrgency(e.target.value as TransportRequestUrgency)
                }>

                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>

          {showAnimalPicker &&
          <div>
              <Label htmlFor="animal" required>Animal</Label>
              <AnimalSearchPicker
              id="animal"
              animals={animals}
              value={animalId}
              onChange={(value) => {
                setAnimalId(value);
                if (errors.animalId) {
                  setErrors((prev) => ({ ...prev, animalId: undefined }));
                }
              }} />
              <FieldError>{errors.animalId}</FieldError>

            </div>
          }
        </FormSection>

        <FormSection title="Route">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pickup" required>Pickup location</Label>
              <LocationPicker
                id="pickup"
                error={Boolean(errors.pickup)}
                value={pickup}
                savedLocationId={pickupSavedLocationId}
                mode={pickupMode}
                onModeChange={setPickupMode}
                onChange={(addr, savedId) => {
                  setPickup(addr);
                  setPickupSavedLocationId(savedId);
                  if (errors.pickup) {
                    setErrors((prev) => ({ ...prev, pickup: undefined }));
                  }
                }}
                placeholder="Trap site, foster home, office…" />
              <FieldError id="pickup_error">{errors.pickup}</FieldError>

            </div>
            <div>
              <Label htmlFor="dropoff" required>Dropoff location</Label>
              <LocationPicker
                id="dropoff"
                error={Boolean(errors.dropoff)}
                value={dropoff}
                savedLocationId={dropoffSavedLocationId}
                mode={dropoffMode}
                onModeChange={setDropoffMode}
                onChange={(addr, savedId) => {
                  setDropoff(addr);
                  setDropoffSavedLocationId(savedId);
                  if (errors.dropoff) {
                    setErrors((prev) => ({ ...prev, dropoff: undefined }));
                  }
                }}
                placeholder="Vet clinic, foster home…" />
              <FieldError id="dropoff_error">{errors.dropoff}</FieldError>

            </div>
          </div>
        </FormSection>

        <FormSection title="Timing">
          <Label required>When is this needed?</Label>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SCHEDULE_OPTIONS.map((opt) =>
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">

              <input
                type="radio"
                name="schedule_type"
                checked={scheduleType === opt.value}
                onChange={() => {
                  setScheduleType(opt.value);
                  setErrors((prev) => ({
                    ...prev,
                    pickupTime: undefined,
                    window: undefined
                  }));
                }}
                className="w-4 h-4 text-primary focus:ring-primary" />

              {opt.label}
            </label>
            )}
          </div>

          {scheduleType === 'exact' &&
          <div>
            <Label htmlFor="pickup_time" required>Pickup time</Label>
            <DateTimePicker
              id="pickup_time"
              required
              value={pickupTime}
              onChange={handlePickupTimeChange}
              minDate={isEditMode ? undefined : new Date()}
              error={Boolean(errors.pickupTime)} />

            <FieldError>{errors.pickupTime}</FieldError>
          </div>
          }

          {scheduleType === 'flexible' &&
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="window_start">Preferred from (optional)</Label>
              <DatePicker
                id="window_start"
                value={windowStart}
                error={Boolean(errors.window)}
                onChange={(v) => {
                  setWindowStart(v);
                  if (errors.window) {
                    setErrors((prev) => ({ ...prev, window: undefined }));
                  }
                }} />

            </div>
            <div>
              <Label htmlFor="window_end">Preferred to (optional)</Label>
              <DatePicker
                id="window_end"
                value={windowEnd}
                align="end"
                error={Boolean(errors.window)}
                onChange={(v) => {
                  setWindowEnd(v);
                  if (errors.window) {
                    setErrors((prev) => ({ ...prev, window: undefined }));
                  }
                }} />

              <FieldError>{errors.window}</FieldError>
            </div>
            <p className="sm:col-span-2 text-xs text-text-secondary">
              A soft target — flexible requests won’t auto-expire.
            </p>
          </div>
          }

          {scheduleType === 'asap' &&
          <p className="text-xs text-text-secondary">
            No fixed time. This stays open (and sorted as urgent) until it’s
            claimed, completed, or closed.
          </p>
          }

          {scheduleType === 'coordinate_later' &&
          <p className="text-xs text-text-secondary">
            No date yet — you’ll work out timing with whoever claims it. It stays
            open until claimed, completed, or closed.
          </p>
          }
        </FormSection>

        <FormSection title="Notes">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Carrier needed? Special instructions?"
            rows={3} />

        </FormSection>
      </form>
    </Modal>);

}
