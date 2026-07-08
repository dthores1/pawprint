import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Label, FieldError } from '../ui/Forms';
import { Button } from '../ui/Button';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { AnimalSearchPicker } from '../ui/AnimalSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { legacyRoleFor } from '../../lib/peopleApi';
import { animalDisplayName } from '../../lib/utils';
import { isActiveAdoption } from '../../lib/adoptions';
import { focusFirstError } from '../../lib/focusFirstError';
import { track } from '../../lib/analytics';

interface StartAdoptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-select an animal (from its profile). Omit to let the user pick one
   *  from the eligible adoptable animals (the Adoptions tab entry point). */
  animalId?: string;
}

// Kicks off an adoption (status 'inquiry'). The adopter is either an existing
// contact or a new one created inline; either way they get the 'adopter' role.
// When `animalId` is omitted the user first picks an eligible adoptable animal.
export function StartAdoptionModal({
  isOpen,
  onClose,
  animalId: fixedAnimalId
}: StartAdoptionModalProps) {
  const {
    animals,
    peopleIndex: people,
    placements,
    adoptions,
    addPerson,
    addAdoption
  } = useWhisker();

  // When no animal is fixed by the caller, the user selects one here.
  const [pickedAnimalId, setPickedAnimalId] = useState('');
  const animalId = fixedAnimalId ?? pickedAnimalId;
  const animal = animals.find((a) => a.id === animalId);

  // The animal's current foster (if any) — used for the "foster failure"
  // shortcut that prefills the adopter with the foster they're already living with.
  const activePlacement = placements.find(
    (p) => p.animal_id === animalId && p.placement_status === 'active'
  );
  const currentFoster = activePlacement ?
  people.find((p) => p.id === activePlacement.person_id) ?? null :
  null;

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
    setPickedAnimalId('');
    setMode('existing');
    setSelectedId('');
    setFirst('');
    setLast('');
    setEmail('');
    setPhone('');
    setError(undefined);
    setSubmitting(false);
  }, [isOpen]);

  // Eligible animals (picker mode): adoptable, with no open or completed
  // adoption already on record. Mirrors the PRD eligibility rule.
  const eligibleAnimals = animals.filter(
    (a) =>
    a.status === 'adoptable' &&
    !adoptions.some(
      (ad) =>
      ad.animal_id === a.id &&
      (isActiveAdoption(ad) || ad.status === 'completed')
    )
  );

  // Directory contacts only (exclude app-user self records) — but keep the
  // current foster in the pool either way so the "foster wants to adopt"
  // shortcut works even when that foster is also an app user.
  const directory = people.filter(
    (p) => !p.user_id || p.id === currentFoster?.id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animalId) {
      setError('Select an animal to start an adoption for.');
      requestAnimationFrame(() => focusFirstError(['adoption_animal']));
      return;
    }
    setSubmitting(true);
    let adopterId = selectedId;
    if (mode === 'existing') {
      if (!selectedId) {
        setError('Select a contact, or add a new one.');
        setSubmitting(false);
        requestAnimationFrame(() => focusFirstError(['adopter_existing']));
        return;
      }
    } else {
      if (!first.trim() || !last.trim() || !email.trim()) {
        setError('First name, last name, and email are required.');
        setSubmitting(false);
        requestAnimationFrame(() => focusFirstError(['adopter_first']));
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
    await addAdoption({ animal_id: animalId, adopter_id: adopterId });
    track('adoption_started', { animal_id: animalId });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
      animal ? `Start Adoption for ${animalDisplayName(animal)}` : 'Start Adoption'
      }
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
          type="submit"
          form="start-adoption-form"
          disabled={submitting}>
            {submitting ? 'Starting…' : 'Start Adoption'}
          </Button>
        </div>
      }>

      <form id="start-adoption-form" onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-text-secondary">
          Record an adopter and open an adoption inquiry. You'll move it through
          the workflow and mark it complete once paperwork is done.
        </p>

        {!fixedAnimalId &&
        <div id="adoption_animal" style={{ scrollMarginTop: '1rem' }}>
            <Label required>Animal</Label>
            <AnimalSearchPicker
            animals={eligibleAnimals}
            value={pickedAnimalId}
            onChange={(id) => {
              setPickedAnimalId(id);
              setError(undefined);
            }}
            placeholder="Search adoptable animals by name…" />

            <p className="text-xs text-text-secondary mt-1.5">
              Only adoptable animals without an open adoption are shown.
            </p>
          </div>
        }

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
        <div id="adopter_existing" style={{ scrollMarginTop: '1rem' }}>
            <Label required>Adopter</Label>
            <PersonSearchPicker
            people={directory}
            value={selectedId}
            onChange={(id) => {
              setSelectedId(id);
              setError(undefined);
            }}
            placeholder="Search contacts by name or email…" />

            {currentFoster && selectedId !== currentFoster.id &&
          <button
            type="button"
            onClick={() => {
              setSelectedId(currentFoster.id);
              setError(undefined);
            }}
            className="mt-2 text-xs font-medium text-primary hover:underline">

                Foster wants to adopt?
              </button>
          }
          </div> :

        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="adopter_first" required>First Name</Label>
                <Input
                id="adopter_first"
                value={first}
                onChange={(e) => setFirst(e.target.value)} />

              </div>
              <div>
                <Label htmlFor="adopter_last" required>Last Name</Label>
                <Input
                id="adopter_last"
                value={last}
                onChange={(e) => setLast(e.target.value)} />

              </div>
            </div>
            <div>
              <Label htmlFor="adopter_email" required>Email</Label>
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
      </form>
    </Modal>);

}
