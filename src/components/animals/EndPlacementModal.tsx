import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Label, Input } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { Avatar } from '../ui/Avatar';
import { useWhisker } from '../../context/WhiskerContext';
import { Animal, Person } from '../../types';
import { animalDisplayName } from '../../lib/utils';
import { bondedPartnerIds } from '../../lib/bondedPairs';
import { track } from '../../lib/analytics';

// End an active foster placement WITHOUT reassigning — the animal returns to
// the org's direct care (foster unavailable, program wind-down…). The
// placement is closed, not deleted: it stays in the animal's history and on
// the foster's profile. Reassignment (foster → foster) lives in
// PlaceAnimalModal; this is the "no new foster" exit that flow doesn't cover.
export function EndPlacementModal({
  isOpen,
  onClose,
  animal,
  foster
}: {
  isOpen: boolean;
  onClose: () => void;
  animal: Animal;
  foster?: Person;
}) {
  const { endPlacement, placements, relationships, animalsIndex } =
  useWhisker();
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [onlyThisAnimal, setOnlyThisAnimal] = useState(false);

  // Bonded pairs are one placement unit — when the partner lives with the
  // same foster, ending this placement ends theirs too (opt-out below).
  const fosterId =
  foster?.id ??
  placements.find(
    (p) => p.animal_id === animal.id && p.placement_status === 'active'
  )?.person_id;
  const coPlacedPartners = bondedPartnerIds(animal.id, relationships).
  map((id) => animalsIndex.find((a) => a.id === id)).
  filter(
    (p): p is NonNullable<typeof p> =>
    !!p &&
    !!fosterId &&
    placements.some(
      (pl) =>
      pl.animal_id === p.id &&
      pl.placement_status === 'active' &&
      pl.person_id === fosterId
    )
  );

  const handleConfirm = async () => {
    setSubmitting(true);
    await endPlacement(animal.id, endDate, reason);
    track('placement_ended', { animal_id: animal.id });
    if (!onlyThisAnimal) {
      for (const partner of coPlacedPartners) {
        await endPlacement(partner.id, endDate, reason);
        track('placement_ended', { animal_id: partner.id, bonded: true });
      }
    }
    setSubmitting(false);
    setOnlyThisAnimal(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="End Placement"
      className="max-w-md"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Ending…' : 'End Placement'}
          </Button>
        </div>
      }>

      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
          <Avatar
            src={animal.primary_photo_url}
            type="animal"
            species={animal.species}
            size="sm" />

          <p className="text-sm text-text-primary">
            <span className="font-medium">{animalDisplayName(animal)}</span>
            {foster ?
            <>
                {' '}returns from{' '}
                <span className="font-medium">
                  {foster.first_name} {foster.last_name}
                </span>{' '}
                to your organization&rsquo;s direct care.
              </> :

            ' returns to your organization’s direct care.'}
          </p>
        </div>
        <p className="text-xs text-text-secondary">
          The placement is kept in the animal&rsquo;s history — nothing is
          deleted. To move the animal to a different foster instead, use
          Reassign Foster.
        </p>
        {coPlacedPartners.length > 0 &&
        <div className="p-3 rounded-xl bg-[#F3E4D7]/50 border border-[#EAD3BC] text-sm space-y-2">
            <p className="text-text-primary leading-relaxed">
              <span className="font-medium">
                {animalDisplayName(animal)} is bonded with{' '}
                {coPlacedPartners.map((p) => animalDisplayName(p)).join(' & ')}
              </span>{' '}
              — bonded pairs are one placement unit, so{' '}
              {coPlacedPartners.length === 1 ? 'their' : 'each of their'}{' '}
              placement{coPlacedPartners.length === 1 ? '' : 's'} with the same
              foster ends too.
            </p>
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <input
              type="checkbox"
              checked={onlyThisAnimal}
              onChange={(e) => setOnlyThisAnimal(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-primary focus:ring-primary" />
              End only {animalDisplayName(animal)}&rsquo;s placement (not
              recommended)
            </label>
          </div>
        }
        <div>
          <Label htmlFor="end_date" required>End Date</Label>
          <DatePicker
            id="end_date"
            value={endDate}
            onChange={(v) => setEndDate(v)} />

        </div>
        <div>
          <Label htmlFor="end_reason">Reason (optional)</Label>
          <Input
            id="end_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Foster unavailable — returned to the shelter" />

        </div>
      </div>
    </Modal>);

}
