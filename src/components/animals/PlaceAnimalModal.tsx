import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Textarea, Label, Input } from '../ui/Forms';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { useWhisker } from '../../context/WhiskerContext';
import { SearchIcon, XIcon, CheckIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
interface PlaceAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}
export function PlaceAnimalModal({
  isOpen,
  onClose,
  animalId
}: PlaceAnimalModalProps) {
  const { fosters, placements, animals, placeAnimal, reassignFoster } =
  useWhisker();
  const [fosterId, setFosterId] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [reasonEnded, setReasonEnded] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animal = animals.find((a) => a.id === animalId);
  const selectedFoster = fosters.find((f) => f.id === fosterId);
  // Source of truth for "currently in foster": an active placement.
  // (See CLAUDE.md — animal.current_foster_id is a denormalized cache.)
  const activePlacement = placements.find(
    (p) => p.animal_id === animalId && p.placement_status === 'active'
  );
  const currentFoster = activePlacement ?
  fosters.find((f) => f.id === activePlacement.foster_parent_id) :
  undefined;
  const isReassign = !!activePlacement;
  const getActivePlacementsCount = (fId: string) =>
  placements.filter(
    (p) => p.foster_parent_id === fId && p.placement_status === 'active'
  ).length;
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fosters.
    filter((f) => f.active).
    // Exclude the current foster — reassigning to themselves is a no-op.
    filter((f) => !currentFoster || f.id !== currentFoster.id).
    filter((f) => {
      if (!q) return true;
      const hay = `${f.first_name} ${f.last_name} ${f.email}`.toLowerCase();
      return hay.includes(q);
    }).
    map((f) => {
      const active = getActivePlacementsCount(f.id);
      const isFull = active >= f.max_capacity;
      return {
        foster: f,
        active,
        isFull
      };
    }).
    sort((a, b) => Number(a.isFull) - Number(b.isFull));
  }, [fosters, placements, query, currentFoster]);
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
      setFosterId('');
      setQuery('');
      setOpen(false);
      setNotes('');
      setReasonEnded('');
      setStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fosterId) return;
    if (isReassign) {
      reassignFoster(
        animalId,
        fosterId,
        startDate,
        reasonEnded.trim() || undefined,
        notes.trim() || undefined
      );
    } else {
      placeAnimal(animalId, fosterId, startDate, notes);
    }
    onClose();
  };
  const handleSelect = (id: string, isFull: boolean) => {
    if (isFull) return;
    setFosterId(id);
    setOpen(false);
    setQuery('');
  };
  const handleClear = () => {
    setFosterId('');
    setQuery('');
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
      isReassign && animal ?
      `Reassign Foster for ${animal.name}` :
      animal ?
      `Place ${animal.name} in Foster Care` :
      'Place in Foster Care'
      }>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Reassign mode: show who is being replaced */}
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

        {/* Foster Parent Typeahead */}
        <div ref={wrapperRef}>
          <Label htmlFor="foster_search">
            {isReassign ? 'New Foster Parent' : 'Foster Parent'}
          </Label>

          {selectedFoster ?
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
                    {selectedFoster.max_capacity} spots filled
                  </p>
                </div>
              </div>
              <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors shrink-0"
              aria-label="Clear selected foster">
              
                <XIcon className="w-4 h-4" />
              </button>
            </div> :

          <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
              <Input
              id="foster_search"
              type="text"
              autoComplete="off"
              placeholder="Search by name or email…"
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
                initial={{
                  opacity: 0,
                  y: -4
                }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                exit={{
                  opacity: 0,
                  y: -4
                }}
                transition={{
                  duration: 0.15
                }}
                className="absolute z-10 mt-1.5 w-full bg-card border border-border rounded-xl shadow-soft-lg overflow-hidden max-h-72 overflow-y-auto">
                
                    {results.length === 0 ?
                <div className="p-4 text-sm text-text-secondary text-center">
                        No foster parents match "{query}".
                      </div> :

                <ul className="py-1">
                        {results.map(({ foster, active, isFull }) =>
                  <li key={foster.id}>
                            <button
                      type="button"
                      disabled={isFull}
                      onClick={() => handleSelect(foster.id, isFull)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${isFull ? 'opacity-50 cursor-not-allowed' : 'hover:bg-background cursor-pointer'}`}>
                      
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
                                    {foster.preferred_species.join(', ')}
                                  </p>
                                </div>
                              </div>
                              <span
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${isFull ? 'bg-status-urgent-bg text-status-urgent-text' : 'bg-[#DDEFE2] text-[#3E7B52]'}`}>
                        
                                {isFull ?
                        'Full' :
                        `${foster.max_capacity - active} open`}
                              </span>
                            </button>
                          </li>
                  )}
                      </ul>
                }
                  </motion.div>
              }
              </AnimatePresence>
            </div>
          }
        </div>

        {/* Start Date */}
        <div>
          <Label htmlFor="start_date">Start Date</Label>
          <Input
            id="start_date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)} />

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

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!fosterId}>
            <CheckIcon className="w-4 h-4 mr-2" />
            {isReassign ? 'Reassign Foster' : 'Place Animal'}
          </Button>
        </div>
      </form>
    </Modal>);

}