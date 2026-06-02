import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Select, Textarea, Label } from '../ui/Forms';
import { DateTimePicker } from '../ui/DateTimePicker';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
import { Button } from '../ui/Button';
import { AnimalSearchPicker } from '../ui/AnimalSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import {
  AddressValue,
  TransportRequestType,
  TransportRequestUrgency } from
'../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}
export function NewTransportRequestModal({ isOpen, onClose }: Props) {
  const { addTransportRequest, animals } = useWhisker();
  const { currentPersonId } = useAuth();
  const [type, setType] = useState<TransportRequestType>('animal');
  const [urgency, setUrgency] = useState<TransportRequestUrgency>('normal');
  const [animalId, setAnimalId] = useState('');
  const [pickup, setPickup] = useState<AddressValue | null>(null);
  const [dropoff, setDropoff] = useState<AddressValue | null>(null);
  const [pickupTime, setPickupTime] = useState('');
  const [errors, setErrors] = useState<{
    animalId?: string;
    pickup?: string;
    dropoff?: string;
    pickupTime?: string;
  }>({});
  const [notes, setNotes] = useState('');
  const reset = () => {
    setType('animal');
    setUrgency('normal');
    setAnimalId('');
    setPickup(null);
    setDropoff(null);
    setPickupTime('');
    setErrors({});
    setNotes('');
  };
  const handleClose = () => {
    reset();
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
    if (!pickupTime) nextErrors.pickupTime = 'Pickup time is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    // Guard against past times. The calendar already blocks past days,
    // but a same-day time can still slip into the past while the form is open.
    const pickupDate = new Date(pickupTime);
    if (pickupDate.getTime() < Date.now()) {
      setErrors({ pickupTime: 'Pickup time must be in the future.' });
      return;
    }
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
      requested_pickup_time: new Date(pickupTime).toISOString(),
      notes: notes.trim() || undefined
    });
    handleClose();
  };
  const showAnimalPicker = type === 'animal';
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Transport Request"
      className="max-w-2xl"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-transport-form">
            Submit Request
          </Button>
        </div>
      }>

      <form
        id="new-transport-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pickup" required>Pickup location</Label>
            <AddressAutocomplete
              id="pickup"
              error={Boolean(errors.pickup)}
              value={pickup}
              onChange={(addr) => {
                setPickup(addr);
                if (errors.pickup) {
                  setErrors((prev) => ({ ...prev, pickup: undefined }));
                }
              }}
              placeholder="Trap site, foster home, office…" />
            <FieldError id="pickup_error">{errors.pickup}</FieldError>

          </div>
          <div>
            <Label htmlFor="dropoff" required>Dropoff location</Label>
            <AddressAutocomplete
              id="dropoff"
              error={Boolean(errors.dropoff)}
              value={dropoff}
              onChange={(addr) => {
                setDropoff(addr);
                if (errors.dropoff) {
                  setErrors((prev) => ({ ...prev, dropoff: undefined }));
                }
              }}
              placeholder="Vet clinic, foster home…" />
            <FieldError id="dropoff_error">{errors.dropoff}</FieldError>

          </div>
        </div>

        <div>
          <Label htmlFor="pickup_time" required>Pickup time</Label>
          <DateTimePicker
            id="pickup_time"
            required
            value={pickupTime}
            onChange={handlePickupTimeChange}
            minDate={new Date()}
            error={Boolean(errors.pickupTime)} />
          <FieldError>{errors.pickupTime}</FieldError>
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Carrier needed? Special instructions?"
            rows={3} />

        </div>
      </form>
    </Modal>);

}
