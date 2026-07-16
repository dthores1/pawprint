import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Textarea, Label, Input, Select, FieldError } from '../ui/Forms';
import { PLACEMENT_PURPOSE_OPTIONS } from '../../lib/placementPurpose';
import { PlacementPurpose } from '../../types';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../ui/Badge';
import { useWhisker } from '../../context/WhiskerContext';
import { isSupportContact } from '../ui/PersonSearchPicker';
import { AddContactModal } from '../contacts/AddContactModal';
import {
  SearchIcon,
  XIcon,
  CheckIcon,
  AlertTriangleIcon,
  UserPlusIcon } from
'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  animalDisplayName,
  calculateAge,
  cn,
  fosterCapacityLabel,
  hasStatedCapacity } from
'../../lib/utils';
import { isInCare } from '../../lib/animalStatus';
import { litterMembers, litterLabel } from '../../lib/litters';
import { useTypeaheadKeyboard } from '../../lib/useTypeaheadKeyboard';
import { track } from '../../lib/analytics';

// Placement can be launched from any side of the relationship:
//   • animal-anchored (pass animalId): search for a foster to place this animal
//     with — supports reassignment when the animal already has an active placement.
//   • foster-anchored (pass fosterId): search for an animal to place with this
//     foster — always a fresh placement.
//   • litter-anchored (pass litterId): search for a foster and place several of
//     the litter's members with them in one go — all eligible members by
//     default, with per-animal opt-out. Fresh placements only; reassigning an
//     already-fostered member stays on its animal page.
interface PlaceAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId?: string;
  fosterId?: string;
  litterId?: string;
}
export function PlaceAnimalModal({
  isOpen,
  onClose,
  animalId,
  fosterId,
  litterId
}: PlaceAnimalModalProps) {
  const {
    fosters,
    people,
    placements,
    animals,
    animalsIndex,
    litters,
    breeds,
    placeAnimal,
    reassignFoster
  } = useWhisker();
  const mode: 'animal' | 'foster' | 'litter' = fosterId ?
  'foster' :
  litterId ?
  'litter' :
  'animal';
  // The searched/selected counterpart id (a foster in animal mode, an animal in
  // foster mode).
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  // Inline "New Contact" flow (animal/litter mode) — stacks AddContactModal
  // above this form, mirroring the clinic vet picker; the created person is
  // selected as the foster parent (and promoted to the role on placement).
  const [creatingContact, setCreatingContact] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [placementPurpose, setPlacementPurpose] =
  useState<PlacementPurpose>('general_foster');
  // Client-side only: a placement can't predate the animal's intake. Enforced in
  // the UI (not the DB) so historical/bulk imports aren't blocked.
  const [dateError, setDateError] = useState('');
  // Optional planned end date — only collected for time-boxed (non-general) stays.
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const isTemporary = placementPurpose !== 'general_foster';
  const [notes, setNotes] = useState('');
  const [reasonEnded, setReasonEnded] = useState('');
  // Foster mode: by default the animal search is scoped to the foster's
  // preferred species; this opts out of that scoping.
  const [showAllSpecies, setShowAllSpecies] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fixed anchor (from props) + the selected counterpart (from state).
  const anchorAnimal = animalId ?
  animals.find((a) => a.id === animalId) :
  undefined;
  const anchorFoster = fosterId ?
  fosters.find((f) => f.id === fosterId) :
  undefined;
  const anchorLitter = litterId ?
  litters.find((l) => l.id === litterId) :
  undefined;

  // Litter mode: the roster with per-member bulk-placement eligibility. Members
  // come from the index so even historical (adopted/released) ones are listed —
  // shown disabled with the reason rather than silently missing. Eligible =
  // still in care and not already in an active placement.
  const activePlacementAnimalIds = useMemo(
    () =>
    new Set(
      placements.
      filter((p) => p.placement_status === 'active').
      map((p) => p.animal_id)
    ),
    [placements]
  );
  const litterRoster = useMemo(() => {
    if (!litterId) return [];
    return litterMembers(animalsIndex, litterId).map((animal) => {
      const alreadyFostered = activePlacementAnimalIds.has(animal.id);
      const inCare = isInCare(animal.status);
      return {
        animal,
        eligible: inCare && !alreadyFostered,
        ineligibleReason: alreadyFostered ?
        'already fostered' :
        !inCare ?
        animal.status.replace('_', ' ') :
        undefined
      };
    });
  }, [litterId, animalsIndex, activePlacementAnimalIds]);
  const eligibleMemberIds = litterRoster.
  filter((m) => m.eligible).
  map((m) => m.animal.id);
  const hasIneligibleMembers = litterRoster.some((m) => !m.eligible);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    () => new Set()
  );
  const [submitting, setSubmitting] = useState(false);
  const allEligibleSelected =
  eligibleMemberIds.length > 0 &&
  eligibleMemberIds.every((mid) => selectedMemberIds.has(mid));
  const toggleAllMembers = (checked: boolean) =>
  setSelectedMemberIds(checked ? new Set(eligibleMemberIds) : new Set());
  const toggleMember = (mid: string) =>
  setSelectedMemberIds((prev) => {
    const next = new Set(prev);
    if (next.has(mid)) next.delete(mid);else
    next.add(mid);
    return next;
  });

  // Animal mode lets you pick ANY active contact (not just existing fosters), so
  // resolve the selection from `people`. A non-foster is granted the
  // foster_parent role on placement (handled in the context's placeAnimal).
  const selectedFoster =
  mode !== 'foster' ? people.find((p) => p.id === selectedId) : undefined;
  const selectedIsFoster =
  !!selectedFoster?.roles.includes('foster_parent');
  const selectedAnimal =
  mode === 'foster' ? animals.find((a) => a.id === selectedId) : undefined;
  // The animal being placed (the anchor in animal mode, the selection in foster
  // mode) — its intake date is the earliest valid placement start.
  const placementAnimal = mode === 'foster' ? selectedAnimal : anchorAnimal;
  // Litter mode places several animals at once, so the earliest valid start is
  // the LATEST intake among the selected members — the one date valid for all.
  // Slim index rows may lack intake_date; fall back to the heavy row, then the
  // litter's own intake date.
  const litterMinStartDate =
  mode === 'litter' ?
  litterRoster.
  filter((m) => selectedMemberIds.has(m.animal.id)).
  map(
    (m) =>
    (animals.find((a) => a.id === m.animal.id) ?? m.animal).intake_date ||
    anchorLitter?.intake_date
  ).
  filter((d): d is string => Boolean(d)).
  reduce<string | undefined>((a, b) => (a && a > b ? a : b), undefined) :
  undefined;
  const minStartDate =
  mode === 'litter' ?
  litterMinStartDate :
  placementAnimal?.intake_date || undefined;

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
  hasStatedCapacity(anchorFoster.max_capacity) &&
  anchorFosterActive >= (anchorFoster.max_capacity ?? 0) :
  false;
  // Animal/litter mode: a selected existing foster whose stated capacity this
  // placement would exceed (litter mode counts every selected member).
  // Over-capacity placements are allowed (exceptions happen), so this is a
  // soft, non-blocking hint, not a confirmation gate. No stated capacity →
  // nothing to exceed.
  const placingCount = mode === 'litter' ? selectedMemberIds.size : 1;
  const selectedFosterOverCapacity =
  mode !== 'foster' &&
  !!selectedFoster &&
  selectedIsFoster &&
  hasStatedCapacity(selectedFoster.max_capacity) &&
  getActivePlacementsCount(selectedFoster.id) + placingCount >
  (selectedFoster.max_capacity ?? 0);

  // Foster results (animal mode): active foster parents, excluding the current
  // one. Shown first — they're the primary, expected choice.
  const fosterResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.
    filter((p) => p.active && p.roles.includes('foster_parent')).
    filter((p) => !isSupportContact(p)).
    filter((p) => !currentFoster || p.id !== currentFoster.id).
    filter(
      (p) =>
      !q ||
      `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(q)
    ).
    map((f) => {
      const active = getActivePlacementsCount(f.id);
      const isFull =
      hasStatedCapacity(f.max_capacity) && active >= (f.max_capacity ?? 0);
      return { foster: f, active, isFull };
    }).
    sort((a, b) => Number(a.isFull) - Number(b.isFull));
  }, [people, placements, query, currentFoster]);

  // Other contacts (animal mode): active people who aren't foster parents yet.
  // Selecting one promotes them to foster parent on placement. Account
  // self-records (user_id set) ARE included — org members are the volunteers,
  // so they must be placeable even before anyone grants them the foster role.
  // Only vendor support accounts stay hidden.
  const otherContactResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.
    filter((p) => p.active && !p.roles.includes('foster_parent')).
    filter((p) => !isSupportContact(p)).
    filter((p) => !currentFoster || p.id !== currentFoster.id).
    filter(
      (p) =>
      !q ||
      `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(q)
    ).
    slice(0, 12);
  }, [people, query, currentFoster]);

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
    filter((a) => !filterBySpecies || (prefs as string[]).includes(a.species)).
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
      setCreatingContact(false);
      setNotes('');
      setReasonEnded('');
      setShowAllSpecies(false);
      setStartDate(new Date().toISOString().split('T')[0]);
      setExpectedEndDate('');
      setPlacementPurpose('general_foster');
      setDateError('');
      setSubmitting(false);
    }
  }, [isOpen]);
  // Litter mode: every eligible member starts selected — placing the whole
  // litter together is the common case; unchecking opts individuals out.
  useEffect(() => {
    if (isOpen && mode === 'litter') {
      setSelectedMemberIds(new Set(eligibleMemberIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, litterId]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    // A placement can't start before the animal was taken in (UI guard only).
    if (minStartDate && startDate < minStartDate) {
      setDateError('Foster placement cannot occur before intake.');
      return;
    }
    // General Foster hides the end-date field; don't persist a stale value.
    const expectedEnd = isTemporary ? expectedEndDate || undefined : undefined;
    if (mode === 'litter') {
      if (selectedMemberIds.size === 0 || submitting) return;
      setSubmitting(true);
      // Sequential on purpose: parallel placeAnimal calls would race the
      // foster-role grant (ensureFosterRole) for the same person.
      for (const memberId of selectedMemberIds) {
        await placeAnimal(
          memberId,
          selectedId,
          startDate,
          notes,
          expectedEnd,
          placementPurpose
        );
        track('animal_placed', { animal_id: memberId, reassignment: false });
      }
      track('litter_placed', {
        litter_id: litterId,
        animal_count: selectedMemberIds.size
      });
      onClose();
      return;
    }
    if (mode === 'foster') {
      if (!anchorFoster) return;
      placeAnimal(
        selectedId,
        anchorFoster.id,
        startDate,
        notes,
        expectedEnd,
        placementPurpose
      );
      track('animal_placed', { animal_id: selectedId, reassignment: false });
    } else {
      if (!anchorAnimal) return;
      if (isReassign) {
        reassignFoster(
          anchorAnimal.id,
          selectedId,
          startDate,
          reasonEnded.trim() || undefined,
          notes.trim() || undefined,
          expectedEnd,
          placementPurpose
        );
        track('animal_placed', {
          animal_id: anchorAnimal.id,
          reassignment: true
        });
      } else {
        placeAnimal(
          anchorAnimal.id,
          selectedId,
          startDate,
          notes,
          expectedEnd,
          placementPurpose
        );
        track('animal_placed', {
          animal_id: anchorAnimal.id,
          reassignment: false
        });
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

  const handleCreateContact = () => {
    setOpen(false);
    setCreatingContact(true);
  };

  // Flat list of the currently-shown options, in render order, for keyboard nav.
  // Animal mode lists fosters, then other contacts, then the New Contact action;
  // foster mode lists animals.
  const navChoices: (() => void)[] =
  mode === 'foster' ?
  animalResults.map((a) => () => handleSelectAnimal(a.id)) :
  [
  ...fosterResults.map(({ foster }) => () => handleSelectFoster(foster.id)),
  ...otherContactResults.map((c) => () => handleSelectFoster(c.id)),
  handleCreateContact];

  const { activeIndex, setActiveIndex, onKeyDown } = useTypeaheadKeyboard({
    open,
    setOpen,
    count: navChoices.length,
    onChoose: (i) => navChoices[i](),
    menuRef
  });

  const title =
  mode === 'foster' && anchorFoster ?
  `Place Animal with ${anchorFoster.first_name} ${anchorFoster.last_name}` :
  mode === 'litter' && anchorLitter ?
  `Place ${litterLabel(anchorLitter, breeds)} in Foster Care` :
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
          disabled={
          !selectedId || (
          mode === 'litter' && (selectedMemberIds.size === 0 || submitting))
          }>
            <CheckIcon className="w-4 h-4 mr-2" />
            {isReassign ?
          'Reassign Foster' :
          mode === 'litter' ?
          submitting ?
          'Placing…' :
          `Place ${selectedMemberIds.size} Animal${
          selectedMemberIds.size === 1 ? '' : 's'}` :

          'Place Animal'}
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

              {anchorFosterFull ?
            `${anchorFosterActive} / ${anchorFoster.max_capacity} · at capacity` :
            fosterCapacityLabel(anchorFosterActive, anchorFoster.max_capacity)}
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
          {mode !== 'foster' && selectedFoster ?
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
                    {selectedIsFoster ?
                    fosterCapacityLabel(
                      getActivePlacementsCount(selectedFoster.id),
                      selectedFoster.max_capacity
                    ) :
                    'Will be added as a foster parent'}
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
              onKeyDown={onKeyDown}
              className="pl-9" />


              <AnimatePresence>
                {open &&
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute z-10 mt-1.5 w-full bg-card border border-border rounded-xl shadow-soft-lg overflow-hidden max-h-72 overflow-y-auto">

    {/* Foster + contact results (animal/litter mode), split into
                         two sections. Empty sections are omitted; the New
                         Contact action always closes the list. */}
                    {mode !== 'foster' && (
                  fosterResults.length === 0 &&
                  otherContactResults.length === 0 ?
                  <div className="p-4 text-sm text-text-secondary text-center">
                          {query ?
                    `No contacts match "${query}".` :
                    'No contacts available.'}
                        </div> :

                  <>
                          {fosterResults.length > 0 &&
                    <>
                              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-background border-b border-border sticky top-0 z-10">
                                Foster Parents
                              </div>
                              <ul className="py-1">
                                {fosterResults.map(({ foster, active, isFull }, i) =>
                        <li key={foster.id}>
                                    <button
                            type="button"
                            data-ta-index={i}
                            onMouseEnter={() => setActiveIndex(i)}
                            onClick={() => handleSelectFoster(foster.id)}
                            className={cn(
                              'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-background cursor-pointer',
                              activeIndex === i && 'bg-background'
                            )}>

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
                                            {hasStatedCapacity(foster.max_capacity) ?
                                    `${active}/${foster.max_capacity} in care` :
                                    `${active} in care`}
                                          </p>
                                        </div>
                                      </div>
                                      <span
                              className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                              isFull ?
                              'bg-status-medical-bg text-status-medical-text' :
                              hasStatedCapacity(foster.max_capacity) ?
                              'bg-[#DDEFE2] text-[#3E7B52]' :
                              'bg-[#E5E2DC] text-[#6B6B6B]'}`
                              }>

                                        {isFull ?
                              'At capacity' :
                              hasStatedCapacity(foster.max_capacity) ?
                              `${(foster.max_capacity ?? 0) - active} open` :
                              'No limit set'}
                                      </span>
                                    </button>
                                  </li>
                        )}
                              </ul>
                            </>
                    }
                          {otherContactResults.length > 0 &&
                    <>
                              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-background border-b border-border sticky top-0 z-10">
                                Other Contacts
                              </div>
                              <ul className="py-1">
                                {otherContactResults.map((contact, j) =>
                        <li key={contact.id}>
                                    <button
                            type="button"
                            data-ta-index={fosterResults.length + j}
                            onMouseEnter={() =>
                            setActiveIndex(fosterResults.length + j)
                            }
                            onClick={() => handleSelectFoster(contact.id)}
                            className={cn(
                              'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-background cursor-pointer',
                              activeIndex === fosterResults.length + j &&
                              'bg-background'
                            )}>

                                      <div className="flex items-center gap-3 min-w-0">
                                        <Avatar
                                src={contact.photo_url}
                                name={`${contact.first_name} ${contact.last_name}`}
                                colorKey={contact.id}
                                size="sm" />

                                        <div className="min-w-0">
                                          <p className="font-medium text-text-primary truncate text-sm">
                                            {contact.first_name} {contact.last_name}
                                          </p>
                                          <p className="text-xs text-text-secondary truncate">
                                            {contact.organization_name || contact.email}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                        + Foster
                                      </span>
                                    </button>
                                  </li>
                        )}
                              </ul>
                            </>
                    }
                        </>)
                  }
                    {mode !== 'foster' &&
                <div className="border-t border-border">
                        <button
                    type="button"
                    data-ta-index={
                    fosterResults.length + otherContactResults.length
                    }
                    onMouseEnter={() =>
                    setActiveIndex(
                      fosterResults.length + otherContactResults.length
                    )
                    }
                    onClick={handleCreateContact}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-primary/5 cursor-pointer transition-colors',
                      activeIndex ===
                      fosterResults.length + otherContactResults.length &&
                      'bg-primary/5'
                    )}>

                          <UserPlusIcon className="w-4 h-4 shrink-0" />
                          New Contact{query.trim() ? ` "${query.trim()}"` : ''}
                        </button>
                      </div>
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
                          {animalResults.map((animal, j) =>
                    <li key={animal.id}>
                              <button
                        type="button"
                        data-ta-index={j}
                        onMouseEnter={() => setActiveIndex(j)}
                        onClick={() => handleSelectAnimal(animal.id)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-background cursor-pointer transition-colors',
                          activeIndex === j && 'bg-background'
                        )}>

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

          {/* Soft capacity warning — rendered inside the Foster Parent field
              block (not as a form-level sibling) so it sits directly under the
              field it refers to and isn't spaced equidistant from the next one. */}
          {selectedFosterOverCapacity &&
          <p className="mt-2 flex items-start gap-1.5 text-xs text-status-medical-text">
              <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>
                This placement will exceed the foster parent's stated capacity.
              </span>
            </p>
          }
        </div>

        {/* Litter mode: which members go. All eligible members are selected by
            default; the roster is shown when the user opts out of "place all"
            OR when some members can't come along (already fostered / out of
            care) — so a partial placement is never a surprise. */}
        {mode === 'litter' &&
        <div>
            <label
            className={cn(
              'flex items-center gap-2.5 text-sm font-medium text-text-primary',
              eligibleMemberIds.length > 0 ? 'cursor-pointer' : 'opacity-60'
            )}>

              <input
              type="checkbox"
              checked={allEligibleSelected}
              disabled={eligibleMemberIds.length === 0}
              onChange={(e) => toggleAllMembers(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer" />

              Place all {hasIneligibleMembers ? 'eligible ' : ''}animals in this
              litter
            </label>
            {eligibleMemberIds.length === 0 ?
          <p className="mt-2 text-xs text-text-secondary">
                Every animal in this litter is already fostered or no longer in
                care.
              </p> :
          (!allEligibleSelected || hasIneligibleMembers) &&
          <div className="mt-3 border border-border rounded-xl divide-y divide-border overflow-hidden">
                {litterRoster.map(({ animal, eligible, ineligibleReason }) =>
            <label
              key={animal.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5',
                eligible ?
                'cursor-pointer hover:bg-background/60 transition-colors' :
                'opacity-60'
              )}>

                    <input
                type="checkbox"
                checked={selectedMemberIds.has(animal.id)}
                disabled={!eligible}
                onChange={() => toggleMember(animal.id)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40" />

                    <Avatar
                src={animal.primary_photo_url}
                type="animal"
                species={animal.species}
                size="sm" />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {animalDisplayName(animal)}
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {calculateAge(animal.estimated_birth_date)} · {animal.sex}
                      </p>
                    </div>
                    {ineligibleReason &&
              <span className="shrink-0 text-xs text-text-secondary">
                        {ineligibleReason}
                      </span>
              }
                  </label>
            )}
              </div>
          }
          </div>
        }

        {/* Placement purpose — drives whether an end date is collected */}
        <div>
          <Label htmlFor="placement_purpose">Placement Purpose</Label>
          <Select
            id="placement_purpose"
            value={placementPurpose}
            onChange={(e) =>
            setPlacementPurpose(e.target.value as PlacementPurpose)
            }>

            {PLACEMENT_PURPOSE_OPTIONS.map((o) =>
            <option key={o.value} value={o.value}>
                {o.label}
              </option>
            )}
          </Select>
          {isTemporary &&
          <p className="mt-1 pl-1 text-xs text-text-secondary">
              A time-boxed stay — set an expected end date below.
            </p>
          }
        </div>

        {/* Start date + (for temporary purposes) an expected end date */}
        <div
          className={
          isTemporary ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : undefined
          }>

          <div>
            <Label htmlFor="start_date" required>Start Date</Label>
            <DatePicker
              id="start_date"
              required
              value={startDate}
              min={minStartDate}
              error={Boolean(dateError)}
              onChange={(v) => {
                setStartDate(v);
                if (dateError) setDateError('');
              }} />
            <FieldError>{dateError}</FieldError>
          </div>
          {isTemporary &&
          <div>
              <Label htmlFor="expected_end_date">
                Expected End Date (optional)
              </Label>
              <DatePicker
              id="expected_end_date"
              align="end"
              value={expectedEndDate}
              onChange={setExpectedEndDate} />

            </div>
          }
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

      {/* Inline "New Contact" flow — stacks above the placement form (which
          keeps its state) and selects the created person as the foster parent,
          mirroring the clinic vet picker. */}
      <AddContactModal
        isOpen={creatingContact}
        defaultRoles={['foster_parent']}
        onCreated={(person) => handleSelectFoster(person.id)}
        onClose={() => setCreatingContact(false)} />

    </Modal>);

}
