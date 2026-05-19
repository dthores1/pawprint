import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}
export function NewClinicEventModal({ isOpen, onClose }: Props) {
  const { addClinicEvent, people } = useWhisker();
  const [dateTime, setDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [vetId, setVetId] = useState('');
  const [contactId, setContactId] = useState('');
  const [capacity, setCapacity] = useState(8);
  const [notes, setNotes] = useState('');

  // Vet picker filters to people with role 'vet'. Contact picker accepts
  // anyone — some clinics have one person serving both roles, while at
  // others the contact is a rescue staffer or vet tech.

  const reset = () => {
    setDateTime('');
    setLocation('');
    setVetId('');
    setContactId('');
    setCapacity(8);
    setNotes('');
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateTime || !location.trim()) return;
    addClinicEvent({
      date_time: new Date(dateTime).toISOString(),
      location: location.trim(),
      veterinarian_person_id: vetId || undefined,
      contact_person_id: contactId || undefined,
      slot_capacity: Number(capacity) || 1,
      status: 'planning',
      notes: notes.trim() || undefined
    });
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Clinic"
      className="max-w-2xl">

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="datetime">Date & time</Label>
            <Input
              id="datetime"
              type="datetime-local"
              required
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)} />

          </div>
          <div>
            <Label htmlFor="capacity">Slot capacity</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              required
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))} />

          </div>
        </div>

        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Clinic name and address" />

        </div>

        <div>
          <Label htmlFor="vet">Veterinarian</Label>
          <PersonSearchPicker
            id="vet"
            people={people}
            role="vet"
            value={vetId}
            onChange={setVetId}
            placeholder="Search veterinarians by name or organization…" />

        </div>
        <div>
          <Label htmlFor="contact">Clinic contact (optional)</Label>
          <PersonSearchPicker
            id="contact"
            people={people}
            value={contactId}
            onChange={setContactId}
            placeholder="Search staff, volunteers, or vets…" />

        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Drop-off windows, special instructions…"
            rows={3} />

        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Create Clinic</Button>
        </div>
      </form>
    </Modal>);

}
