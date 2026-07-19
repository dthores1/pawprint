import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input, Select, Textarea, Label, FieldError } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { FormSection } from '../ui/FormSection';
import { Button } from '../ui/Button';
import { AgeInformationFields, AgeInputMode } from './AgeInformationFields';
import { focusFirstError } from '../../lib/focusFirstError';
import { BreedCombobox } from './BreedCombobox';
import { TraitMultiSelect } from './TraitMultiSelect';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import {
  AnimalStatus,
  Priority,
  Sex,
  AgeUnit,
  AdoptionReturnReason } from
'../../types';
import { deriveAgeInfo } from '../../lib/age';
import {
  ADOPTION_STATUS_LABELS,
  ADOPTION_RETURN_REASONS,
  ADOPTION_RETURN_REASON_LABELS,
  adoptionCoversAnimal,
  isActiveAdoption } from
'../../lib/adoptions';
import { legacyRoleFor } from '../../lib/peopleApi';
import { bondedPartnerIds } from '../../lib/bondedPairs';
import { isInCare, STATUS_LABELS } from '../../lib/animalStatus';
import { animalDisplayName } from '../../lib/utils';
import { breedFieldLabel } from '../../lib/speciesIcons';
import { enabledSpeciesList } from '../../lib/orgCatalog';
import { track } from '../../lib/analytics';

function ConcernCheckbox({
  label,
  checked,
  onChange,
  help
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-text-primary">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded text-primary focus:ring-primary" />
        {label}
      </label>
      <p className="text-xs text-text-secondary mt-2 ml-[26px]">{help}</p>
    </div>);
}

