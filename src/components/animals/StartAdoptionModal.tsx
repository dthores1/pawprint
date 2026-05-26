import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Label, FieldError } from '../ui/Forms';
import { Button } from '../ui/Button';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { legacyRoleFor } from '../../lib/peopleApi';
import { animalDisplayName } from '../../lib/utils';

interface StartAdoptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}

// Kicks off an adoption (status 'inquiry'). The adopter is either an existing
// contact or a new one created inline; either way they get the 'adopter' role.
export function StartAdoptionModal({
  isOpen,
  onClose,
  animalId
}: StartAdoptionModalProps) {
  const { animals, people, addPerson, addAdoption } = useWhisker();
  const animal = animals.find((a) => a.id === animalId);

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedId, setSelectedId] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) return;
    setMode('existing');
    setSelectedId('');
    setFirst('');
    setLast('');
    setEmail('');
    setPhone('');
    setError(undefined);
    setSubmitting(false);
  }, [isOpen]);

  if (!animal) return null;

  // Directory contacts only (exclude app-user self records).
  const directory = people.filter((p) => !p.user_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    let adopterId = selectedId;
    if (mode === 'existing') {
      if (!selectedId) {
        setError('Select a contact, or add a new one.');
        setSubmitting(false);
        return;
      }
    } else {
      if (!first.trim() || !last.trim() || !email.trim()) {
        setError('First name, last name, and email are required.');
        setSubmitting(false);
        return;
      }
      const created = await addPerson({
        first_name: first.trim(),
        last_name: last.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        roles: ['adopter'],
        role: legacyRoleFor(['adopter']),
        active: true
      });
      if (!created) {
        setError('Could not create the contact. Please try again.');
        setSubmitting(false);
        return;
      }
      adopterId = created.id;
    }
    await addAdoption({ animal_id: animal.id, adopter_id: adopterId });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Start Adoption for ${animalDisplayName(animal)}`}>

      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-text-secondary">
          Record an adopter and open an adoption inquiry. You'll move it through
          the workflow and mark it complete once paperwork is done.
        </p>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input
              type="radio"
              name="adopter_mode"
              checked={mode === 'existing'}
              onChange={() => {
                setMode('existing');
                setError(undefined);
              }}
              className="w-4 h-4 text-primary focus:ring-primary" />

            Existing contact
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input
              type="radio"
              name="adopter_mode"
              checked={mode === 'new'}
              onChange={() => {
                setMode('new');
                setError(undefined);
              }}
              className="w-4 h-4 text-primary focus:ring-primary" />

            New contact
          </label>
        </div>

        {mode === 'existing' ?
        <div>
            <Label>Adopter</Label>
            <PersonSearchPicker
            people={directory}
            value={selectedId}
            onChange={(id) => {
              setSelectedId(id);
              setError(undefined);
            }}
            placeholder="Search contacts by name or email…" />

          </div> :

        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="adopter_first">First Name</Label>
                <Input
                id="adopter_first"
                value={first}
                onChange={(e) => setFirst(e.target.value)} />

              </div>
              <div>
                <Label htmlFor="adopter_last">Last Name</Label>
                <Input
                id="adopter_last"
                value={last}
                onChange={(e) => setLast(e.target.value)} />

              </div>
            </div>
            <div>
              <Label htmlFor="adopter_email">Email</Label>
              <Input
              id="adopter_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)} />

            </div>
            <div>
              <Label htmlFor="adopter_phone">Phone (optional)</Label>
              <Input
              id="adopter_phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)} />

            </div>
          </div>
        }

        {error && <FieldError>{error}</FieldError>}

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Starting…' : 'Start Adoption'}
          </Button>
        </div>
      </form>
    </Modal>);

}
