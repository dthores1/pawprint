import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Select, Textarea, Label } from '../ui/Forms';
import { FormSection } from '../ui/FormSection';
import { focusFirstError } from '../../lib/focusFirstError';
import { DateTimePicker } from '../ui/DateTimePicker';
import { DatePicker } from '../ui/DatePicker';
import { LocationPicker, LocationMode } from './LocationPicker';
import { Button } from '../ui/Button';
import { AnimalMultiPicker } from '../ui/AnimalMultiPicker';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { AlertTriangleIcon } from 'lucide-react';
import { animalDisplayName } from '../../lib/utils';
import { track } from '../../lib/analytics';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import { useIsAdmin } from '../../lib/useIsAdmin';
import {
  transportStaleInfo,
  TRANSPORT_STALE_LABEL,
  transportStaleTooltip } from
'../../lib/transportTiming';
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
  /**
   * Create-mode seed values (e.g. arranging transport from a sitting request).
   * Ignored in edit mode. `sitting_request_id` is carried into the created row
   * so the source request can link to it.
   */
  prefill?: Partial<TransportRequest> & { animal_ids?: string[] };
}

// `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, no zone suffix.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`);

}

export function NewTransportRequestModal({
  isOpen,
  onClose,
  request,
  prefill
}: Props) {
  const {
    addTransportRequest,
    updateTransportRequest,
    transportRequestAnimals,
    animalsIndex: animals,
    peopleIndex: people,
    placements
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const isAdmin = useIsAdmin();
  const isEditMode = !!request;
  // "All animals in my care" snapshots the current user's active placements at
  // submit time. (The "specific" picker is intentionally NOT limited to these —
  // you may coordinate a ride for an animal you don't foster.)
  const myPlacements = placements.filter(
    (p) => p.placement_status === 'active' && p.person_id === currentPersonId
  );
  const myAnimalIds = myPlacements.map((p) => p.animal_id);
  const myAnimals = myAnimalIds.
  map((id) => animals.find((a) => a.id === id)).
  filter((a): a is NonNullable<typeof a> => !!a);
  // Admins can direct a brand-new request at a specific volunteer instead of
  // posting it open. Assignment of existing requests is managed on the card.
  const canAssignOnCreate = isAdmin && !isEditMode;
  const [type, setType] = useState<TransportRequestType>('animal');
  const [urgency, setUrgency] = useState<TransportRequestUrgency>('normal');
  const [animalScope, setAnimalScope] = useState<'all_my_care' | 'specific'>(
    'specific'
  );
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
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
    assignee?: string;
  }>({});
  const [notes, setNotes] = useState('');
  const [assignMode, setAssignMode] = useState<'open' | 'assign'>('open');
  const [assignedVolunteerId, setAssignedVolunteerId] = useState('');
  // Carried from a create-mode prefill (e.g. the source sitting request) so the
  // created transport links back. Edit mode preserves the row's own value.
  const [sittingRequestId, setSittingRequestId] = useState<string | undefined>();

  // Re-seed when opened (or when the editing target changes). In create mode
  // this resets to blank; in edit mode it loads the current request values.
  useEffect(() => {
    if (!isOpen) return;
    if (request) {
      setType(request.type);
      setUrgency(request.urgency);
      setAnimalScope('specific');
      setSelectedAnimalIds(
        transportRequestAnimals.
        filter((ta) => ta.transport_request_id === request.id).
        map((ta) => ta.animal_id)
      );
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
      setSittingRequestId(request.sitting_request_id ?? undefined);
    } else {
      // Create mode: blank, except where a prefill seeds known values (e.g.
      // arranging transport from a sitting request). Route is never prefilled —
      // the user supplies pickup/dropoff.
      setType(prefill?.type ?? 'animal');
      setUrgency(prefill?.urgency ?? 'normal');
      setAnimalScope('specific');
      setSelectedAnimalIds(prefill?.animal_ids ?? []);
      setPickup(null);
      setDropoff(null);
      setPickupSavedLocationId(undefined);
      setDropoffSavedLocationId(undefined);
      setPickupMode('address');
      setDropoffMode('address');
      setScheduleType(prefill?.schedule_type ?? 'exact');
      setPickupTime('');
      setWindowStart(prefill?.preferred_window_start ?? '');
      setWindowEnd(prefill?.preferred_window_end ?? '');
      setNotes(prefill?.notes ?? '');
      setSittingRequestId(prefill?.sitting_request_id ?? undefined);
    }
    // Assignment is a create-mode concern only; always reset on open.
    setAssignMode('open');
    setAssignedVolunteerId('');
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
    // The animals being moved — "all my care" snapshots my active placements.
    const animalIds =
    type === 'animal' ?
    animalScope === 'all_my_care' ?
    myAnimalIds :
    selectedAnimalIds :
    [];
    const nextErrors: typeof errors = {};
    if (type === 'animal' && animalIds.length === 0) {
      nextErrors.animalId =
      animalScope === 'all_my_care' ?
      'No animals are currently in your care.' :
      'Select at least one animal.';
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
    if (canAssignOnCreate && assignMode === 'assign' && !assignedVolunteerId) {
      nextErrors.assignee = 'Select a volunteer, or choose Open Request.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const ids = [
      nextErrors.animalId && 'animal',
      nextErrors.pickup && 'pickup',
      nextErrors.dropoff && 'dropoff',
      nextErrors.pickupTime && 'pickup_time',
      nextErrors.window && 'window_start',
      nextErrors.assignee && 'assign_volunteer'].
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
      updateTransportRequest(
        request.id,
        {
          type,
          urgency,
          pickup_location: pickup?.formatted.trim() ?? '',
          dropoff_location: dropoff?.formatted.trim() ?? '',
          pickup_address: pickup ?? undefined,
          dropoff_address: dropoff ?? undefined,
          pickup_saved_location_id: pickupSavedLocationId ?? null,
          dropoff_saved_location_id: dropoffSavedLocationId ?? null,
          ...timingFields,
          notes: notes.trim() || undefined
        },
        animalIds
      );
    } else {
      // Admins may direct the request at a volunteer up front; otherwise it's
      // posted open for anyone to claim. The assignee notification fires off the
      // assigned_volunteer_person_id change (notify_transport_assignment, 0066).
      const directlyAssigned =
      canAssignOnCreate && assignMode === 'assign' && Boolean(assignedVolunteerId);
      addTransportRequest(
        {
          type,
          status: directlyAssigned ? 'assigned' : 'open',
          urgency,
          requested_by_person_id: currentPersonId ?? '',
          assigned_volunteer_person_id: directlyAssigned ?
          assignedVolunteerId :
          undefined,
          sitting_request_id: sittingRequestId,
          pickup_location: pickup?.formatted.trim() ?? '',
          dropoff_location: dropoff?.formatted.trim() ?? '',
          pickup_address: pickup,
          dropoff_address: dropoff,
          pickup_saved_location_id: pickupSavedLocationId ?? null,
          dropoff_saved_location_id: dropoffSavedLocationId ?? null,
          ...timingFields,
          notes: notes.trim() || undefined
        },
        animalIds
      );
      track('transport_request_created');
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

        {(() => {
          // Stale callout — surfaces the "why this needs attention" directly in
          // the request (not just a list badge). Edit mode only.
          const stale = request ? transportStaleInfo(request) : null;
          if (!stale) return null;
          return (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#E7D2A8] bg-[#FBF3E2] px-3.5 py-3">
              <AlertTriangleIcon className="w-4 h-4 text-[#A36B00] shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-[#8A5A00]">
                  {TRANSPORT_STALE_LABEL[stale.kind]} · {stale.days}
                  {stale.days === 1 ? ' day' : ' days'}
                </p>
                <p className="text-[#8A5A00]/90 mt-0.5">
                  {transportStaleTooltip(stale)}
                </p>
              </div>
            </div>);

        })()}

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
          <div id="animal">
              <Label required>Animals</Label>
              <div className="space-y-2">
                <label
                className={`block p-4 rounded-xl border cursor-pointer transition-colors ${animalScope === 'all_my_care' ? 'border-primary bg-primary/5' : 'border-border hover:bg-background/60'}`}>

                  <div className="flex items-start gap-3">
                    <input
                    type="radio"
                    name="animal_scope"
                    checked={animalScope === 'all_my_care'}
                    onChange={() => {
                      setAnimalScope('all_my_care');
                      if (errors.animalId) {
                        setErrors((prev) => ({ ...prev, animalId: undefined }));
                      }
                    }}
                    className="mt-1 w-4 h-4 text-primary focus:ring-primary" />

                    <div className="min-w-0">
                      <p className="font-medium text-text-primary">
                        All animals currently in my care
                      </p>
                      <p className="text-sm text-text-secondary mt-0.5">
                        {myAnimals.length === 0 ?
                        'No animals are currently in your care.' :
                        `Includes ${myAnimals.
                        map((a) => animalDisplayName(a)).
                        join(', ')}`}
                      </p>
                    </div>
                  </div>
                </label>
                <label
                className={`block p-4 rounded-xl border cursor-pointer transition-colors ${animalScope === 'specific' ? 'border-primary bg-primary/5' : 'border-border hover:bg-background/60'}`}>

                  <div className="flex items-start gap-3">
                    <input
                    type="radio"
                    name="animal_scope"
                    checked={animalScope === 'specific'}
                    onChange={() => setAnimalScope('specific')}
                    className="mt-1 w-4 h-4 text-primary focus:ring-primary" />

                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text-primary">
                        Select specific animals
                      </p>
                      {animalScope === 'specific' &&
                      <div className="mt-3">
                          <AnimalMultiPicker
                          animals={animals}
                          selectedIds={selectedAnimalIds}
                          onChange={(ids) => {
                            setSelectedAnimalIds(ids);
                            if (errors.animalId) {
                              setErrors((prev) => ({
                                ...prev,
                                animalId: undefined
                              }));
                            }
                          }}
                          placeholder="Search all animals…" />

                        </div>
                      }
                    </div>
                  </div>
                </label>
              </div>
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

        {canAssignOnCreate &&
        <FormSection title="Volunteer">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                type="radio"
                name="assign_mode"
                checked={assignMode === 'open'}
                onChange={() => {
                  setAssignMode('open');
                  setErrors((prev) => ({ ...prev, assignee: undefined }));
                }}
                className="w-4 h-4 text-primary focus:ring-primary" />

                Open Request <span className="text-text-secondary">(anyone may claim)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                type="radio"
                name="assign_mode"
                checked={assignMode === 'assign'}
                onChange={() => setAssignMode('assign')}
                className="w-4 h-4 text-primary focus:ring-primary" />

                Assign to volunteer
              </label>
            </div>
            {assignMode === 'assign' &&
          <div id="assign_volunteer" style={{ scrollMarginTop: '1rem' }}>
                <PersonSearchPicker
              people={people.filter(
                (p) => p.active !== false && p.id !== currentPersonId
              )}
              value={assignedVolunteerId}
              onChange={(id) => {
                setAssignedVolunteerId(id);
                setErrors((prev) => ({ ...prev, assignee: undefined }));
              }}
              placeholder="Search volunteers by name or email…" />

                <FieldError>{errors.assignee}</FieldError>
                <p className="text-xs text-text-secondary mt-1">
                  They’ll be notified and can accept or decline.
                </p>
              </div>
          }
          </FormSection>
        }

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
