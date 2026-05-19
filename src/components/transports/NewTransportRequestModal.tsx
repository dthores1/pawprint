import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { AnimalSearchPicker } from '../ui/AnimalSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import {
  TransportRequestType,
  TransportRequestUrgency } from
'../../types';

// See NewSupplyRequestModal — same demo current-user pattern.
const CURRENT_USER = { person_id: 'p_dan' };
interface Props {
  isOpen: boolean;
  onClose: () => void;
}
export function NewTransportRequestModal({ isOpen, onClose }: Props) {
  const { addTransportRequest, animals } = useWhisker();
  const [type, setType] = useState<TransportRequestType>('animal');
  const [urgency, setUrgency] = useState<TransportRequestUrgency>('normal');
  const [animalId, setAnimalId] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [notes, setNotes] = useState('');
  const reset = () => {
    setType('animal');
    setUrgency('normal');
    setAnimalId('');
    setPickup('');
    setDropoff('');
    setPickupTime('');
    setNotes('');
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup.trim() || !dropoff.trim() || !pickupTime) return;
    // Animal is required when the transport is for an animal.
    if (type === 'animal' && !animalId) return;
    addTransportRequest({
      type,
      status: 'open',
      urgency,
      requested_by_person_id: CURRENT_USER.person_id,
      animal_id: animalId || undefined,
      pickup_location: pickup.trim(),
      dropoff_location: dropoff.trim(),
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
      className="max-w-2xl">

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">Type</Label>
            <Select
              id="type"
              value={type}
              onChange={(e) =>
              setType(e.target.value as TransportRequestType)
              }>

              <option value="animal">Animal</option>
              <option value="supplies">Supplies</option>
              <option value="emergency">Emergency</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="urgency">Urgency</Label>
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
            <Label htmlFor="animal">Animal *</Label>
            <AnimalSearchPicker
            id="animal"
            animals={animals}
            value={animalId}
            onChange={setAnimalId} />

          </div>
        }

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pickup">Pickup location</Label>
            <Input
              id="pickup"
              required
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              placeholder="Trap site, foster home, office…" />

          </div>
          <div>
            <Label htmlFor="dropoff">Dropoff location</Label>
            <Input
              id="dropoff"
              required
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              placeholder="Vet clinic, foster home…" />

          </div>
        </div>

        <div>
          <Label htmlFor="pickup_time">Pickup time</Label>
          <Input
            id="pickup_time"
            type="datetime-local"
            required
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)} />

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

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Submit Request</Button>
        </div>
      </form>
    </Modal>);

}