// File name kept for now (the import path is stable); the modal has expanded
// from "change status & priority" to a general "Edit animal" modal.
interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
  /**
   * Foster-collaboration mode: the viewer is this animal's active foster but
   * isn't an animal manager. Only the care considerations, traits, and a
   * timeline note are editable — the rest of the form is hidden and the save
   * sends only the foster-writable columns (matching the server-side trigger
   * whitelist). Defaults to false (full edit).
   */
  fosterScope?: boolean;
}
export function ChangeStatusModal({
  isOpen,
  onClose,
  animalId,
  fosterScope = false
}: ChangeStatusModalProps) {
  const {
    animals,
    updateAnimal,
    deleteAnimal,
    addNote,
    species: speciesCatalog,
    organizationSpecies,
    animalTraits,
    setAnimalTraits,
    actionItems,
    addActionItem,
    updateActionItem,
    adoptions,
    placements,
    endPlacement,
    relationships,
    animalsIndex,
    peopleIndex,
    addPerson,
    completeAdoption,
    cancelAdoption,
    recordDirectAdoption,
    returnAdoption,
    recordAdoptionReturn,
    updateAdoption
  } = useWhisker();
  const navigate = useNavigate();
  const animal = animals.find((a) => a.id === animalId);

  const [name, setName] = useState('');
  const [rescueId, setRescueId] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [species, setSpecies] = useState<string>('');
  const [speciesId, setSpeciesId] = useState<string>('');
  const [sex, setSex] = useState<Sex>('Unknown');
  const [breedId, setBreedId] = useState<string | undefined>();
  const [breedText, setBreedText] = useState<string | undefined>();
  const [birthdate, setBirthdate] = useState('');
  const [ageValue, setAgeValue] = useState('');
  const [ageUnit, setAgeUnit] = useState<AgeUnit>('months');
  const [ageMode, setAgeMode] = useState<AgeInputMode>('birthdate');
  const [ageError, setAgeError] = useState<string | undefined>();
  const [status, setStatus] = useState<AnimalStatus>('intake');
  const [priority, setPriority] = useState<Priority>('normal');
  const [isOnHold, setIsOnHold] = useState(false);
  const [behaviorConcern, setBehaviorConcern] = useState(false);
  const [medicalConcern, setMedicalConcern] = useState(false);
  const [intakeDate, setIntakeDate] = useState('');
  const [intakeSource, setIntakeSource] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [microchipNumber, setMicrochipNumber] = useState('');
  const [description, setDescription] = useState('');
  // Terminal-outcome details, shown when the status is Released / Deceased.
  const [releasedAt, setReleasedAt] = useState('');
  // Adopted-outcome details. Changing status to Adopted never just writes the
  // status: with an adoption in flight the save completes it (optionally with a
  // donation); otherwise a completed adoption record is created directly so
  // reporting and placement invariants hold (date required, adopter optional —
  // picked from contacts or created inline).
  const [adoptionDate, setAdoptionDate] = useState('');
  const [adoptionDateError, setAdoptionDateError] = useState<
    string | undefined>();
  const [adopterId, setAdopterId] = useState('');
  const [creatingAdopter, setCreatingAdopter] = useState(false);
  const [adopterFirst, setAdopterFirst] = useState('');
  const [adopterLast, setAdopterLast] = useState('');
  const [adopterEmail, setAdopterEmail] = useState('');
  const [adopterPhone, setAdopterPhone] = useState('');
  const [adopterError, setAdopterError] = useState<string | undefined>();
  const [adoptionNotes, setAdoptionNotes] = useState('');
  const [donation, setDonation] = useState('');
  // Leaving Adopted is intercepted too (the inverse of the flow above): the
  // change is either an adoption return (recorded, so history and reports stay
  // accurate) or a correction of a mistaken status — never a silent edit.
  const [leaveMode, setLeaveMode] = useState<'return' | 'mistake'>('return');
  const [returnDate, setReturnDate] = useState('');
  const [returnReason, setReturnReason] = useState<AdoptionReturnReason | ''>(
    ''
  );
  const [returnNotes, setReturnNotes] = useState('');
  const [returnAdopterId, setReturnAdopterId] = useState('');
  const [leaveError, setLeaveError] = useState<string | undefined>();
  // Adopted → Deceased: a death after adoption keeps the status Adopted (a
  // 'deceased' status would misreport a death in the rescue's care) and sets
  // known_to_be_deceased instead. A death in care means the animal came back
  // first, so that branch chains into the return/mistake panel above.
  const [deathContext, setDeathContext] = useState<'after_adoption' | 'in_care'>(
    'after_adoption'
  );
  // Hydrated flag state — lets a mistaken "(Deceased)" mark be unchecked while
  // the animal stays Adopted.
  const [keepKnownDeceased, setKeepKnownDeceased] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dateOfDeath, setDateOfDeath] = useState('');
  const [causeOfDeath, setCauseOfDeath] = useState('');
  const [deathNotes, setDeathNotes] = useState('');
  // Transferred-outcome details (moved to another rescue/shelter).
  const [transferredTo, setTransferredTo] = useState('');
  const [transferredToError, setTransferredToError] = useState<
    string | undefined>();
  const [transferredAt, setTransferredAt] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  // Returned-to-owner outcome details (owner is free text, not a contact).
  const [rtoOwnerName, setRtoOwnerName] = useState('');
  const [rtoAt, setRtoAt] = useState('');
  const [rtoNotes, setRtoNotes] = useState('');
  const [intakeDateError, setIntakeDateError] = useState<string | undefined>();
  const [reason, setReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  // Inline action item, shown when priority is elevated — lets the user capture
  // the next step in the same save (rather than a second trip to the profile).
  // Required whenever the priority is elevated.
  const [actionItemText, setActionItemText] = useState('');
  const [actionItemError, setActionItemError] = useState<string | undefined>();
  const [traitIds, setTraitIds] = useState<string[]>([]);
  // At-open trait selection (stable ordering snapshot for TraitMultiSelect).
  const [initialTraitIds, setInitialTraitIds] = useState<string[]>([]);

  // Hydrate from the animal each time the modal opens, so external updates
  // are reflected and the user always starts from the current state. We
  // preserve the original input mode: animals entered via estimated age open
  // with the age fields populated (not the derived birthdate).
  useEffect(() => {
    if (!isOpen || !animal) return;
    setName(animal.name ?? '');
    setRescueId(animal.rescue_id ?? '');
    setNameError(undefined);
    setSpecies(animal.species);
    // Prefer the stored species_id; fall back to matching the legacy name for
    // any row that predates the species_id backfill.
    setSpeciesId(
      animal.species_id ??
      speciesCatalog.find((s) => s.name === animal.species)?.id ??
      ''
    );
    setSex(animal.sex);
    setBreedId(animal.breed_id);
    setBreedText(animal.breed_text);
    const currentTraits = animalTraits.
    filter((at) => at.animal_id === animal.id).
    map((at) => at.trait_id);
    setTraitIds(currentTraits);
    setInitialTraitIds(currentTraits);
    if (animal.birthdate_source === 'estimated_age') {
      setAgeMode('age');
      setBirthdate('');
      setAgeValue(
        animal.estimated_age_value != null ?
        String(animal.estimated_age_value) :
        ''
      );
      setAgeUnit(animal.estimated_age_unit ?? 'months');
    } else if (animal.birthdate_source === 'unknown' || !animal.estimated_birth_date) {
      setAgeMode('unknown');
      setBirthdate('');
      setAgeValue('');
      setAgeUnit('months');
    } else {
      setAgeMode('birthdate');
      setBirthdate(animal.estimated_birth_date);
      setAgeValue('');
      setAgeUnit('months');
    }
    setAgeError(undefined);
    setStatus(animal.status);
    setPriority(animal.priority);
    setIsOnHold(!!animal.is_on_hold);
    setBehaviorConcern(!!animal.has_behavior_concern);
    setMedicalConcern(!!animal.has_medical_concern);
    setIntakeDate(animal.intake_date);
    setIntakeSource(animal.intake_source ?? '');
    setPhotoUrl(animal.primary_photo_url ?? '');
    setMicrochipNumber(animal.microchip_number ?? '');
    setDescription(animal.description ?? '');
    setReleasedAt(animal.released_at ?? '');
    setDateOfDeath(animal.date_of_death ?? '');
    setCauseOfDeath(animal.cause_of_death ?? '');
    setDeathNotes(animal.death_notes ?? '');
    setTransferredTo(animal.transferred_to ?? '');
    setTransferredToError(undefined);
    setTransferredAt(animal.transferred_at ?? '');
    setTransferNotes(animal.transfer_notes ?? '');
    setRtoOwnerName(animal.returned_to_owner_name ?? '');
    setRtoAt(animal.returned_to_owner_at ?? '');
    setRtoNotes(animal.returned_to_owner_notes ?? '');
    setAdoptionDate('');
    setAdoptionDateError(undefined);
    setAdopterId('');
    setCreatingAdopter(false);
    setAdopterFirst('');
    setAdopterLast('');
    setAdopterEmail('');
    setAdopterPhone('');
    setAdopterError(undefined);
    setAdoptionNotes('');
    setDonation('');
    setLeaveMode('return');
    setReturnDate('');
    setReturnReason('');
    setReturnNotes('');
    setReturnAdopterId(animal.adopted_by_id ?? '');
    setLeaveError(undefined);
    setDeathContext('after_adoption');
    setKeepKnownDeceased(!!animal.known_to_be_deceased);
    setSubmitting(false);
    setIntakeDateError(undefined);
    setReason('');
    setInternalNotes(animal.internal_notes ?? '');
    // Prefill with the current open action item so editing priority + the next
    // step happens in one place (and we update rather than collide with the
    // one-open-item-per-animal constraint).
    setActionItemText(
      actionItems.find(
        (a) => a.animal_id === animal.id && a.status === 'open'
      )?.description ?? ''
    );
    setActionItemError(undefined);
    // Snapshot from the animal at open; collections (animalTraits/speciesCatalog)
    // intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, animal]);

  // When the user switches to Released / Deceased / Adopted, pre-fill the
  // outcome date with today (only if empty — never clobber an entered date).
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (status === 'released') setReleasedAt((cur) => cur || today);
    if (status === 'deceased') setDateOfDeath((cur) => cur || today);
    if (status === 'adopted') setAdoptionDate((cur) => cur || today);
    if (status === 'transferred') setTransferredAt((cur) => cur || today);
    if (status === 'returned_to_owner') setRtoAt((cur) => cur || today);
    // Leaving Adopted: prefill the return date the same way.
    if (animal?.status === 'adopted' && status !== 'adopted') {
      setReturnDate((cur) => cur || today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!animal) return null;

  // Estimated age means the animal's *current* age. Keep an unchanged stored
  // estimate stable by reusing its original anchor; the moment the age inputs
  // change, re-anchor to today so a freshly entered age is read as "age now".
  const today = new Date().toISOString().split('T')[0];
  const origAgeValue =
  animal.birthdate_source === 'estimated_age' &&
  animal.estimated_age_value != null ?
  String(animal.estimated_age_value) :
  '';
  const origAgeUnit = animal.estimated_age_unit ?? 'months';
  const ageInputsChanged =
  ageMode === 'age' && (ageValue !== origAgeValue || ageUnit !== origAgeUnit);
  const ageAsOf = ageInputsChanged ?
  today :
  animal.estimated_age_as_of || animal.intake_date || today;

  // Adopted-status derivations. The in-flight adoption (at most one active per
  // animal) decides which panel shows; enteringAdopted gates both so editing an
  // already-adopted animal doesn't re-trigger the flow.
  const enteringAdopted = status === 'adopted' && animal.status !== 'adopted';
  const activeAdoption = enteringAdopted ?
  adoptions.find(
    (a) => adoptionCoversAnimal(a, animalId) && isActiveAdoption(a)
  ) :
  undefined;
  const activeAdopter = activeAdoption?.adopter_id ?
  peopleIndex.find((p) => p.id === activeAdoption.adopter_id) :
  undefined;
  // Directory contacts only (account self-records hidden, like Contacts).
  const adopterCandidates = peopleIndex.filter((p) => !p.user_id);

  // Adopted → Deceased: default to the after-adoption reading (the common
  // reason staff record this) — status stays Adopted and only the
  // known_to_be_deceased flag is set, so no return/mistake question applies.
  const adoptedToDeceased =
  animal.status === 'adopted' && status === 'deceased';
  const afterAdoptionDeath =
  adoptedToDeceased && deathContext === 'after_adoption';
  // The status actually saved — an after-adoption death never leaves Adopted.
  const effectiveStatus: AnimalStatus = afterAdoptionDeath ? 'adopted' : status;

  // Leaving Adopted (the inverse): the most recent completed adoption is the
  // one a return reverses / a mistake-correction cancels. Sort mirrors
  // AdoptionReturnModal. An after-adoption death isn't a departure.
  const leavingAdopted =
  animal.status === 'adopted' && status !== 'adopted' && !afterAdoptionDeath;
  const returnableAdoption = leavingAdopted ?
  adoptions.
  filter(
    (a) => adoptionCoversAnimal(a, animalId) && a.status === 'completed'
  ).
  sort((a, b) =>
  (b.completed_at ?? b.created_at).localeCompare(
    a.completed_at ?? a.created_at
  )
  )[0] :
  undefined;
  const adoptedBy = animal.adopted_by_id ?
  peopleIndex.find((p) => p.id === animal.adopted_by_id) :
  undefined;

  // Bonded pairs are adopted together, so becoming Adoptable syncs the
  // partner (still-in-care, not-yet-adoptable partners only), and a direct
  // adoption includes the partner on the same record. Pre-adoption
  // operational statuses (intake/medical/etc.) stay independent.
  const bondedPartners = bondedPartnerIds(animalId, relationships).
  map((id) => animalsIndex.find((a) => a.id === id)).
  filter((a): a is NonNullable<typeof a> => !!a);
  const enteringAdoptable =
  status === 'adoptable' && animal.status !== 'adoptable';
  const partnersToMakeAdoptable = enteringAdoptable ?
  bondedPartners.filter(
    (p) => p.status !== 'adoptable' && isInCare(p.status)
  ) :
  [];
  const partnersForDirectAdoption =
  enteringAdopted && !activeAdoption ?
  bondedPartners.filter((p) => p.status !== 'adopted') :
  [];
  // The inverse of the adoptable sync: leaving Adoptable for another in-care
  // status pulls the adoptable partner off the market too — a bonded pair
  // can't be half-available. (Terminal outcomes are individual and don't
  // cascade; a death is handled below instead.)
  const leavingAdoptableInCare =
  animal.status === 'adoptable' && isInCare(status) && status !== 'adoptable';
  const partnersToPullFromAdoptable = leavingAdoptableInCare ?
  bondedPartners.filter((p) => p.status === 'adoptable') :
  [];
  // A death cancels any in-progress application covering this animal (reason
  // 'Deceased') — the other animals on a shared record are released from hold
  // and keep their own statuses.
  const activeAdoptionForAnimal = adoptions.find(
    (a) => adoptionCoversAnimal(a, animalId) && isActiveAdoption(a)
  );
  const cancelsAdoptionOnDeath =
  effectiveStatus === 'deceased' && !!activeAdoptionForAnimal;

  // Terminal outcomes end any active foster placement — the animal has left
  // the org's care, so nobody should still show as fostering it. Adopted is
  // excluded: the adoption layer closes the placement itself (reason 'Adopted').
  const activePlacement = placements.find(
    (p) => p.animal_id === animalId && p.placement_status === 'active'
  );
  const activePlacementFoster = activePlacement ?
  peopleIndex.find((p) => p.id === activePlacement.person_id) :
  undefined;
  const endsPlacement =
  !isInCare(effectiveStatus) &&
  effectiveStatus !== 'adopted' &&
  !!activePlacement;
  // The placement's end date follows the outcome's own date (fallback: today).
  const outcomeEndDate =
  (effectiveStatus === 'released' ?
  releasedAt :
  effectiveStatus === 'deceased' ?
  dateOfDeath :
  effectiveStatus === 'transferred' ?
  transferredAt :
  effectiveStatus === 'returned_to_owner' ?
  rtoAt :
  '') || today;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // Foster-collaboration save: only the care flags, traits, and a timeline
    // note. These are exactly the columns the RLS trigger allows the assigned
    // foster to change — nothing else is sent, so nothing else can be rejected.
    if (fosterScope) {
      updateAnimal(animalId, {
        is_on_hold: isOnHold,
        has_behavior_concern: behaviorConcern,
        has_medical_concern: medicalConcern
      });
      setAnimalTraits(animalId, traitIds);
      if (reason.trim()) {
        const flagChanges: string[] = [];
        const flagDiff = (
        label: string,
        next: boolean,
        prev: boolean | undefined) =>
        {
          if (next !== !!prev)
          flagChanges.push(`${label}: ${next ? 'on' : 'off'}`);
        };
        flagDiff('on hold', isOnHold, animal.is_on_hold);
        flagDiff('behavior concern', behaviorConcern, animal.has_behavior_concern);
        flagDiff('medical concern', medicalConcern, animal.has_medical_concern);
        const body =
        flagChanges.length > 0 ?
        `${flagChanges.join(', ')}. Note: ${reason.trim()}` :
        reason.trim();
        addNote({
          animal_id: animalId,
          author_name: 'Current User',
          note_type: 'general',
          body
        });
      }
      onClose();
      return;
    }
    // Validation runs top-to-bottom and stops at the first failure; scroll that
    // field into view so the block isn't invisible when it's below the fold.
    if (!name.trim() && !rescueId.trim()) {
      setNameError('Animals must have either a Name or Rescue ID.');
      requestAnimationFrame(() => focusFirstError(['edit_name']));
      return;
    }
    const ageInfo = deriveAgeInfo({
      birthdate: ageMode === 'birthdate' ? birthdate : '',
      ageValue: ageMode === 'age' ? ageValue : '',
      ageUnit,
      asOf: ageAsOf,
      unknown: ageMode === 'unknown'
    });
    if (!ageInfo.valid) {
      setAgeError('Enter a birthdate or an estimated age.');
      const ageId =
      ageMode === 'age' ? 'estimated_age_value' : 'estimated_birthdate';
      requestAnimationFrame(() => focusFirstError([ageId]));
      return;
    }
    if (!intakeDate) {
      setIntakeDateError('Intake date is required.');
      requestAnimationFrame(() => focusFirstError(['edit_intake_date']));
      return;
    }
    // Recording an adoption directly needs a date; an inline new adopter needs
    // at least a first and last name (all fields blank = no adopter on record).
    const wantsNewAdopter =
    creatingAdopter &&
    Boolean(
      adopterFirst.trim() ||
      adopterLast.trim() ||
      adopterEmail.trim() ||
      adopterPhone.trim()
    );
    // A transfer must say where the animal went.
    if (status === 'transferred' && !transferredTo.trim()) {
      setTransferredToError('Enter where the animal was transferred to.');
      requestAnimationFrame(() => focusFirstError(['edit_transferred_to']));
      return;
    }
    if (enteringAdopted && !activeAdoption) {
      if (!adoptionDate) {
        setAdoptionDateError('Adoption date is required.');
        requestAnimationFrame(() => focusFirstError(['edit_adoption_date']));
        return;
      }
      if (wantsNewAdopter && (!adopterFirst.trim() || !adopterLast.trim())) {
        setAdopterError(
          'First and last name are required to add the adopter as a contact.'
        );
        requestAnimationFrame(() => focusFirstError(['edit_adopter_first']));
        return;
      }
    }
    // Leaving Adopted as a return needs the return details (and the original
    // adopter when there's no adoption record to flip).
    if (leavingAdopted && leaveMode === 'return') {
      if (!returnDate) {
        setLeaveError('A return date is required.');
        requestAnimationFrame(() => focusFirstError(['edit_return_date']));
        return;
      }
      if (!returnReason) {
        setLeaveError('A return reason is required.');
        requestAnimationFrame(() => focusFirstError(['edit_return_reason']));
        return;
      }
      if (!returnableAdoption && !returnAdopterId) {
        setLeaveError('Select the original adopter.');
        requestAnimationFrame(() => focusFirstError(['edit_return_adopter']));
        return;
      }
    }
    // An elevated priority must carry a next step, so the Action Needed banner
    // and dashboard never show "no active action item".
    if (priority !== 'normal' && !actionItemText.trim()) {
      setActionItemError('Add an action item for a non-normal priority.');
      requestAnimationFrame(() => focusFirstError(['edit_action_item']));
      return;
    }
    const changes: string[] = [];
    if (effectiveStatus !== animal.status)
    changes.push(`status: ${animal.status} → ${effectiveStatus}`);
    if (afterAdoptionDeath && !animal.known_to_be_deceased)
    changes.push('deceased after adoption');
    if (priority !== animal.priority)
    changes.push(`priority: ${animal.priority} → ${priority}`);
    const flagChange = (
    label: string,
    next: boolean,
    prev: boolean | undefined) =>
    {
      if (next !== !!prev) changes.push(`${label}: ${next ? 'on' : 'off'}`);
    };
    flagChange('on hold', isOnHold, animal.is_on_hold);
    flagChange('behavior concern', behaviorConcern, animal.has_behavior_concern);
    flagChange('medical concern', medicalConcern, animal.has_medical_concern);

    // Outcome fields only apply to their status — write just the relevant ones so
    // a status change doesn't clobber the others ('' → null via animalUpdateToRow).
    // Keyed on the SELECTED status: an after-adoption death saves status
    // 'adopted' but still records the death details.
    const outcomeFields =
    status === 'released' ?
    { released_at: releasedAt } :
    status === 'deceased' ?
    {
      date_of_death: dateOfDeath,
      cause_of_death: causeOfDeath.trim(),
      death_notes: deathNotes.trim()
    } :
    status === 'transferred' ?
    {
      transferred_to: transferredTo.trim(),
      transferred_at: transferredAt,
      transfer_notes: transferNotes.trim()
    } :
    status === 'returned_to_owner' ?
    {
      returned_to_owner_name: rtoOwnerName.trim(),
      returned_to_owner_at: rtoAt,
      returned_to_owner_notes: rtoNotes.trim()
    } :
    {};

    const animalUpdates = {
      ...outcomeFields,
      name: name.trim() || undefined,
      rescue_id: rescueId.trim() || undefined,
      species,
      species_id: speciesId || undefined,
      sex,
      breed_id: breedId,
      breed_text: breedText,
      estimated_birth_date: ageInfo.estimated_birth_date,
      birthdate_source: ageInfo.birthdate_source,
      estimated_age_value: ageInfo.estimated_age_value,
      estimated_age_unit: ageInfo.estimated_age_unit,
      estimated_age_as_of: ageInfo.estimated_age_as_of,
      status: effectiveStatus,
      // True for every death — in care (status conveys it) or after adoption
      // (status stays adopted; the profile shows "(Deceased)"). The hydrated
      // checkbox lets a mistaken after-adoption mark be cleared.
      known_to_be_deceased:
      effectiveStatus === 'deceased' || afterAdoptionDeath ?
      true :
      effectiveStatus === 'adopted' ?
      keepKnownDeceased :
      false,
      priority,
      is_on_hold: isOnHold,
      has_behavior_concern: behaviorConcern,
      has_medical_concern: medicalConcern,
      intake_date: intakeDate,
      intake_source: intakeSource.trim(),
      primary_photo_url: photoUrl.trim() || undefined,
      microchip_number: microchipNumber.trim() || undefined,
      description: description.trim(),
      internal_notes: internalNotes.trim() || undefined
    };
    // Correcting a mistaken Adopted status drops the stale adopter stamps in
    // the same write. (Return-path clears happen inside returnAdoption.)
    if (leavingAdopted && leaveMode === 'mistake') {
      (animalUpdates as Record<string, unknown>).adopted_by_id = null;
      (animalUpdates as Record<string, unknown>).adopted_at = null;
    }
    updateAnimal(animalId, animalUpdates);
    track('animal_status_changed', {
      animal_id: animalId,
      new_status: effectiveStatus,
      new_priority: priority
    });
    // Bonded-pair sync: the partner becomes Adoptable in the same save (the
    // pair goes on the market together)…
    for (const p of partnersToMakeAdoptable) {
      updateAnimal(p.id, { status: 'adoptable' });
    }
    // …and comes off the market together when this animal leaves Adoptable
    // for another in-care status.
    for (const p of partnersToPullFromAdoptable) {
      updateAnimal(p.id, { status: 'in_care' });
    }
    // A death closes any in-progress application (after the animal write, so
    // the hold-lift lands last). Other animals on the record are released.
    if (cancelsAdoptionOnDeath && activeAdoptionForAnimal) {
      cancelAdoption(activeAdoptionForAnimal.id, 'cancelled', 'deceased');
      track('adoption_cancelled', {
        animal_id: animalId,
        status: 'cancelled',
        reason: 'deceased'
      });
    }
    // Close the active foster placement on a terminal outcome, stamping the
    // outcome as the end reason (mirrors the adoption layer's 'Adopted' close).
    if (endsPlacement) {
      endPlacement(
        animalId,
        outcomeEndDate,
        STATUS_LABELS[effectiveStatus]
      );
      track('placement_ended', { animal_id: animalId });
    }
    if (afterAdoptionDeath) {
      track('deceased_after_adoption_recorded', { animal_id: animalId });
    }

    // Becoming Adopted goes through the adoption layer too, so the record,
    // adopter stamps, and placement close-out stay consistent (see the panels
    // in Status & Priority). The plain status write above is harmless — the
    // adoption action re-writes it along with the stamps.
    if (enteringAdopted) {
      if (activeAdoption) {
        const parsed = donation.trim() === '' ? undefined : Number(donation);
        completeAdoption(
          activeAdoption.id,
          parsed != null && !isNaN(parsed) ? parsed : undefined
        );
        track('adoption_completed', { animal_id: animalId });
      } else {
        setSubmitting(true);
        let finalAdopterId: string | undefined = adopterId || undefined;
        if (wantsNewAdopter) {
          const created = await addPerson({
            first_name: adopterFirst.trim(),
            last_name: adopterLast.trim(),
            email: adopterEmail.trim(),
            phone: adopterPhone.trim() || undefined,
            roles: ['adopter'],
            role: legacyRoleFor(['adopter']),
            active: true
          });
          if (created) finalAdopterId = created.id;
        }
        await recordDirectAdoption({
          animal_id: animalId,
          adopter_id: finalAdopterId,
          adopted_on: adoptionDate,
          notes: adoptionNotes.trim() || undefined,
          additional_animal_ids: partnersForDirectAdoption.map((p) => p.id)
        });
        track('adoption_recorded_direct', {
          animal_id: animalId,
          has_adopter: !!finalAdopterId
        });
      }
    }

    // Leaving Adopted goes through the adoption layer as well: a return flips
    // the record and re-enters care at the chosen status; a mistake cancels the
    // record (completed_at cleared, so it leaves every "completed" metric) and
    // the stamp clears above already handled the animal side.
    if (leavingAdopted) {
      if (leaveMode === 'return') {
        if (returnableAdoption) {
          returnAdoption(returnableAdoption.id, {
            returned_at: returnDate,
            return_reason: returnReason as AdoptionReturnReason,
            return_notes: returnNotes.trim() || undefined,
            new_status: status
          });
        } else {
          setSubmitting(true);
          await recordAdoptionReturn({
            animal_id: animalId,
            adopter_id: returnAdopterId,
            returned_at: returnDate,
            return_reason: returnReason as AdoptionReturnReason,
            return_notes: returnNotes.trim() || undefined,
            new_status: status
          });
        }
        track('adoption_returned', { animal_id: animalId });
      } else if (returnableAdoption) {
        updateAdoption(returnableAdoption.id, {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          completed_at: undefined,
          notes: [
          returnableAdoption.notes,
          'Marked adopted by mistake; status corrected.'].
          filter(Boolean).
          join(' — ')
        });
        track('adoption_cancelled', { animal_id: animalId });
      }
    }

    setAnimalTraits(animalId, traitIds);

    // Inline action item: only when the priority is elevated. Update the existing
    // open item if there is one (one-open-item-per-animal), else create it. Its
    // priority tracks the animal's chosen elevated priority.
    if (priority !== 'normal') {
      const openItem = actionItems.find(
        (a) => a.animal_id === animalId && a.status === 'open'
      );
      const text = actionItemText.trim();
      if (openItem) {
        if (
          text &&
          (text !== openItem.description || priority !== openItem.priority))
        {
          updateActionItem(openItem.id, { description: text, priority });
        }
      } else if (text) {
        addActionItem({ animal_id: animalId, description: text, priority });
      }
    }

    // A filled timeline note always logs; field changes are prepended for context.
    if (reason.trim()) {
      const body =
      changes.length > 0 ?
      `${changes.join(', ')}. Note: ${reason.trim()}` :
      reason.trim();
      addNote({
        animal_id: animalId,
        author_name: 'Current User',
        note_type: 'general',
        body
      });
    }
    onClose();
  };

  const handleDelete = () => setConfirmDelete(true);
  const performDelete = () => {
    deleteAnimal(animalId);
    setConfirmDelete(false);
    onClose();
    navigate('/animals');
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${fosterScope ? 'Update care for' : 'Edit'} ${animalDisplayName(animal)}`}
      size="lg"
      footer={
      <div className="flex items-center justify-between gap-3">
          {fosterScope ?
          <span /> :
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            className="text-[#9B3A3A] hover:bg-[#F5D7D7]/60 hover:text-[#9B3A3A]">
            Delete
          </Button>
          }
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="edit-animal-form" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      }>

      <form id="edit-animal-form" onSubmit={handleSubmit} className="space-y-4">
        {fosterScope &&
        <p className="text-sm text-text-secondary bg-background border border-border rounded-xl px-4 py-3">
          As this animal's foster you can update its care considerations, traits,
          and add a timeline note. Reach out to a coordinator for other changes.
        </p>
        }

        {/* Manager-only fields — hidden in foster-collaboration mode. */}
        {!fosterScope &&
        <>
        {/* Basic Information */}
        <FormSection title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_name">Name</Label>
              <Input
                id="edit_name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(undefined);
                }}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'edit_name_error' : undefined}
                className={nameError && 'border-red-500 focus:ring-red-500'}
                placeholder="e.g. Biscuit" />

              <FieldError id="edit_name_error">{nameError}</FieldError>
            </div>
            <div>
              <Label htmlFor="edit_rescue_id">Rescue ID</Label>
              <Input
                id="edit_rescue_id"
                value={rescueId}
                onChange={(e) => {
                  setRescueId(e.target.value);
                  if (nameError) setNameError(undefined);
                }}
                aria-invalid={Boolean(nameError)}
                className={
                nameError ?
                'border-red-500 focus:ring-red-500 font-mono' :
                'font-mono'
                }
                placeholder="e.g. DanBH-1" />

            </div>
          </div>
          <p className="text-xs text-text-secondary -mt-2">
            Either a Name or a Rescue ID is required.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_species" required>Species</Label>
              <Select
                id="edit_species"
                value={speciesId}
                onChange={(e) => {
                  const next = speciesCatalog.find((s) => s.id === e.target.value);
                  setSpeciesId(next?.id ?? '');
                  setSpecies(next?.name ?? '');
                  // Species changed → clear the now-mismatched breed.
                  setBreedId(undefined);
                  setBreedText(undefined);
                }}>

                {(() => {
                  // Org-enabled species, plus the animal's current species even
                  // if it's since been disabled (so editing never drops it).
                  const enabled = enabledSpeciesList(speciesCatalog, organizationSpecies);
                  const cur = speciesCatalog.find((s) => s.id === speciesId);
                  const opts =
                  cur && !enabled.some((s) => s.id === cur.id) ?
                  [cur, ...enabled] :
                  enabled;
                  return opts.map((s) =>
                  <option key={s.id} value={s.id}>{s.name}</option>
                  );
                })()}
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_sex" required>Sex</Label>
              <Select
                id="edit_sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex)}>

                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unknown">Unknown</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="edit_breed">
              {breedFieldLabel(
                speciesCatalog.find((s) => s.id === speciesId)?.slug
              )}
            </Label>
            <BreedCombobox
              id="edit_breed"
              speciesId={speciesId}
              breedId={breedId}
              breedText={breedText}
              onChange={(next) => {
                setBreedId(next.breed_id);
                setBreedText(next.breed_text);
              }} />

          </div>
          {/* Photo URL field — temporarily hidden in favour of the hero
              upload flow. Keep the state hydrated so the field can be
              uncommented later without rebuilding the wiring. */}
          {/*
          <div>
            <Label htmlFor="edit_photo">Photo URL (optional)</Label>
            <Input
              id="edit_photo"
              type="url"
              value={photoUrl}
              onChange={(e) => {
                setPhotoUrl(e.target.value);
                setPhotoError(undefined);
              }}
              className={photoError && 'border-red-500 focus:ring-red-500'}
              placeholder="https://..." />

            <FieldError>{photoError}</FieldError>
          </div>
          */}
          <div>
            <Label htmlFor="edit_microchip">Microchip Number</Label>
            <Input
              id="edit_microchip"
              value={microchipNumber}
              onChange={(e) => setMicrochipNumber(e.target.value)}
              placeholder="e.g. 985112345678901" />

            <p className="mt-1 text-xs text-text-secondary">
              Optional. The readiness checklist will mark Microchipped once a
              chip number is on file.
            </p>
          </div>
        </FormSection>

        {/* Status & Priority */}
        <FormSection title="Status & Priority">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_status" required>Status</Label>
              <Select
                id="edit_status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AnimalStatus)}>

                {/* Grouped: outcomes are business events, not just statuses —
                    picking one reveals its inline outcome flow below. */}
                <optgroup label="In care">
                  <option value="intake">Intake</option>
                  <option value="in_care">In Care</option>
                  <option value="adoptable">Adoptable</option>
                  <option value="hospice">Hospice</option>
                </optgroup>
                <optgroup label="Outcomes">
                  <option value="adopted">Adopted</option>
                  <option value="released">Released</option>
                  <option value="transferred">Transferred</option>
                  <option value="returned_to_owner">Returned to Owner</option>
                  <option value="deceased">Deceased</option>
                </optgroup>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_priority" required>Priority</Label>
              <Select
                id="edit_priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}>

                <option value="normal">Normal</option>
                <option value="needs_attention">Needs Attention</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>
          {/* Bonded pairs go on the market together — say so before saving,
              not after. */}
          {partnersToMakeAdoptable.length > 0 &&
          <div className="p-4 rounded-xl bg-[#F3E4D7]/50 border border-[#EAD3BC] text-sm space-y-1.5">
              <p className="font-medium text-text-primary">
                {animalDisplayName(animal)} is bonded with{' '}
                {partnersToMakeAdoptable.
              map((p) => animalDisplayName(p)).
              join(' & ')}
                .
              </p>
              <p className="text-text-secondary leading-relaxed">
                Bonded pairs are adopted together. Saving will also mark{' '}
                {partnersToMakeAdoptable.
              map((p) => animalDisplayName(p)).
              join(' & ')}{' '}
                as Adoptable. To manage them separately, remove the Bonded
                Pair relationship first.
              </p>
            </div>
          }
          {/* The inverse: leaving Adoptable pulls the bonded partner off the
              market too. */}
          {partnersToPullFromAdoptable.length > 0 &&
          <div className="p-4 rounded-xl bg-[#F3E4D7]/50 border border-[#EAD3BC] text-sm space-y-1.5">
              <p className="font-medium text-text-primary">
                {animalDisplayName(animal)} is bonded with{' '}
                {partnersToPullFromAdoptable.
              map((p) => animalDisplayName(p)).
              join(' & ')}
                .
              </p>
              <p className="text-text-secondary leading-relaxed">
                Bonded pairs come off the adoption market together. Saving
                will also move{' '}
                {partnersToPullFromAdoptable.
              map((p) => animalDisplayName(p)).
              join(' & ')}{' '}
                to In Care.
              </p>
            </div>
          }
          {/* A death closes the in-progress application — never silently. */}
          {cancelsAdoptionOnDeath && activeAdoptionForAnimal &&
          <div className="p-4 rounded-xl bg-[#F5D7D7]/40 border border-[#EBC5C5] text-sm space-y-1.5">
              <p className="font-medium text-text-primary">
                {animalDisplayName(animal)} has an adoption in progress.
              </p>
              <p className="text-text-secondary leading-relaxed">
                Saving will close the application as Cancelled (reason:
                Deceased)
                {(activeAdoptionForAnimal.animal_ids?.length ?? 1) > 1 ?
              ' — the other animals on the application are released from hold and keep their own statuses.' :
              '.'}
              </p>
            </div>
          }
          {/* A terminal outcome ends the active foster placement in the same
              save — say so up front rather than closing it silently. */}
          {endsPlacement &&
          <p className="text-xs text-text-secondary bg-background border border-border rounded-xl px-4 py-3">
              {animalDisplayName(animal)} is currently in foster
              {activePlacementFoster ?
            ` with ${activePlacementFoster.first_name} ${activePlacementFoster.last_name}` :
            ''}
              . Saving ends that placement (reason:{' '}
              {STATUS_LABELS[effectiveStatus]}) — it stays in the animal's
              history.
            </p>
          }
          {/* Outcome details — captured here so a status change records the
              relevant date/context in the same save. Surfaced in the profile's
              Release Summary / Case Summary. */}
          {/* An adopted animal marked as known-deceased stays Adopted; this
              hydrated checkbox is the escape hatch for a mistaken mark. */}
          {status === 'adopted' && !!animal.known_to_be_deceased &&
          <ConcernCheckbox
            label="Known to be deceased (after adoption)"
            checked={keepKnownDeceased}
            onChange={setKeepKnownDeceased}
            help='Shown as "Adopted (Deceased)" on the profile. Uncheck only if this was recorded in error.' />
          }
          {status === 'released' &&
          <div>
              <Label htmlFor="edit_released_at">Release date</Label>
              <DatePicker
              id="edit_released_at"
              value={releasedAt}
              onChange={setReleasedAt} />
            </div>
          }
          {status === 'transferred' &&
          <div className="space-y-4">
              <div>
                <Label htmlFor="edit_transferred_to" required>
                  Transferred to
                </Label>
                <Input
                id="edit_transferred_to"
                value={transferredTo}
                onChange={(e) => {
                  setTransferredTo(e.target.value);
                  if (transferredToError) setTransferredToError(undefined);
                }}
                aria-invalid={Boolean(transferredToError)}
                className={
                transferredToError && 'border-red-500 focus:ring-red-500'
                }
                placeholder="e.g. Seattle Humane" />
                <FieldError>{transferredToError}</FieldError>
              </div>
              <div>
                <Label htmlFor="edit_transferred_at">Transfer date</Label>
                <DatePicker
                id="edit_transferred_at"
                value={transferredAt}
                onChange={setTransferredAt} />
              </div>
              <div>
                <Label htmlFor="edit_transfer_notes">Transfer notes</Label>
                <Textarea
                id="edit_transfer_notes"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="Destination contact, paperwork, context (optional)."
                rows={2} />
              </div>
            </div>
          }
          {status === 'returned_to_owner' &&
          <div className="space-y-4">
              <div>
                <Label htmlFor="edit_rto_owner_name">Owner name</Label>
                <Input
                id="edit_rto_owner_name"
                value={rtoOwnerName}
                onChange={(e) => setRtoOwnerName(e.target.value)}
                placeholder="e.g. Maria Lopez" />
                <p className="mt-1 text-xs text-text-secondary">
                  Optional free text — the owner doesn't need to be added as a
                  contact.
                </p>
              </div>
              <div>
                <Label htmlFor="edit_rto_at">Return date</Label>
                <DatePicker
                id="edit_rto_at"
                value={rtoAt}
                onChange={setRtoAt} />
              </div>
              <div>
                <Label htmlFor="edit_rto_notes">Notes</Label>
                <Textarea
                id="edit_rto_notes"
                value={rtoNotes}
                onChange={(e) => setRtoNotes(e.target.value)}
                placeholder="How the owner was identified, condition, context (optional)."
                rows={2} />
              </div>
            </div>
          }
          {/* Adopted → Deceased: where the death happened decides everything.
              After adoption keeps the status Adopted + sets the flag; in care
              chains into the return/mistake panel below. */}
          {adoptedToDeceased &&
          <div className="space-y-3 p-4 rounded-xl bg-background border border-border">
              <p className="text-sm text-text-primary">
                <span className="font-medium">
                  {animalDisplayName(animal)} has been adopted.
                </span>{' '}
                Where did they pass away?
              </p>
              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 text-sm text-text-primary cursor-pointer">
                  <input
                  type="radio"
                  name="death_context"
                  checked={deathContext === 'after_adoption'}
                  onChange={() => setDeathContext('after_adoption')}
                  className="w-4 h-4 mt-0.5 text-primary focus:ring-primary" />
                  <span>
                    <span className="font-medium">
                      After adoption, in their new home
                    </span>{' '}
                    — the status stays Adopted; the profile shows "Adopted
                    (Deceased)" so no one follows up.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-sm text-text-primary cursor-pointer">
                  <input
                  type="radio"
                  name="death_context"
                  checked={deathContext === 'in_care'}
                  onChange={() => setDeathContext('in_care')}
                  className="w-4 h-4 mt-0.5 text-primary focus:ring-primary" />
                  <span>
                    <span className="font-medium">While in rescue care</span> —
                    the status becomes Deceased; record how{' '}
                    {animalDisplayName(animal)} came back into care below.
                  </span>
                </label>
              </div>
            </div>
          }
          {status === 'deceased' &&
          <div className="space-y-4">
              <div>
                <Label htmlFor="edit_date_of_death">Date of death</Label>
                <DatePicker
                id="edit_date_of_death"
                value={dateOfDeath}
                onChange={setDateOfDeath} />
              </div>
              <div>
                <Label htmlFor="edit_cause_of_death">Cause of death</Label>
                <Input
                id="edit_cause_of_death"
                value={causeOfDeath}
                onChange={(e) => setCauseOfDeath(e.target.value)}
                placeholder="e.g. Euthanized (illness), FeLV, trauma…" />
              </div>
              <div>
                <Label htmlFor="edit_death_notes">Death notes</Label>
                <Textarea
                id="edit_death_notes"
                value={deathNotes}
                onChange={(e) => setDeathNotes(e.target.value)}
                placeholder="Any additional context (optional)."
                rows={2} />
              </div>
            </div>
          }
          {/* Becoming Adopted — never just a status write. With an adoption in
              flight, saving completes it; otherwise the adoption is recorded
              directly (date + optional adopter) so reports and placements stay
              consistent. Mirrors the Released/Deceased inline-outcome pattern. */}
          {enteringAdopted && activeAdoption &&
          <div className="space-y-3 p-4 rounded-xl bg-background border border-border">
              <p className="text-sm text-text-primary">
                <span className="font-medium">
                  {animalDisplayName(animal)} has an adoption in progress
                </span>{' '}
                with{' '}
                <span className="font-medium">
                  {activeAdopter ?
                `${activeAdopter.first_name} ${activeAdopter.last_name}` :
                'an adopter'}
                </span>{' '}
                ({ADOPTION_STATUS_LABELS[activeAdoption.status]}).
              </p>
              <p className="text-xs text-text-secondary">
                Saving will complete that adoption — the adopter is recorded on
                the profile and any active foster placement is closed.
              </p>
              <div>
                <Label htmlFor="edit_adoption_donation">
                  Donation Amount (optional)
                </Label>
                <Input
                id="edit_adoption_donation"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={donation}
                onChange={(e) => setDonation(e.target.value)}
                placeholder="e.g. 75.00" />
              </div>
            </div>
          }
          {enteringAdopted && !activeAdoption &&
          <div className="space-y-4 p-4 rounded-xl bg-background border border-border">
              <div>
                <Label htmlFor="edit_adoption_date" required>Adoption date</Label>
                <DatePicker
                id="edit_adoption_date"
                required
                value={adoptionDate}
                error={Boolean(adoptionDateError)}
                onChange={(v) => {
                  setAdoptionDate(v);
                  if (adoptionDateError) setAdoptionDateError(undefined);
                }} />
                <FieldError>{adoptionDateError}</FieldError>
              </div>
              <div>
                <Label>Adopter (optional)</Label>
                {creatingAdopter ?
              <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_adopter_first" required>
                          First Name
                        </Label>
                        <Input
                      id="edit_adopter_first"
                      value={adopterFirst}
                      onChange={(e) => {
                        setAdopterFirst(e.target.value);
                        if (adopterError) setAdopterError(undefined);
                      }}
                      aria-invalid={Boolean(adopterError)} />
                      </div>
                      <div>
                        <Label htmlFor="edit_adopter_last" required>
                          Last Name
                        </Label>
                        <Input
                      id="edit_adopter_last"
                      value={adopterLast}
                      onChange={(e) => {
                        setAdopterLast(e.target.value);
                        if (adopterError) setAdopterError(undefined);
                      }}
                      aria-invalid={Boolean(adopterError)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_adopter_email">Email</Label>
                        <Input
                      id="edit_adopter_email"
                      type="email"
                      value={adopterEmail}
                      onChange={(e) => setAdopterEmail(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="edit_adopter_phone">Phone</Label>
                        <Input
                      id="edit_adopter_phone"
                      value={adopterPhone}
                      onChange={(e) => setAdopterPhone(e.target.value)} />
                      </div>
                    </div>
                    <FieldError>{adopterError}</FieldError>
                    <button
                  type="button"
                  onClick={() => {
                    setCreatingAdopter(false);
                    setAdopterFirst('');
                    setAdopterLast('');
                    setAdopterEmail('');
                    setAdopterPhone('');
                    setAdopterError(undefined);
                  }}
                  className="text-xs font-medium text-primary hover:underline">
                      Search existing contacts instead
                    </button>
                  </div> :

              <PersonSearchPicker
                id="edit_adopter_picker"
                people={adopterCandidates}
                value={adopterId}
                onChange={setAdopterId}
                placeholder="Search contacts by name or email…"
                onCreateNew={() => {
                  setCreatingAdopter(true);
                  setAdopterId('');
                }} />
              }
              </div>
              <div>
                <Label htmlFor="edit_adoption_notes">
                  Adoption notes (optional)
                </Label>
                <Textarea
                id="edit_adoption_notes"
                value={adoptionNotes}
                onChange={(e) => setAdoptionNotes(e.target.value)}
                placeholder="Anything worth keeping on the adoption record…"
                rows={2} />
              </div>
              {partnersForDirectAdoption.length > 0 &&
            <p className="text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">
                    Bonded pair:
                  </span>{' '}
                  {partnersForDirectAdoption.
              map((p) => animalDisplayName(p)).
              join(' & ')}{' '}
                  will be recorded as adopted on the same record.
                </p>
            }
              <p className="text-xs text-text-secondary">
                This records a completed adoption directly, so it's included in
                reports. For new adoptions, prefer Start Adoption on the
                Adoption tab so the application is tracked.
              </p>
            </div>
          }
          {/* The inverse: leaving Adopted is either a return (recorded, so
              history and reports stay accurate) or a mistaken status being
              corrected — never a silent edit. */}
          {leavingAdopted &&
          <div className="space-y-4 p-4 rounded-xl bg-background border border-border">
              <p className="text-sm text-text-primary">
                <span className="font-medium">
                  {animalDisplayName(animal)} is recorded as adopted
                  {adoptedBy ?
                ` by ${adoptedBy.first_name} ${adoptedBy.last_name}` :
                ''}.
                </span>{' '}
                What does this status change reflect?
              </p>
              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 text-sm text-text-primary cursor-pointer">
                  <input
                  type="radio"
                  name="leave_adopted_mode"
                  checked={leaveMode === 'return'}
                  onChange={() => {
                    setLeaveMode('return');
                    setLeaveError(undefined);
                  }}
                  className="w-4 h-4 mt-0.5 text-primary focus:ring-primary" />
                  <span>
                    <span className="font-medium">
                      The adoption was returned
                    </span>{' '}
                    — records the return so history and reports stay accurate.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-sm text-text-primary cursor-pointer">
                  <input
                  type="radio"
                  name="leave_adopted_mode"
                  checked={leaveMode === 'mistake'}
                  onChange={() => {
                    setLeaveMode('mistake');
                    setLeaveError(undefined);
                  }}
                  className="w-4 h-4 mt-0.5 text-primary focus:ring-primary" />
                  <span>
                    <span className="font-medium">This was a mistake</span> —{' '}
                    {animalDisplayName(animal)} was never actually adopted.
                  </span>
                </label>
              </div>
              {leaveMode === 'return' ?
            <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_return_date" required>
                        Return date
                      </Label>
                      <DatePicker
                    id="edit_return_date"
                    required
                    value={returnDate}
                    onChange={(v) => {
                      setReturnDate(v);
                      setLeaveError(undefined);
                    }} />
                    </div>
                    <div>
                      <Label htmlFor="edit_return_reason" required>
                        Return reason
                      </Label>
                      <Select
                    id="edit_return_reason"
                    value={returnReason}
                    onChange={(e) => {
                      setReturnReason(
                        e.target.value as AdoptionReturnReason | ''
                      );
                      setLeaveError(undefined);
                    }}>
                        <option value="">Select a reason…</option>
                        {ADOPTION_RETURN_REASONS.map((r) =>
                    <option key={r} value={r}>
                            {ADOPTION_RETURN_REASON_LABELS[r]}
                          </option>
                    )}
                      </Select>
                    </div>
                  </div>
                  {!returnableAdoption &&
              <div id="edit_return_adopter" style={{ scrollMarginTop: '1rem' }}>
                      <Label required>Original adopter</Label>
                      <PersonSearchPicker
                  people={adopterCandidates}
                  value={returnAdopterId}
                  onChange={(id) => {
                    setReturnAdopterId(id);
                    setLeaveError(undefined);
                  }}
                  placeholder="Search contacts by name or email…" />
                      <p className="mt-1 text-xs text-text-secondary">
                        No adoption record is on file, so the return is recorded
                        against the original adopter.
                      </p>
                    </div>
              }
                  <div>
                    <Label htmlFor="edit_return_notes">
                      Return notes (optional)
                    </Label>
                    <Textarea
                  id="edit_return_notes"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Context on the return — condition, circumstances…"
                  rows={2} />
                  </div>
                </div> :

            <p className="text-xs text-status-medical-text">
                  This removes the adopted status without recording a return
                  {returnableAdoption ?
              '; the adoption record is marked cancelled (it can be archived from the timeline)' :
              ''}
                  . Only use this if the status was set in error.
                </p>
            }
              <FieldError>{leaveError}</FieldError>
            </div>
          }
          {/* Inline action item — appears once the priority is elevated so the
              "what's the next step" can be captured in the same save. Required
              for a non-normal priority. */}
          {priority !== 'normal' &&
          <div>
            <Label htmlFor="edit_action_item" required>Action Item</Label>
            <Textarea
              id="edit_action_item"
              value={actionItemText}
              onChange={(e) => {
                setActionItemText(e.target.value);
                if (actionItemError) setActionItemError(undefined);
              }}
              aria-invalid={Boolean(actionItemError)}
              className={actionItemError ? 'border-red-500 focus:ring-red-500' : undefined}
              placeholder="What's the next step? Be specific — what, when, who."
              rows={2} />

            <FieldError>{actionItemError}</FieldError>
            <p className="text-xs text-text-secondary mt-1">
              Shown in the Action Needed banner and the dashboard's Needs Action list.
            </p>
          </div>
          }
        </FormSection>

        {/* Age & Intake */}
        <FormSection title="Age & Intake">
          <AgeInformationFields
            birthdate={birthdate}
            ageValue={ageValue}
            ageUnit={ageUnit}
            asOfDate={ageAsOf}
            mode={ageMode}
            onModeChange={setAgeMode}
            onBirthdate={(v) => {
              setBirthdate(v);
              setAgeError(undefined);
            }}
            onAgeValue={(v) => {
              setAgeValue(v);
              setAgeError(undefined);
            }}
            onAgeUnit={setAgeUnit}
            error={ageError} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_intake_date" required>Intake Date</Label>
              <DatePicker
                id="edit_intake_date"
                required
                error={Boolean(intakeDateError)}
                value={intakeDate}
                onChange={(v) => {
                  setIntakeDate(v);
                  setIntakeDateError(undefined);
                }} />

              <FieldError>{intakeDateError}</FieldError>
            </div>
            <div>
              <Label htmlFor="edit_intake_source">Intake Source</Label>
              <Input
                id="edit_intake_source"
                value={intakeSource}
                onChange={(e) => setIntakeSource(e.target.value)}
                placeholder="e.g. City Shelter Transfer" />

            </div>
          </div>
        </FormSection>
        </>
        }

        {/* Care Considerations */}
        <FormSection title="Care Considerations">
          <div className="space-y-5">
            <div>
              <h4 className="text-xs uppercase tracking-wider font-semibold text-text-secondary mb-3">
                Operational
              </h4>
              <ConcernCheckbox
                label="On Hold"
                checked={isOnHold}
                onChange={setIsOnHold}
                help="Temporarily unavailable for adoption or transfer" />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wider font-semibold text-text-secondary mb-3">
                Care Considerations
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <ConcernCheckbox
                  label="Behavior Concern"
                  checked={behaviorConcern}
                  onChange={setBehaviorConcern}
                  help="Behavioral considerations staff or fosters should know" />
                <ConcernCheckbox
                  label="Medical Concern"
                  checked={medicalConcern}
                  onChange={setMedicalConcern}
                  help="Medical considerations requiring ongoing awareness" />
              </div>
            </div>
          </div>
        </FormSection>

        {/* Traits — expanded by default if the animal already has some. The key
            forces a remount once the hydrated selection is known so defaultOpen
            reflects it. */}
        <FormSection
          key={`traits-${animalId}-${initialTraitIds.length > 0}`}
          title="Traits"
          collapsible
          defaultOpen={initialTraitIds.length > 0}>
          <TraitMultiSelect
            speciesId={speciesId || undefined}
            selectedIds={traitIds}
            initialSelectedIds={initialTraitIds}
            onChange={setTraitIds} />
        </FormSection>

        {/* Notes & Activity */}
        <FormSection title="Notes & Activity" collapsible defaultOpen={fosterScope}>
          {!fosterScope &&
          <div>
            <Label htmlFor="edit_description">Intake Notes</Label>
            <Textarea
              id="edit_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Initial observations or intake information…"
              rows={3} />

            <p className="text-xs text-text-secondary mt-1">
              Initial observations or intake information.
            </p>
          </div>
          }
          {!fosterScope &&
          <div>
            <Label htmlFor="edit_internal_notes">Care Notes</Label>
            <Textarea
              id="edit_internal_notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Staff-only context that isn't part of the public description…"
              rows={4} />

            <p className="text-xs text-text-secondary mt-1">
              Persistent internal notes about behavior, care needs, routines, preferences, or handling.
            </p>
          </div>
          }
          <div>
            <Label htmlFor="edit_reason">Add Timeline Note (optional)</Label>
            <Textarea
              id="edit_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a note to the activity timeline…"
              rows={2} />

            <p className="text-xs text-text-secondary mt-1">
              Logged to the animal activity timeline.
            </p>
          </div>
        </FormSection>

      </form>
    </Modal>
    {confirmDelete &&
    <ConfirmDialog
      isOpen={true}
      onClose={() => setConfirmDelete(false)}
      onConfirm={performDelete}
      title="Delete animal?"
      confirmLabel="Delete"
      cancelLabel="Keep"
      tone="danger">

        Permanently removes {animalDisplayName(animal)}’s record. This can’t be
        undone.
      </ConfirmDialog>
    }
    </>);

}
