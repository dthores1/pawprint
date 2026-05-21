import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { AnimalMultiPicker } from '../ui/AnimalMultiPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import { SittingCoverageScope } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}
export function NewSittingRequestModal({ isOpen, onClose }: Props) {
  const { addSittingRequest, placements, animals } = useWhisker();
  const { currentPersonId } = useAuth();

  // TODO(auth): scope to the signed-in user's OWN placements once Person↔
  // FosterParent linking exists. For now we cover all active placements in
  // the org, so "in my care" reads as "currently in foster".
  const myPlacements = useMemo(
    () => placements.filter((p) => p.placement_status === 'active'),
    [placements]
  );
  const myAnimals = myPlacements.
  map((p) => animals.find((a) => a.id === p.animal_id)).
  filter((a): a is NonNullable<typeof a> => !!a);

  const [scope, setScope] = useState<SittingCoverageScope>(
    'all_current_placements'
  );
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [medicationRequired, setMedicationRequired] = useState(false);
  const [fosterProvidesSupplies, setFosterProvidesSupplies] = useState(true);
  const [transportNeeded, setTransportNeeded] = useState(false);
  const [notes, setNotes] = useState('');

  // Reset on close.
  useEffect(() => {
    if (!isOpen) {
      setScope('all_current_placements');
      setSelectedAnimalIds([]);
      setStartDate('');
      setEndDate('');
      setMedicationRequired(false);
      setFosterProvidesSupplies(true);
      setTransportNeeded(false);
      setNotes('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    // Resolve covered placement IDs at submit time — even for "all", we
    // snapshot the current state so a later placement change doesn't
    // retroactively expand the request.
    let placementIds: string[] = [];
    if (scope === 'all_current_placements') {
      placementIds = myPlacements.map((p) => p.id);
    } else {
      placementIds = selectedAnimalIds.
      map((aid) => myPlacements.find((p) => p.animal_id === aid)?.id).
      filter((id): id is string => !!id);
    }
    if (placementIds.length === 0) return;

    addSittingRequest(
      {
        requested_by_person_id: currentPersonId ?? '',
        coverage_scope: scope,
        start_date: startDate,
        end_date: endDate,
        medication_required: medicationRequired,
        foster_provides_supplies: fosterProvidesSupplies,
        transport_needed: transportNeeded,
        status: 'open',
        notes: notes.trim() || undefined
      },
      placementIds
    );
    onClose();
  };

  // Friendly list of names for the "all" copy ("Juniper, Marmalade, and Pepper").
  const namesList = (() => {
    const names = myAnimals.map((a) => a.name);
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  })();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Temporary Coverage"
      className="max-w-2xl">

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Coverage scope */}
        <div>
          <Label>Coverage needed for</Label>
          <div className="space-y-2">
            <label
              className={`block p-4 rounded-xl border cursor-pointer transition-colors ${scope === 'all_current_placements' ? 'border-primary bg-primary/5' : 'border-border hover:bg-background/60'}`}>

              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="scope"
                  value="all_current_placements"
                  checked={scope === 'all_current_placements'}
                  onChange={() => setScope('all_current_placements')}
                  className="mt-1 w-4 h-4 text-primary focus:ring-primary" />

                <div className="min-w-0">
                  <p className="font-medium text-text-primary">
                    All animals currently in my care
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">
                    {myAnimals.length === 0 ?
                    'No animals are currently in foster.' :
                    <>Includes {namesList}</>}
                  </p>
                </div>
              </div>
            </label>
            <label
              className={`block p-4 rounded-xl border cursor-pointer transition-colors ${scope === 'selected_placements' ? 'border-primary bg-primary/5' : 'border-border hover:bg-background/60'}`}>

              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="scope"
                  value="selected_placements"
                  checked={scope === 'selected_placements'}
                  onChange={() => setScope('selected_placements')}
                  className="mt-1 w-4 h-4 text-primary focus:ring-primary" />

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary">
                    Select specific animals
                  </p>
                  {scope === 'selected_placements' &&
                  <div className="mt-3">
                      <AnimalMultiPicker
                      animals={animals}
                      scope={myAnimals}
                      selectedIds={selectedAnimalIds}
                      onChange={setSelectedAnimalIds}
                      placeholder="Search animals in your care…" />

                    </div>
                  }
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start">Start date</Label>
            <Input
              id="start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)} />

          </div>
          <div>
            <Label htmlFor="end">End date</Label>
            <Input
              id="end"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)} />

          </div>
        </div>

        <fieldset className="space-y-2 p-4 rounded-xl bg-background/60 border border-border">
          <legend className="text-xs uppercase tracking-wider font-semibold text-text-secondary px-1">
            Sitter requirements
          </legend>
          <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={medicationRequired}
              onChange={(e) => setMedicationRequired(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />

            Comfortable administering medication
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={fosterProvidesSupplies}
              onChange={(e) => setFosterProvidesSupplies(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />

            Foster provides supplies
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={transportNeeded}
              onChange={(e) => setTransportNeeded(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />

            Transport help needed to get to sitter
          </label>
        </fieldset>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything a sitter should know — meds, routines, quirks…"
            rows={3} />

        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Request Coverage</Button>
        </div>
      </form>
    </Modal>);

}
