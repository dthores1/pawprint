import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { FieldError, Textarea, Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { AnimalMultiPicker } from '../ui/AnimalMultiPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import { SittingCoverageScope, SittingRequest } from '../../types';
import { animalDisplayName } from '../../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * When supplied, the modal switches to edit mode. Coverage scope and the
   * animal selection are locked (changing those would require rewriting the
   * sitting_request_placements rows — if a requester needs different coverage
   * they should cancel and create a fresh request). Dates, sitter
   * requirements, and notes remain editable.
   */
  request?: SittingRequest;
}
export function NewSittingRequestModal({ isOpen, onClose, request }: Props) {
  const {
    addSittingRequest,
    updateSittingRequest,
    sittingRequestPlacements,
    placements,
    animalsIndex: animals
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const isEditMode = !!request;

  // TODO(auth): scope to the signed-in user's OWN placements (match
  // currentPersonId to placement.person_id). For now we cover all active
  // placements in the org, so "in my care" reads as "currently in foster".
  const myPlacements = useMemo(
    () => placements.filter((p) => p.placement_status === 'active'),
    [placements]
  );
  const myAnimals = myPlacements.
  map((p) => animals.find((a) => a.id === p.animal_id)).
  filter((a): a is NonNullable<typeof a> => !!a);

  // In edit mode the coverage list is whatever was snapshotted at create
  // time — read straight from sitting_request_placements, joined to
  // foster_placements → animals so the names render whether or not the
  // placement is still active today.
  const coveredAnimals = useMemo(() => {
    if (!request) return [];
    const placementIds = sittingRequestPlacements.
    filter((srp) => srp.sitting_request_id === request.id).
    map((srp) => srp.foster_placement_id);
    return placementIds.
    map((pid) => placements.find((p) => p.id === pid)?.animal_id).
    map((aid) => animals.find((a) => a.id === aid)).
    filter((a): a is NonNullable<typeof a> => !!a);
  }, [request, sittingRequestPlacements, placements, animals]);

  const [scope, setScope] = useState<SittingCoverageScope>(
    'all_current_placements'
  );
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Per-field errors render directly beneath the input they refer to, so
  // "End date is required" doesn't end up left-aligned under the whole row.
  const [startDateError, setStartDateError] = useState<string | null>(null);
  const [endDateError, setEndDateError] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [medicationRequired, setMedicationRequired] = useState(false);
  const [fosterProvidesSupplies, setFosterProvidesSupplies] = useState(true);
  const [transportNeeded, setTransportNeeded] = useState(false);
  const [notes, setNotes] = useState('');

  // Today as a yyyy-MM-dd string (local). Used as the floor for both date
  // pickers so past days are grayed out, and again as a submit-time backstop.
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Re-seed when the modal opens — blank for create, hydrated for edit.
  useEffect(() => {
    if (!isOpen) return;
    if (request) {
      setScope(request.coverage_scope);
      setSelectedAnimalIds([]);
      setStartDate(request.start_date);
      setEndDate(request.end_date);
      setMedicationRequired(request.medication_required);
      setFosterProvidesSupplies(request.foster_provides_supplies);
      setTransportNeeded(request.transport_needed);
      setNotes(request.notes ?? '');
    } else {
      setScope('all_current_placements');
      setSelectedAnimalIds([]);
      setStartDate('');
      setEndDate('');
      setMedicationRequired(false);
      setFosterProvidesSupplies(true);
      setTransportNeeded(false);
      setNotes('');
    }
    setStartDateError(null);
    setEndDateError(null);
    setScopeError(null);
  }, [isOpen, request]);

  const handleStartChange = (v: string) => {
    setStartDate(v);
    if (startDateError) setStartDateError(null);
    // Editing the start can also clear an "end before start" complaint.
    if (endDateError) setEndDateError(null);
  };
  const handleEndChange = (v: string) => {
    setEndDate(v);
    if (endDateError) setEndDateError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let nextStartErr: string | null = null;
    let nextEndErr: string | null = null;
    if (!startDate) nextStartErr = 'Start date is required.';
    if (!endDate) nextEndErr = 'End date is required.';
    // Backstop in case the modal was opened before midnight and submitted
    // after — the picker's day-grayout is computed at render time. Skip
    // this when editing (don't punish a pre-existing request).
    if (!nextStartErr && !isEditMode && startDate < todayStr) {
      nextStartErr = 'Start date can’t be in the past.';
    }
    if (!nextEndErr && startDate && endDate < startDate) {
      nextEndErr = 'End date must be on or after the start date.';
    }
    setStartDateError(nextStartErr);
    setEndDateError(nextEndErr);
    if (nextStartErr || nextEndErr) return;
    if (isEditMode && request) {
      updateSittingRequest(request.id, {
        start_date: startDate,
        end_date: endDate,
        medication_required: medicationRequired,
        foster_provides_supplies: fosterProvidesSupplies,
        transport_needed: transportNeeded,
        notes: notes.trim() || undefined
      });
      onClose();
      return;
    }
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
    if (placementIds.length === 0) {
      setScopeError('Choose at least one active placement.');
      return;
    }

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
  const formatNames = (
  list: { name?: string;rescue_id?: string; }[]) =>
  {
    const names = list.map((a) => animalDisplayName(a as any));
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  };
  const namesList = formatNames(myAnimals);
  const editCoverageList = formatNames(coveredAnimals);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Coverage Request' : 'Request Temporary Coverage'}
      className="max-w-2xl"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="sitting-request-form">
            {isEditMode ? 'Save Changes' : 'Request Coverage'}
          </Button>
        </div>
      }>

      <form
        id="sitting-request-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate>

        {/* Coverage — locked in edit mode (changing scope requires rewriting
            the request's placement rows; cancel-and-recreate for scope shifts). */}
        {isEditMode ?
        <div className="p-4 rounded-xl bg-background/60 border border-border">
            <p className="text-xs uppercase tracking-wider font-semibold text-text-secondary mb-1">
              Coverage for
            </p>
            <p className="text-sm text-text-primary">
              {editCoverageList ||
            'No animals attached to this request.'}
            </p>
            <p className="text-xs text-text-secondary mt-2">
              Coverage is locked once a request exists. To change which
              animals are covered, cancel this request and create a new one.
            </p>
          </div> :

        <div>
            <Label required>Coverage needed for</Label>
            <div className="space-y-2">
              <label
              className={`block p-4 rounded-xl border cursor-pointer transition-colors ${scope === 'all_current_placements' ? 'border-primary bg-primary/5' : 'border-border hover:bg-background/60'}`}>

                <div className="flex items-start gap-3">
                  <input
                  type="radio"
                  name="scope"
                  value="all_current_placements"
                  checked={scope === 'all_current_placements'}
                  onChange={() => {
                    setScope('all_current_placements');
                    setScopeError(null);
                  }}
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
                  onChange={() => {
                    setScope('selected_placements');
                    setScopeError(null);
                  }}
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
                      onChange={(ids) => {
                        setSelectedAnimalIds(ids);
                        setScopeError(null);
                      }}
                      placeholder="Search animals in your care…" />

                      </div>
                  }
                  </div>
                </div>
              </label>
            </div>
            <FieldError>{scopeError}</FieldError>
          </div>
        }

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start" required>Start date</Label>
            <DatePicker
              id="start"
              required
              value={startDate}
              onChange={handleStartChange}
              min={isEditMode ? undefined : todayStr}
              error={!!startDateError} />

            <FieldError>{startDateError}</FieldError>
          </div>
          <div>
            <Label htmlFor="end" required>End date</Label>
            <DatePicker
              id="end"
              required
              align="end"
              min={startDate || (isEditMode ? undefined : todayStr)}
              value={endDate}
              onChange={handleEndChange}
              error={!!endDateError} />

            <FieldError>{endDateError}</FieldError>
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
      </form>
    </Modal>);

}
