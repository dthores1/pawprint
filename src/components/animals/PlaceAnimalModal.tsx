import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Textarea, Label, Input } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../ui/Badge';
import { useWhisker } from '../../context/WhiskerContext';
import { SearchIcon, XIcon, CheckIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { animalDisplayName } from '../../lib/utils';

// Placement can be launched from either side of the relationship:
//   • animal-anchored (pass animalId): search for a foster to place this animal
//     with — supports reassignment when the animal already has an active placement.
//   • foster-anchored (pass fosterId): search for an animal to place with this
//     foster — always a fresh placement.
interface PlaceAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId?: string;
  fosterId?: string;
}
export function PlaceAnimalModal({
  isOpen,
  onClose,
  animalId,
  fosterId
}: PlaceAnimalModalProps) {
  const { fosters, placements, animals, placeAnimal, reassignFoster } =
  useWhisker();
  const mode: 'animal' | 'foster' = fosterId ? 'foster' : 'animal';
  // The searched/selected counterpart id (a foster in animal mode, an animal in
  // foster mode).
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [reasonEnded, setReasonEnded] = useState('');
  // Foster mode: by default the animal search is scoped to the foster's
  // preferred species; this opts out of that scoping.
  const [showAllSpecies, setShowAllSpecies] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fixed anchor (from props) + the selected counterpart (from state).
  const anchorAnimal = animalId ?
  animals.find((a) => a.id === animalId) :
  undefined;
  const anchorFoster = fosterId ?
  fosters.find((f) => f.id === fosterId) :
  undefined;
  const selectedFoster =
  mode === 'animal' ? fosters.find((f) => f.id === selectedId) : undefined;
  const selectedAnimal =
  mode === 'foster' ? animals.find((a) => a.id === selectedId) : undefined;

  // Species scoping for the animal search (foster mode only).
  const fosterPrefs = anchorFoster?.preferred_species ?? [];
  const hasPrefs = mode === 'foster' && fosterPrefs.length > 0;
  const applySpeciesFilter = hasPrefs && !showAllSpecies;

  // Reassign only applies in animal mode, when the animal already has an active
  // placement. (See CLAUDE.md — animal.current_foster_id is a denormalized cache.)
  const activePlacement = anchorAnimal ?
  placements.find(
    (p) => p.animal_id === anchorAnimal.id && p.placement_status === 'active'
  ) :
  undefined;
  const currentFoster = activePlacement ?
  fosters.find((f) => f.id === activePlacement.person_id) :
  undefined;
  const isReassign = mode === 'animal' && !!activePlacement;

  const getActivePlacementsCount = (fId: string) =>
  placements.filter(
    (p) => p.person_id === fId && p.placement_status === 'active'
  ).length;
  const anchorFosterActive = anchorFoster ?
  getActivePlacementsCount(anchorFoster.id) :
  0;
  const anchorFosterFull = anchorFoster ?
  anchorFosterActive >= (anchorFoster.max_capacity ?? 0) :
  false;

  // Foster results (animal mode): active fosters, excluding the current one.
  const fosterResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fosters.
    filter((f) => f.active).
    filter((f) => !currentFoster || f.id !== currentFoster.id).
    filter((f) => {
      if (!q) return true;
      const hay = `${f.first_name} ${f.last_name} ${f.email}`.toLowerCase();
      return hay.includes(q);
    }).
    map((f) => {
      const active = getActivePlacementsCount(f.id);
      const isFull = active >= (f.max_capacity ?? 0);
      return { foster: f, active, isFull };
    }).
    sort((a, b) => Number(a.isFull) - Number(b.isFull));
  }, [fosters, placements, query, currentFoster]);

  // Animal results (foster mode): animals not already in an active placement and
  // not in a terminal status — i.e. those actually available to be placed.
  const animalResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const placedIds = new Set(
      placements.
      filter((p) => p.placement_status === 'active').
      map((p) => p.animal_id)
    );
    const prefs = anchorFoster?.preferred_species ?? [];
    const filterBySpecies =
    mode === 'foster' && prefs.length > 0 && !showAllSpecies;
    return animals.
    filter((a) => !placedIds.has(a.id)).
    filter((a) => a.status !== 'adopted' && a.status !== 'deceased').
    filter((a) => !filterBySpecies || prefs.includes(a.species)).
    filter((a) => {
      if (!q) return true;
      return `${a.name ?? ''} ${a.rescue_id ?? ''} ${a.id}`.
      toLowerCase().
      includes(q);
    }).
    slice(0, 30);
  }, [animals, placements, query, anchorFoster, showAllSpecies, mode]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
      wrapperRef.current &&
      !wrapperRef.current.contains(e.target as Node))
      {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedId('');
      setQuery('');
      setOpen(false);
      setNotes('');
      setReasonEnded('');
      setShowAllSpecies(false);
      setStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    if (mode === 'foster') {
      if (!anchorFoster) return;
      placeAnimal(selectedId, anchorFoster.id, startDate, notes);
    } else {
      if (!anchorAnimal) return;
      if (isReassign) {
        reassignFoster(
          anchorAnimal.id,
          selectedId,
          startDate,
          reasonEnded.trim() || undefined,
          notes.trim() || undefined
        );
      } else {
        placeAnimal(anchorAnimal.id, selectedId, startDate, notes);
      }
    }
    onClose();
  };
  // Over-capacity fosters are allowed (temporary placements, exceptions happen) —
  // they just sort lower and show a clear "at capacity" marker.
  const handleSelectFoster = (id: string) => {
    setSelectedId(id);
    setOpen(false);
    setQuery('');
  };
  const handleSelectAnimal = (id: string) => {
    setSelectedId(id);
    setOpen(false);
    setQuery('');
  };
  const handleClear = () => {
    setSelectedId('');
    setQuery('');
  };

  const title =
  mode === 'foster' && anchorFoster ?
  `Place Animal with ${anchorFoster.first_name} ${anchorFoster.last_name}` :
  isReassign && anchorAnimal ?
  `Reassign Foster for ${anchorAnimal.name}` :
  anchorAnimal ?
  `Place ${anchorAnimal.name} in Foster Care` :
  'Place in Foster Care';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
          type="submit"
          form="place-animal-form"
          disabled={!selectedId}>
            <CheckIcon className="w-4 h-4 mr-2" />
            {isReassign ? 'Reassign Foster' : 'Place Animal'}
          </Button>
        </div>
      }>

      <form id="place-animal-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Reassign mode (animal-anchored): show who is being replaced */}
        {isReassign && currentFoster &&
        <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
            <Avatar
            src={currentFoster.photo_url}
            name={`${currentFoster.first_name} ${currentFoster.last_name}`}
            colorKey={currentFoster.id}
            size="sm" />

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-text-secondary">
                Currently with
              </p>
              <p className="font-medium text-text-primary truncate">
                {currentFoster.first_name} {currentFoster.last_name}
              </p>
            </div>
            <span className="text-xs text-text-secondary shrink-0">
              Will be closed on submit
            </span>
          </div>
        }

        {/* Capacity hint (foster-anchored) */}
        {mode === 'foster' && anchorFoster &&
        <div
          className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
          anchorFosterFull ?
          'bg-status-medical-bg border-status-medical-bg' :
          'bg-background border-border'}`
          }>

            <p className="text-sm text-text-secondary">
              {anchorFoster.first_name}'s capacity
            </p>
            <span
            className={`text-sm font-medium ${
            anchorFosterFull ? 'text-status-medical-text' : 'text-text-primary'}`
            }>

              {anchorFosterActive} / {anchorFoster.max_capacity ?? 0}
              {anchorFosterFull ? ' · at capacity' : ' spots filled'}
            </span>
          </div>
        }

        {/* Counterpart Typeahead */}
        <div ref={wrapperRef}>
          <Label htmlFor="placement_search" required>
            {mode === 'foster' ?
            'Animal' :
            isReassign ?
            'New Foster Parent' :
            'Foster Parent'}
          </Label>

          {/* Selected counterpart chip */}
          {mode === 'animal' && selectedFoster ?
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                src={selectedFoster.photo_url}
                name={`${selectedFoster.first_name} ${selectedFoster.last_name}`}
                colorKey={selectedFoster.id}
                size="sm" />

                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {selectedFoster.first_name} {selectedFoster.last_name}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {getActivePlacementsCount(selectedFoster.id)} of{' '}
                    {selectedFoster.max_capacity ?? 0} spots filled
                  </p>
                </div>
              </div>
              <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors shrink-0"
              aria-label="Clear selection">

                <XIcon className="w-4 h-4" />
              </button>
            </div> :
          mode === 'foster' && selectedAnimal ?
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                src={selectedAnimal.primary_photo_url}
                type="animal"
                species={selectedAnimal.species}
                size="sm" />

                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {selectedAnimal.name}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {selectedAnimal.species} • {selectedAnimal.sex}
                  </p>
                </div>
              </div>
              <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors shrink-0"
              aria-label="Clear selection">

                <XIcon className="w-4 h-4" />
              </button>
            </div> :

          <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
              <Input
              id="placement_search"
              type="text"
              autoComplete="off"
              placeholder={
              mode === 'foster' ?
              'Search by name or ID…' :
              'Search by name or email…'
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              className="pl-9" />


              <AnimatePresence>
                {open &&
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute z-10 mt-1.5 w-full bg-card border border-border rounded-xl shadow-soft-lg overflow-hidden max-h-72 overflow-y-auto">

                    {/* Foster results (animal mode) */}
                    {mode === 'animal' && (
                  fosterResults.length === 0 ?
                  <div className="p-4 text-sm text-text-secondary text-center">
                          No foster parents match "{query}".
                        </div> :

                  <ul className="py-1">
                          {fosterResults.map(({ foster, active, isFull }) =>
                    <li key={foster.id}>
                              <button
                        type="button"
                        onClick={() => handleSelectFoster(foster.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-background cursor-pointer">

                                <div className="flex items-center gap-3 min-w-0">
                                  <Avatar
                            src={foster.photo_url}
                            name={`${foster.first_name} ${foster.last_name}`}
                            colorKey={foster.id}
                            size="sm" />

                                  <div className="min-w-0">
                                    <p className="font-medium text-text-primary truncate text-sm">
                                      {foster.first_name} {foster.last_name}
                                    </p>
                                    <p className="text-xs text-text-secondary truncate">
                                      {(foster.preferred_species ?? []).join(', ')} ·{' '}
                                      {active}/{foster.max_capacity ?? 0} in care
                                    </p>
                                  </div>
                                </div>
                                <span
                          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${isFull ? 'bg-status-medical-bg text-status-medical-text' : 'bg-[#DDEFE2] text-[#3E7B52]'}`}>

                                  {isFull ?
                          'At capacity' :
                          `${(foster.max_capacity ?? 0) - active} open`}
                                </span>
                              </button>
                            </li>
                    )}
                        </ul>)
                  }

                    {/* Animal results (foster mode) */}
                    {mode === 'foster' &&
                <>
                    {hasPrefs &&
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-background text-xs sticky top-0 z-10">
                          <span className="text-text-secondary min-w-0 truncate">
                            {applySpeciesFilter ?
                      `Matching ${anchorFoster!.first_name}'s preferences (${fosterPrefs.join(', ')})` :
                      'Showing all animals'}
                          </span>
                          <button
                      type="button"
                      onClick={() => setShowAllSpecies((v) => !v)}
                      className="font-medium text-primary hover:underline shrink-0">

                            {applySpeciesFilter ?
                      'Show all animals' :
                      'Match preferences'}
                          </button>
                        </div>
                  }
                    {animalResults.length === 0 ?
                  <div className="p-4 text-sm text-text-secondary text-center">
                          {query ?
                    `No available animals match "${query}".` :
                    applySpeciesFilter ?
                    `No available animals match ${anchorFoster!.first_name}'s preferences.` :
                    'No animals available to place.'}
                        </div> :

                  <ul className="py-1">
                          {animalResults.map((animal) =>
                    <li key={animal.id}>
                              <button
                        type="button"
                        onClick={() => handleSelectAnimal(animal.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-background cursor-pointer transition-colors">

                                <div className="flex items-center gap-3 min-w-0">
                                  <Avatar
                            src={animal.primary_photo_url}
                            type="animal"
                            species={animal.species}
                            size="sm" />

                                  <div className="min-w-0">
                                    <p className="font-medium text-text-primary truncate text-sm">
                                      {animalDisplayName(animal)}
                                    </p>
                                    <p className="text-xs text-text-secondary truncate">
                                      {animal.rescue_id ?
                            <span className="font-mono">
                                          {animal.rescue_id} ·{' '}
                                        </span> :
                            null}
                                      {animal.species} • {animal.sex}
                                    </p>
                                  </div>
                                </div>
                                <StatusBadge
                          status={animal.status}
                          className="shrink-0 scale-90 origin-right" />

                              </button>
                            </li>
                    )}
                        </ul>}
                  </>
                  }
                  </motion.div>
              }
              </AnimatePresence>
            </div>
          }
        </div>

        {/* Start Date */}
        <div>
          <Label htmlFor="start_date" required>Start Date</Label>
          <DatePicker
            id="start_date"
            required
            value={startDate}
            onChange={setStartDate} />

        </div>

        {/* Reason for ending the previous placement — reassign only */}
        {isReassign &&
        <div>
            <Label htmlFor="reason_ended">
              Reason for reassignment (optional)
            </Label>
            <Input
            id="reason_ended"
            type="text"
            value={reasonEnded}
            onChange={(e) => setReasonEnded(e.target.value)}
            placeholder="e.g. Foster moved, medical hand-off, capacity…" />

          </div>
        }

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Placement Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any specific instructions or notes for this placement…" />

        </div>
      </form>
    </Modal>);

}
