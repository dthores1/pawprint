import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MedicalRecord, Trait } from '../types';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, PriorityBadge, AnimalFlags } from '../components/ui/Badge';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { Avatar } from '../components/ui/Avatar';
import { AddMedicalModal } from '../components/animals/AddMedicalModal';
import { AddNoteModal } from '../components/animals/AddNoteModal';
import { ChangeStatusModal } from '../components/animals/ChangeStatusModal';
import { EditTraitsModal } from '../components/animals/EditTraitsModal';
import { PlaceAnimalModal } from '../components/animals/PlaceAnimalModal';
import { StartAdoptionModal } from '../components/animals/StartAdoptionModal';
import { AdoptionReturnModal } from '../components/animals/AdoptionReturnModal';
import { AdoptionPanel } from '../components/animals/AdoptionPanel';
import { ActionNeededCallout } from '../components/animals/ActionNeededCallout';
import { RelationshipsCard } from '../components/animals/RelationshipsCard';
import { ExternalListingsCard } from '../components/animals/ExternalListingsCard';
import { SummaryTab } from '../components/animals/SummaryTab';
import { AdoptionProfileTab } from '../components/animals/AdoptionProfileTab';
import { PhotoGallery } from '../components/animals/PhotoGallery';
import { PLACEMENT_PURPOSE_LABELS } from '../lib/placementPurpose';
import {
  calculateAge,
  formatDate,
  animalDisplayName,
  animalShowsRescueIdBadge,
  humanizeSnakeCase } from
'../lib/utils';
import {
  SyringeIcon,
  FileTextIcon,
  HomeIcon,
  HeartIcon,
  FrownIcon,
  CheckCircle2Icon,
  CircleIcon,
  ArrowLeftIcon,
  Edit2Icon,
  ActivityIcon,
  MessageSquareIcon,
  ClockIcon,
  AlertCircleIcon,
  ImageIcon,
  CameraIcon,
  Trash2Icon,
  PencilIcon,
  TagIcon,
  MapPinnedIcon,
  CheckIcon,
  SparklesIcon,
  MegaphoneIcon } from
'lucide-react';
import { format } from 'date-fns';
import { ArchiveConfirmDialog } from '../components/archive/ArchiveConfirmDialog';
import { useCanArchive } from '../components/archive/useCanArchive';
import { motion } from 'framer-motion';
import { MedicalKitIcon } from '../components/ui/MedicalKitIcon';
import { PawPrintIcon as PawPrintGlyph } from '../components/ui/PawPrintIcon';
import { animalBreedLabel } from '../lib/breedsApi';
import { PROCEDURE_TYPE_LABELS } from '../lib/medicalOptions';
import { speciesIconByName } from '../lib/speciesIcons';
import {
  ADOPTION_RETURN_REASON_LABELS,
  isActiveAdoption } from
'../lib/adoptions';
export function AnimalProfile() {
  const { id } = useParams<{
    id: string;
  }>();
  const {
    animals,
    animalsLoading,
    ensureAnimal,
    placements,
    fosters,
    peopleIndex: people,
    adoptions,
    medicalRecords,
    notes,
    actionItems,
    photos,
    breeds,
    traits,
    animalTraits,
    sites,
    externalListings,
    addPhoto,
    updateMedicalRecord
  } = useWhisker();
  const [isTraitsModalOpen, setIsTraitsModalOpen] = useState(false);
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
  const [editingMedical, setEditingMedical] = useState<MedicalRecord | null>(
    null
  );
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [isStartAdoptionOpen, setIsStartAdoptionOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isAddPhotoOpen, setIsAddPhotoOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'summary' | 'timeline' | 'medical' | 'photos' | 'adoption'>(
    'summary'
  );
  const [archivingNote, setArchivingNote] = useState<
    {id: string;preview: string;} | null>(
    null);
  const [archivingAction, setArchivingAction] = useState<
    {id: string;preview: string;} | null>(
    null);
  const [archivingMedical, setArchivingMedical] = useState<
    {id: string;preview: string;} | null>(
    null);
  const [archivingPlacement, setArchivingPlacement] = useState<
    {id: string;fosterName: string;} | null>(
    null);
  const [archivingAdoption, setArchivingAdoption] = useState<
    {id: string;adopterName: string;} | null>(
    null);
  const [archivingAnimal, setArchivingAnimal] = useState(false);
  const navigate = useNavigate();
  const [heroImageError, setHeroImageError] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const heroFileInputRef = useRef<HTMLInputElement>(null);
  // Reset the image-error state when navigating between animals so the
  // placeholder doesn't persist after the photo URL changes.
  useEffect(() => {
    setHeroImageError(false);
  }, [id]);
  const animal = animals.find((a) => a.id === id);
  // The default `animals` load is in-care only, so a historical animal's profile
  // won't be present — fetch it by id on demand and merge it in. `resolved`
  // tracks whether that fetch has finished (so we can tell "still loading" from
  // a genuine 404).
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    if (!id || animal) return;
    setResolved(false);
    let cancelled = false;
    ensureAnimal(id).finally(() => {
      if (!cancelled) setResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, animal, ensureAnimal]);
  if (!animal) {
    // Wait for the initial in-care load and the by-id fallback before deciding
    // the animal truly doesn't exist.
    if (animalsLoading || !resolved) {
      return <div className="p-8 text-center text-text-secondary">Loading…</div>;
    }
    return <div className="p-8 text-center">Animal not found.</div>;
  }
  // Profile-image upload from the hero (LinkedIn/Twitter-style). Uploads the
  // file, files it under the Photos gallery as a profile photo, and sets it
  // as the animal's profile picture.
  const handleHeroUpload = async (
  e: React.ChangeEvent<HTMLInputElement>) =>
  {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    setHeroImageError(false);
    await addPhoto({
      animal_id: animal.id,
      category: 'general',
      file,
      setAsProfile: true
    });
    setHeroUploading(false);
    if (heroFileInputRef.current) heroFileInputRef.current.value = '';
  };
  // Derived data
  const animalTraitList = animalTraits.
  filter((at) => at.animal_id === animal.id).
  map((at) => traits.find((t) => t.id === at.trait_id)).
  filter((t): t is Trait => !!t && t.active).
  sort((a, b) => a.name.localeCompare(b.name));
  const animalPlacements = placements.filter((p) => p.animal_id === animal.id);
  const activePlacement = animalPlacements.find(
    (p) => p.placement_status === 'active'
  );
  const currentFoster = activePlacement ?
  fosters.find((f) => f.id === activePlacement.person_id) :
  null;
  const isAdopted = animal.status === 'adopted';
  const adopter = animal.adopted_by_id ?
  people.find((p) => p.id === animal.adopted_by_id) :
  null;
  // Rescue Site this animal came from (drives the header "Origin" stat).
  const originSite = animal.site_id ?
  sites.find((s) => s.id === animal.site_id) :
  null;
  const animalAdoptions = adoptions.filter((a) => a.animal_id === animal.id);
  // At most one in-progress adoption per animal (terminal ones — completed,
  // cancelled, returned — are history).
  const activeAdoption = animalAdoptions.find(isActiveAdoption);
  const animalMedical = medicalRecords.filter((m) => m.animal_id === animal.id);
  // Soonest-first by due date (records missing a due date sort last).
  const byDueDate = (
  a: (typeof animalMedical)[number],
  b: (typeof animalMedical)[number]) =>
  new Date(a.due_date || '9999-12-31').getTime() -
  new Date(b.due_date || '9999-12-31').getTime();
  // Overdue is its own branch and takes priority in the "Next Medical" summary.
  const overdueMedical = animalMedical.
  filter((m) => m.status === 'overdue').
  sort(byDueDate);
  // Upcoming = due/scheduled (not yet overdue).
  const upcomingMedical = animalMedical.
  filter((m) => m.status === 'due' || m.status === 'scheduled').
  sort(byDueDate);
  const animalNotes = notes.filter((n) => n.animal_id === animal.id);
  const animalActionItems = actionItems.filter(
    (a) => a.animal_id === animal.id
  );
  const animalPhotosCount = photos.filter(
    (p) => p.animal_id === animal.id
  ).length;
  // Build Timeline
  type TimelineEvent = {
    id: string;
    /** Day used for display (yyyy-MM-dd or ISO). */
    date: string;
    /** Full timestamp for ordering — keeps same-day events in real order. */
    ts: string;
    type: 'intake' | 'medical' | 'placement' | 'note' | 'action' | 'adoption';
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    /** Optional categorical tag rendered as a pill (e.g. placement purpose). */
    purposeLabel?: string;
    /** Optional trailing text shown after the pill (e.g. "expected through …"). */
    descriptionTail?: string;
    /** Note rows opt in here so the timeline can offer an Archive control. */
    note?: { id: string; created_by?: string };
    /** Resolved action-item rows opt in so they can be archived from history. */
    actionItem?: { id: string; created_by?: string };
    /** Medical rows opt in for the admin-only Archive control. */
    medical?: { id: string };
    /** Cancelled-adoption events opt in for the admin-only Archive control. */
    adoption?: { id: string };
    /** Non-active placement events opt in for the admin-only Archive control. */
    placement?: { id: string; fosterName: string };
  };
  const timeline: TimelineEvent[] = [
  {
    id: 'intake',
    date: animal.intake_date,
    ts: animal.intake_date,
    type: 'intake' as const,
    title: 'Intake',
    description: `Source: ${animal.intake_source || 'Not specified'}${
    animal.site_id ?
    ` · Site: ${
    sites.find((s) => s.id === animal.site_id)?.name ?? 'Unknown'
    }` :
    ''
    }`,
    icon: ActivityIcon,
    color: 'bg-[#E5E2DC] text-[#6B6B6B]'
  },
  ...animalMedical.
  filter((m) => m.status === 'completed').
  map((m) => ({
    id: m.id,
    date: m.performed_date!,
    ts: m.performed_date!,
    type: 'medical' as const,
    title: `Medical: ${m.procedure_name}`,
    description: `Provider: ${m.provider_name || 'Unknown'}${m.notes ? ` - ${m.notes}` : ''}`,
    icon: SyringeIcon,
    color: 'bg-[#F3E4D7] text-[#D98C5F]',
    medical: { id: m.id }
  })),
  ...animalPlacements.map((p) => {
    const foster = fosters.find((f) => f.id === p.person_id);
    const fosterName = foster ?
    `${foster.first_name} ${foster.last_name}` :
    'unknown foster';
    return {
      id: p.id,
      date: p.start_date.split('T')[0],
      ts: p.start_date,
      type: 'placement' as const,
      title: `Placed in Foster`,
      // Rendered as: "With {name} · [purpose pill] · expected through {date}".
      description: `With ${fosterName}`,
      purposeLabel:
      p.placement_purpose && p.placement_purpose !== 'general_foster' ?
      PLACEMENT_PURPOSE_LABELS[p.placement_purpose] :
      undefined,
      descriptionTail: p.expected_end_date ?
      `expected through ${formatDate(p.expected_end_date)}` :
      undefined,
      icon: HomeIcon,
      color: 'bg-[#DCEAF7] text-[#356A9A]',
      // Non-active placements opt in for archive — keeps Phase 6 access
      // working now that the dedicated Placements subtab is gone.
      placement: p.placement_status !== 'active' ?
      { id: p.id, fosterName } :
      undefined
    };
  }),
  ...animalNotes.map((n) => ({
    id: n.id,
    date: n.created_at.split('T')[0],
    ts: n.created_at,
    type: 'note' as const,
    title: `Note: ${humanizeSnakeCase(n.note_type)}`,
    description: n.body,
    icon: MessageSquareIcon,
    color: 'bg-background text-text-secondary',
    note: { id: n.id, created_by: n.created_by }
  })),
  // Action items: a "created" event, plus a resolution event when done.
  ...animalActionItems.flatMap((a) => {
    const events: TimelineEvent[] = [
    {
      id: `action-${a.id}-created`,
      date: a.created_at.split('T')[0],
      ts: a.created_at,
      type: 'action' as const,
      title: 'Action item added',
      description: a.description,
      icon: AlertCircleIcon,
      color: 'bg-[#FBF1DC] text-[#A36B00]'
    }];

    if (
    (a.status === 'completed' || a.status === 'cancelled') &&
    a.completed_at)
    {
      const done = a.status === 'completed';
      events.push({
        id: `action-${a.id}-${a.status}`,
        date: a.completed_at.split('T')[0],
        ts: a.completed_at,
        type: 'action' as const,
        title: done ? 'Action completed' : 'Action cancelled',
        description: a.completion_note ?
        `${a.description} — ${a.completion_note}` :
        a.description,
        icon: done ? CheckCircle2Icon : CircleIcon,
        color: done ?
        'bg-[#DDEFE2] text-[#3E7B52]' :
        'bg-background text-text-secondary',
        actionItem: { id: a.id, created_by: a.created_by }
      });
    }
    return events;
  }),
  // Adoption milestones — surfaces past adoptions (completed/cancelled) as
  // history, plus the in-progress one.
  ...animalAdoptions.flatMap((ad) => {
    const adopterPerson = people.find((p) => p.id === ad.adopter_id);
    const adopterName = adopterPerson ?
    `${adopterPerson.first_name} ${adopterPerson.last_name}` :
    'an adopter';
    const adoptionColor = 'bg-[#F3E4D7] text-[#B8632E]';
    const evs: TimelineEvent[] = [
    {
      id: `adoption-${ad.id}-created`,
      date: ad.created_at.split('T')[0],
      ts: ad.created_at,
      type: 'adoption' as const,
      title: 'Adoption started',
      description: `Inquiry opened with ${adopterName}.`,
      icon: HeartIcon,
      color: adoptionColor
    }];

    if (ad.submitted_at)
    evs.push({
      id: `adoption-${ad.id}-submitted`,
      date: ad.submitted_at.split('T')[0],
      ts: ad.submitted_at,
      type: 'adoption' as const,
      title: 'Application submitted',
      description: '',
      icon: HeartIcon,
      color: adoptionColor
    });
    if (ad.paperwork_sent_at)
    evs.push({
      id: `adoption-${ad.id}-paperwork-sent`,
      date: ad.paperwork_sent_at.split('T')[0],
      ts: ad.paperwork_sent_at,
      type: 'adoption' as const,
      title: 'Paperwork sent',
      description: '',
      icon: HeartIcon,
      color: adoptionColor
    });
    if (ad.paperwork_completed_at)
    evs.push({
      id: `adoption-${ad.id}-paperwork-done`,
      date: ad.paperwork_completed_at.split('T')[0],
      ts: ad.paperwork_completed_at,
      type: 'adoption' as const,
      title: 'Paperwork completed',
      description: '',
      icon: HeartIcon,
      color: adoptionColor
    });
    if (ad.completed_at)
    evs.push({
      id: `adoption-${ad.id}-completed`,
      date: ad.completed_at.split('T')[0],
      ts: ad.completed_at,
      type: 'adoption' as const,
      title: 'Adoption completed',
      description: `Adopted by ${adopterName}.`,
      icon: CheckCircle2Icon,
      color: 'bg-[#DDEFE2] text-[#3E7B52]'
    });
    if (ad.cancelled_at)
    evs.push({
      id: `adoption-${ad.id}-cancelled`,
      date: ad.cancelled_at.split('T')[0],
      ts: ad.cancelled_at,
      type: 'adoption' as const,
      title: 'Adoption cancelled',
      description: ad.notes ?? '',
      icon: CircleIcon,
      color: 'bg-background text-text-secondary',
      adoption: { id: ad.id }
    });
    if (ad.returned_at)
    evs.push({
      id: `adoption-${ad.id}-returned`,
      date: ad.returned_at.split('T')[0],
      ts: ad.returned_at,
      type: 'adoption' as const,
      title: 'Adoption return',
      description: [
      ad.return_reason ?
      `Reason: ${ADOPTION_RETURN_REASON_LABELS[ad.return_reason]}.` :
      '',
      ad.return_notes ?? ''].
      filter(Boolean).join(' '),
      icon: FrownIcon,
      color: 'bg-[#F5D7D7] text-[#9B3A3A]'
    });
    return evs;
  })].
  sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()); // Newest first
  // Readiness Checklist logic
  const hasRabies = animalMedical.some(
    (m) =>
    m.status === 'completed' && (
    m.procedure === 'rabies' ||
    // Legacy fallback for records created before structured procedures.
    (!m.procedure && m.procedure_name.toLowerCase().includes('rabies')))
  );
  const isSpayed = animalMedical.some(
    (m) => m.procedure_type === 'spay_neuter' && m.status === 'completed'
  );
  const hasMicrochip = !!animal.microchip_number;
  // A completed microchip medical record means the chip was implanted, but
  // the number may not be on hand yet. The checklist distinguishes "done"
  // vs "needs number" so we can nudge for the missing data in amber rather
  // than just showing pending.
  const hasCompletedMicrochipRecord = animalMedical.some(
    (m) => m.procedure_type === 'microchip' && m.status === 'completed'
  );
  const microchipState: 'done' | 'needs_number' | 'pending' =
  hasMicrochip ?
  'done' :
  hasCompletedMicrochipRecord ?
  'needs_number' :
  'pending';
  // Behavior is "assessed" once there's no open behavior concern AND the animal
  // is past the initial intake/in-care stage (either placed in foster, or moved
  // to a later lifecycle stage where behavior would have been evaluated).
  const behaviorAssessed =
  !animal.has_behavior_concern && (
  !!animal.current_foster_id ||
  animal.status !== 'intake' && animal.status !== 'in_care');
  type ChecklistItem = {
    label: string;
    done: boolean;
    /** Amber-with-helper-text state for partially-complete items. */
    warn?: { helper: string };
  };
  const checklist: ChecklistItem[] = [
  {
    label: 'Behavior Assessed',
    done: behaviorAssessed
  },
  {
    label: 'Spay/Neuter Complete',
    done: isSpayed
  },
  {
    label: 'Microchipped',
    done: microchipState === 'done',
    warn:
    microchipState === 'needs_number' ?
    { helper: 'Needs microchip number' } :
    undefined
  },
  {
    label: 'Rabies Vaccine',
    done: hasRabies
  }];

  const readinessPercent =
  checklist.filter((c) => c.done).length / checklist.length * 100;
  // "Posted for Adoption" is a status row shown after the core readiness items.
  // It reflects a published external listing (an outcome of being adoptable),
  // so it's displayed but intentionally NOT counted in the readiness percentage.
  const postedForAdoption = externalListings.some(
    (l) => l.animal_id === animal.id && l.status === 'published'
  );
  const statusRows: ChecklistItem[] = [
  { label: 'Posted for Adoption', done: postedForAdoption }];
  return (
    <div className="space-y-6 pb-12">
      <Link
        to="/animals"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
        
        <ArrowLeftIcon className="w-4 h-4" /> Back to Animals
      </Link>

      {/* Hero Section */}
      <Card className="overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-1/3 h-64 md:h-auto bg-accent relative group">
            {animal.primary_photo_url && !heroImageError ?
            <img
              src={animal.primary_photo_url}
              alt={animalDisplayName(animal)}
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setHeroImageError(true)} /> :


            <div className="w-full h-full flex items-center justify-center">
                {/* Avatar-style fallback — matches the "peach" tone used for
                   requester avatars elsewhere in the app. */}
                <div className="w-32 h-32 rounded-full bg-[#EBD4C0] text-[#A85A2A] flex items-center justify-center">
                  {(() => {
                  const Glyph = speciesIconByName(animal.species);
                  return <Glyph className="w-14 h-14" />;
                })()}
                </div>
              </div>
            }

            {/* Hover-to-change profile photo (LinkedIn/Twitter-style). */}
            <button
              type="button"
              onClick={() => heroFileInputRef.current?.click()}
              disabled={heroUploading}
              aria-label={
              animal.primary_photo_url ?
              'Change profile photo' :
              'Upload profile photo'
              }
              className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-white transition-all focus:outline-none ${heroUploading ? 'bg-black/50 opacity-100' : 'bg-black/0 opacity-0 hover:bg-black/40 hover:opacity-100 focus-visible:bg-black/40 focus-visible:opacity-100'}`}>

              <CameraIcon className="w-7 h-7" />
              <span className="text-sm font-medium">
                {heroUploading ?
                'Uploading…' :
                animal.primary_photo_url ?
                'Change photo' :
                'Upload photo'}
              </span>
            </button>
            <input
              ref={heroFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleHeroUpload} />

          </div>
          <div className="flex-1 p-6 md:p-8 flex flex-col justify-between min-w-0">
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                    {animal.name ?
                    <h1 className="text-4xl font-heading font-bold text-text-primary break-words">
                        {animal.name}
                      </h1> :

                    <h1
                      className="text-3xl font-mono font-semibold text-text-primary break-words"
                      title="This animal has not been given a name yet.">

                        {animal.rescue_id}
                      </h1>
                    }
                    {animalShowsRescueIdBadge(animal) &&
                    <span
                      className="font-mono text-xs font-medium bg-background border border-border text-text-secondary px-2 py-1 rounded-md"
                      title="Rescue ID">

                        {animal.rescue_id}
                      </span>
                    }
                  </div>
                  {/* Two-line subtitle hierarchy:
                      1. Species (with icon) • Sex — slightly emphasized
                      2. Breed • Age (est) — lower emphasis
                      Replaces the redundant Cat pill below + the
                      "Estimated X years as of …" line, which was confusing
                      when it contradicted the computed age on the same row. */}
                  {(() => {
                    const SpeciesGlyph = speciesIconByName(animal.species);
                    const breed = animalBreedLabel(animal, breeds);
                    const ageEstimated =
                    animal.birthdate_source === 'estimated_birthdate' ||
                    animal.birthdate_source === 'estimated_age';
                    const ageText = `${calculateAge(animal.estimated_birth_date)}${
                    ageEstimated ? ' (est.)' : ''}`;

                    return (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-base flex flex-wrap items-center gap-x-2 text-text-primary font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <SpeciesGlyph className="w-4 h-4 text-text-secondary" />
                            {animal.species}
                          </span>
                          <span className="text-text-secondary/60">•</span>
                          <span>{animal.sex}</span>
                        </p>
                        <p className="text-sm text-text-secondary">
                          {breed ?
                          <>
                              {breed}{' '}
                              <span className="text-text-secondary/60">•</span>{' '}
                            </> :
                          null}
                          <span className="whitespace-nowrap">{ageText}</span>
                        </p>
                      </div>);

                  })()}
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  {animal.status === 'adoptable' && !activeAdoption &&
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsStartAdoptionOpen(true)}>

                      <HeartIcon className="w-4 h-4 mr-2" />
                      Start Adoption
                    </Button>
                  }
                  {!isAdopted &&
                  <Button
                    variant={
                    animal.status === 'adoptable' ? 'outline' : 'primary'
                    }
                    size="sm"
                    onClick={() => setIsPlaceModalOpen(true)}>

                      <HomeIcon className="w-4 h-4 mr-2" />
                      {currentFoster ? 'Reassign Foster' : 'Place in Foster'}
                    </Button>
                  }
                  {isAdopted &&
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsReturnModalOpen(true)}>

                      <FrownIcon className="w-4 h-4 mr-2" />
                      Adoption Return
                    </Button>
                  }
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsStatusModalOpen(true)}>

                    <Edit2Icon className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <AnimalArchiveButton onClick={() => setArchivingAnimal(true)} />
                </div>
              </div>

              {/* Traits — full-width row under the name/breed line (cap 6 + "+N").
                  The whole row is the click target to open the trait editor. */}
              {animalTraitList.length > 0 ?
              <button
                type="button"
                onClick={() => setIsTraitsModalOpen(true)}
                aria-label="Edit traits"
                className="group w-full text-left flex items-start gap-2 mb-4">

                  <TagIcon className="w-4 h-4 text-text-secondary mt-1 shrink-0" />
                  <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                    {animalTraitList.slice(0, 6).map((t) =>
                  <span
                    key={t.id}
                    title={t.description || undefined}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20 transition-colors group-hover:bg-primary/20">

                        {t.name}
                      </span>
                  )}
                    {animalTraitList.length > 6 &&
                  <span className="text-xs font-medium text-text-secondary self-center">
                        +{animalTraitList.length - 6}
                      </span>
                  }
                  </div>
                </button> :

              <button
                type="button"
                onClick={() => setIsTraitsModalOpen(true)}
                className="flex items-center gap-2 mb-4 text-xs font-medium text-primary hover:underline">

                  <TagIcon className="w-4 h-4 shrink-0" />
                  + Add traits
                </button>
              }

              <div className="flex flex-wrap gap-2 mb-6">
                <StatusBadge
                  status={animal.status}
                  className="text-sm px-3 py-1" />
                
                <PriorityBadge
                  priority={animal.priority}
                  className="text-sm px-3 py-1" />
                
                <AnimalFlags
                  animal={animal}
                  isFostered={!!activePlacement}
                  size="md" />

                {animal.microchip_number &&
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-background border border-border text-text-secondary">
                    Chip: {animal.microchip_number}
                  </span>
                }
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#DCEAF7] text-[#356A9A] rounded-lg shrink-0">
                  <HomeIcon className="w-4 h-4" />
                </div>
                {isAdopted ?
                <div>
                    <p className="text-sm text-text-secondary">Adopted By</p>
                    {adopter ?
                  <Link
                    to={`/contacts/${adopter.id}`}
                    className="font-medium text-primary hover:underline">

                        {adopter.first_name} {adopter.last_name}
                      </Link> :

                  <p className="font-medium text-text-primary">Not recorded</p>
                  }
                  </div> :

                <div>
                    <p className="text-sm text-text-secondary">Current Foster</p>
                    {currentFoster ?
                  <Link
                    to={`/fosters/${currentFoster.id}`}
                    className="font-medium text-primary hover:underline">

                        {currentFoster.first_name} {currentFoster.last_name}
                      </Link> :

                  <p className="font-medium text-text-primary">
                        None (Needs Placement)
                      </p>
                  }
                    {currentFoster && activePlacement && (() => {
                    const parts: string[] = [];
                    if (
                    activePlacement.placement_purpose &&
                    activePlacement.placement_purpose !== 'general_foster')
                    {
                      parts.push(
                        PLACEMENT_PURPOSE_LABELS[activePlacement.placement_purpose]
                      );
                    }
                    if (activePlacement.expected_end_date) {
                      parts.push(
                        `expected through ${formatDate(activePlacement.expected_end_date)}`
                      );
                    }
                    return parts.length ?
                    <p className="text-xs text-text-secondary mt-0.5">
                          {parts.join(' · ')}
                        </p> :
                    null;
                  })()}
                  </div>
                }
              </div>
              {originSite &&
              <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
                    <MapPinnedIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary">Origin</p>
                    <Link
                    to={`/sites/${originSite.id}`}
                    className="font-medium text-primary hover:underline truncate block">
                      {originSite.name}
                    </Link>
                  </div>
                </div>
              }
              {animalMedical.length > 0 &&
              <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-[#F3E4D7] text-[#D98C5F] rounded-lg shrink-0">
                    <SyringeIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Next Medical</p>
                    {overdueMedical.length > 0 ?
                  <p className="font-medium text-status-urgent-text flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span>
                          {overdueMedical[0].procedure_name}
                          {overdueMedical[0].due_date &&
                      ` (${formatDate(overdueMedical[0].due_date)})`}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#F5D7D7] text-[#9B3A3A]">
                          Overdue
                        </span>
                      </p> :
                  upcomingMedical.length > 0 ?
                  <p className="font-medium text-text-primary">
                        {upcomingMedical[0].procedure_name}
                        {upcomingMedical[0].due_date &&
                    ` (${formatDate(upcomingMedical[0].due_date)})`}
                      </p> :

                  <p className="font-medium text-text-primary">Up to date</p>
                  }
                  </div>
                </div>
              }
              {animal.description &&
              <div className="flex items-start gap-3 sm:col-span-3">
                  <div className="p-2 bg-background text-text-secondary rounded-lg shrink-0">
                    <FileTextIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary">Description</p>
                    <p className="font-medium text-text-primary leading-relaxed">
                      {animal.description}
                    </p>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </Card>

      <ActionNeededCallout
        animalId={animal.id}
        animalName={animalDisplayName(animal)}
        priority={animal.priority} />

      {activeAdoption && <AdoptionPanel adoptionId={activeAdoption.id} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tabs (Timeline / Medical History) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-3">
            {/* Tabs — own row; scroll horizontally on narrow widths rather than
                pushing the per-tab action off the card. */}
            <div className="overflow-x-auto -mx-1 px-1">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-card border border-border shadow-soft self-start">
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'summary' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

                <SparklesIcon className="w-4 h-4" /> Summary
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'timeline' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>
                
                <ActivityIcon className="w-4 h-4" /> Timeline
              </button>
              <button
                onClick={() => setActiveTab('medical')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'medical' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>
                
                <MedicalKitIcon className="w-4 h-4" /> Medical Records
                {animalMedical.length > 0 &&
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-background text-text-secondary font-semibold">
                    {animalMedical.length}
                  </span>
                }
              </button>
              <button
                onClick={() => setActiveTab('photos')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'photos' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>
                
                <ImageIcon className="w-4 h-4" /> Photos
                {animalPhotosCount > 0 &&
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-background text-text-secondary font-semibold">
                    {animalPhotosCount}
                  </span>
                }
              </button>
              <button
                onClick={() => setActiveTab('adoption')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'adoption' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

                <MegaphoneIcon className="w-4 h-4" /> Adoption Profile
              </button>
            </div>
            </div>

            {/* The Add button matches the active tab: each surface owns its
                own primary action so there's no cross-tab clutter. Sits on its
                own right-aligned row under the tabs so it never overflows the
                card as tabs grow. */}
            <div className="flex justify-end empty:hidden">
              {activeTab === 'timeline' &&
              <Button
                variant="soft"
                size="sm"
                onClick={() => setIsNoteModalOpen(true)}>

                  <FileTextIcon className="w-4 h-4 mr-2" /> Add Note
                </Button>
              }
              {activeTab === 'medical' &&
              <Button
                variant="soft"
                size="sm"
                onClick={() => setIsMedicalModalOpen(true)}>

                  <SyringeIcon className="w-4 h-4 mr-2" /> Add Medical Record
                </Button>
              }
              {activeTab === 'photos' &&
              <Button
                variant="soft"
                size="sm"
                onClick={() => setIsAddPhotoOpen(true)}>

                  <ImageIcon className="w-4 h-4 mr-2" /> Add Photo
                </Button>
              }
            </div>
          </div>

          {activeTab === 'summary' &&
          <SummaryTab
            animalId={animal.id}
            traitCount={animalTraitList.length}
            noteCount={animalNotes.length}
            medicalCount={animalMedical.length}
            fosterNoteCount={
            animalNotes.filter((n) => n.note_type === 'foster_update').length
            } />
          }

          {activeTab === 'timeline' &&
          <Card className="overflow-hidden">
              <div className="p-6">
                {(() => {
                if (timeline.length === 0) {
                  return (
                    <div className="text-center py-6 text-sm text-text-secondary">
                          No activity yet.
                        </div>);

                }
                return (
                  <div className="relative border-l-2 border-border ml-4 space-y-8 pb-4">
                        {timeline.map((event, index) =>
                    <motion.div
                      key={`${event.id}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative pl-8">

                            <div
                        className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full flex items-center justify-center border-4 border-card ${event.color}`}>

                              <event.icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="flex items-baseline gap-2 mb-1">
                                <h3 className="font-bold text-text-primary">
                                  {event.title}
                                </h3>
                                <span className="text-sm text-text-secondary">
                                  {formatDate(event.date)}
                                </span>
                                {event.note &&
                          <NoteArchiveButton
                            note={event.note}
                            onClick={() =>
                            setArchivingNote({
                              id: event.note!.id,
                              preview:
                              event.description.slice(0, 60) +
                              (event.description.length > 60 ? '…' : '')
                            })
                            } />

                          }
                                {event.actionItem &&
                          <ActionArchiveButton
                            actionItem={event.actionItem}
                            onClick={() =>
                            setArchivingAction({
                              id: event.actionItem!.id,
                              preview:
                              event.description.slice(0, 60) +
                              (event.description.length > 60 ? '…' : '')
                            })
                            } />

                          }
                                {event.medical &&
                          <MedicalArchiveButton
                            onClick={() =>
                            setArchivingMedical({
                              id: event.medical!.id,
                              preview: event.title.replace(/^Medical:\s*/, '')
                            })
                            } />

                          }
                                {event.adoption &&
                          <AdoptionArchiveButton
                            onClick={() => {
                              const ad = animalAdoptions.find(
                                (a) => a.id === event.adoption!.id
                              );
                              const adopter = ad ?
                              people.find((p) => p.id === ad.adopter_id) :
                              undefined;
                              setArchivingAdoption({
                                id: event.adoption!.id,
                                adopterName: adopter ?
                                `${adopter.first_name} ${adopter.last_name}` :
                                'an adopter'
                              });
                            }} />

                          }
                                {event.placement &&
                          <PlacementArchiveButton
                            onClick={() =>
                            setArchivingPlacement({
                              id: event.placement!.id,
                              fosterName: event.placement!.fosterName
                            })
                            } />

                          }
                              </div>
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-text-secondary">
                                <span>{event.description}</span>
                                {event.purposeLabel &&
                          <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#DCEAF7] text-[#356A9A]">
                                      {event.purposeLabel}
                                    </span>
                                  </>
                          }
                                {event.descriptionTail &&
                          <>
                                    <span aria-hidden="true">·</span>
                                    <span>{event.descriptionTail}</span>
                                  </>
                          }
                              </div>
                            </div>
                          </motion.div>
                    )}
                      </div>);

              })()}
              </div>
            </Card>
          }

          {activeTab === 'medical' &&
          <MedicalHistoryView
            records={animalMedical}
            onArchive={(r) =>
            setArchivingMedical({ id: r.id, preview: r.procedure_name })
            }
            onEdit={(r) => setEditingMedical(r)}
            onComplete={(r) =>
            updateMedicalRecord(r.id, {
              status: 'completed',
              performed_date: format(new Date(), 'yyyy-MM-dd')
            })
            } />
          }

          {activeTab === 'photos' &&
          <PhotoGallery
            animalId={animal.id}
            isAddOpen={isAddPhotoOpen}
            onAddOpenChange={setIsAddPhotoOpen} />
          }

          {activeTab === 'adoption' &&
          <AdoptionProfileTab
            animalId={animal.id}
            traitCount={animalTraitList.length}
            noteCount={animalNotes.length}
            fosterUpdateCount={
            animalNotes.filter((n) => n.note_type === 'foster_update').length
            }
            medicalCount={animalMedical.length} />
          }
        </div>

        {/* Right Column: Sidebar Widgets */}
        <div className="space-y-6">
          {/* Adoption Readiness */}
          <Card className="p-6">
            <h3 className="text-lg font-heading font-bold mb-4">
              Adoption Readiness
            </h3>
            <div className="w-full bg-background rounded-full h-2 mb-4 overflow-hidden">
              <div
                className="bg-[#3E7B52] h-2 rounded-full transition-all duration-1000"
                style={{
                  width: `${readinessPercent}%`
                }} />

            </div>
            <div className="space-y-3">
              {checklist.map((item, i) =>
              <div key={i} className="flex items-start gap-3">
                  {item.done ?
                <CheckCircle2Icon className="w-5 h-5 text-[#3E7B52] shrink-0" /> :
                item.warn ?
                <AlertCircleIcon className="w-5 h-5 text-[#A36B00] shrink-0" /> :

                <PawPrintGlyph className="w-5 h-5 text-border shrink-0" />
                }
                  <div className="min-w-0">
                    <span
                    className={
                    item.done ?
                    'text-text-primary' :
                    item.warn ?
                    'text-[#A36B00]' :
                    'text-text-secondary'
                    }>

                      {item.label}
                    </span>
                    {item.warn &&
                  <p className="text-xs font-bold text-[#A36B00] mt-0.5">
                        {item.warn.helper}
                      </p>
                  }
                  </div>
                </div>
              )}
              {/* Post-readiness status (not counted in the % above). */}
              <div className="pt-3 border-t border-border space-y-3">
                {statusRows.map((item, i) =>
                <div key={`status-${i}`} className="flex items-start gap-3">
                    {item.done ?
                  <CheckCircle2Icon className="w-5 h-5 text-[#3E7B52] shrink-0" /> :
                  <PawPrintGlyph className="w-5 h-5 text-border shrink-0" />
                  }
                    <span
                    className={item.done ? 'text-text-primary' : 'text-text-secondary'}>
                      {item.label}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {readinessPercent === 100 &&
            animal.status !== 'adoptable' &&
            animal.status !== 'adopted' &&
            <Button
              className="w-full mt-6 bg-[#DDEFE2] text-[#3E7B52] hover:bg-[#C8E6D0]"
              onClick={() => setIsStatusModalOpen(true)}>

                  Mark as Adoptable
                </Button>
            }
          </Card>

          {/* External adoption listings (Petfinder, the org's site, social…) */}
          <ExternalListingsCard animalId={animal.id} />

          {/* Relationships (auto-hides when none exist) */}
          <RelationshipsCard animalId={animal.id} />

          {/* TODO - REMOVE THIS IF WE DON'T NEED…Upcoming Medical Widget */}
          {/* {upcomingMedical.length > 0 &&
          <Card className="p-6">
              <h3 className="text-lg font-heading font-bold mb-4">
                Care Schedule
              </h3>
              <div className="space-y-4">
                {upcomingMedical.map((m) =>
              <div
                key={m.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                
                    <SyringeIcon
                  className={`w-5 h-5 mt-0.5 ${m.status === 'overdue' ? 'text-status-urgent-text' : 'text-primary'}`} />
                
                    <div>
                      <p className="font-medium text-text-primary">
                        {m.procedure_name}
                      </p>
                      <p
                    className={`text-sm ${m.status === 'overdue' ? 'text-status-urgent-text font-medium' : 'text-text-secondary'}`}>
                    
                        {m.status === 'overdue' ? 'Overdue: ' : 'Due: '}
                        {formatDate(m.due_date!)}
                      </p>
                    </div>
                  </div>
              )}
              </div>
            </Card>
          } */}
        </div>
      </div>

    <AddMedicalModal
        isOpen={isMedicalModalOpen || !!editingMedical}
        onClose={() => {
          setIsMedicalModalOpen(false);
          setEditingMedical(null);
        }}
        animalId={animal.id}
        animal={animal}
        record={editingMedical ?? undefined} />
      
      <AddNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        animalId={animal.id}
        animal={animal} />
      
      <ChangeStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        animalId={animal.id} />

      <EditTraitsModal
        isOpen={isTraitsModalOpen}
        onClose={() => setIsTraitsModalOpen(false)}
        animal={animal} />

      <PlaceAnimalModal
        isOpen={isPlaceModalOpen}
        onClose={() => setIsPlaceModalOpen(false)}
        animalId={animal.id} />

      <StartAdoptionModal
        isOpen={isStartAdoptionOpen}
        onClose={() => setIsStartAdoptionOpen(false)}
        animalId={animal.id} />

      <AdoptionReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        animalId={animal.id} />

      {archivingNote &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchivingNote(null)}
        table="animal_notes"
        id={archivingNote.id}
        typeLabel="note"
        entityLabel={`"${archivingNote.preview}"`} />

      }
      {archivingAction &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchivingAction(null)}
        table="animal_action_items"
        id={archivingAction.id}
        typeLabel="action item"
        entityLabel={`"${archivingAction.preview}"`} />

      }
      {archivingMedical &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchivingMedical(null)}
        table="medical_records"
        id={archivingMedical.id}
        typeLabel="medical record"
        entityLabel={archivingMedical.preview} />

      }
      {archivingPlacement &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchivingPlacement(null)}
        table="foster_placements"
        id={archivingPlacement.id}
        typeLabel="placement"
        entityLabel={`placement with ${archivingPlacement.fosterName}`} />

      }
      {archivingAdoption &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchivingAdoption(null)}
        table="adoptions"
        id={archivingAdoption.id}
        typeLabel="adoption"
        entityLabel={`cancelled adoption (${archivingAdoption.adopterName})`} />

      }
      {archivingAnimal &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchivingAnimal(false)}
        table="animals"
        id={animal.id}
        typeLabel="animal"
        entityLabel={animalDisplayName(animal)}
        onArchived={() => navigate('/animals')} />

      }
    </div>);

}

// Per-note archive button. The hook check is local so each event row can
// independently decide whether to render the action — keeps the rules in one
// place (useCanArchive) without scattering admin checks through the timeline.
function NoteArchiveButton({
  note,
  onClick
}: {
  note: { id: string; created_by?: string };
  onClick: () => void;
}) {
  const canArchive = useCanArchive('animal_notes', {
    id: note.id,
    created_by: note.created_by ?? null
  });
  if (!canArchive) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Archive note"
      className="ml-auto p-1 -mr-1 rounded-md text-text-secondary/60 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

      <Trash2Icon className="w-3.5 h-3.5" />
    </button>);

}

function ActionArchiveButton({
  actionItem,
  onClick
}: {
  actionItem: { id: string; created_by?: string };
  onClick: () => void;
}) {
  const canArchive = useCanArchive('animal_action_items', {
    id: actionItem.id,
    created_by: actionItem.created_by ?? null
  });
  if (!canArchive) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Archive action item"
      className="ml-auto p-1 -mr-1 rounded-md text-text-secondary/60 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

      <Trash2Icon className="w-3.5 h-3.5" />
    </button>);

}

// Medical records are admin-only — no `created_by` on the row, so useCanArchive
// only renders the button for users whose org role is owner/admin.
function MedicalArchiveButton({ onClick }: {onClick: () => void;}) {
  const canArchive = useCanArchive('medical_records', { id: 'na' });
  if (!canArchive) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Archive medical record"
      className="ml-auto p-1 -mr-1 rounded-md text-text-secondary/60 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

      <Trash2Icon className="w-3.5 h-3.5" />
    </button>);

}

// Animal-level archive — admin-only, blockers are all server-side. The
// button is hidden for non-admins; clicking opens the confirm dialog and
// the server raises a specific reason when a blocker fires.
function AnimalArchiveButton({ onClick }: {onClick: () => void;}) {
  const canArchive = useCanArchive('animals', { id: 'na' });
  if (!canArchive) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      aria-label="Archive animal"
      title="Archive animal"
      className="text-text-secondary hover:text-[#9B3A3A]">

      <Trash2Icon className="w-4 h-4" />
    </Button>);

}

// Adoptions are admin-only. Server only allows archive on status='cancelled',
// and the consuming code only emits an `event.adoption` field on the cancelled
// event — so this button is only ever rendered next to an "Adoption cancelled"
// row, with no extra status guard needed here.
function AdoptionArchiveButton({ onClick }: {onClick: () => void;}) {
  const canArchive = useCanArchive('adoptions', { id: 'na' });
  if (!canArchive) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Archive adoption"
      className="ml-auto p-1 -mr-1 rounded-md text-text-secondary/60 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

      <Trash2Icon className="w-3.5 h-3.5" />
    </button>);

}

// Placement archive on the timeline. The consuming code only sets
// `event.placement` for non-active placements, so the status guard is
// upstream; this button just renders the admin-gated icon.
function PlacementArchiveButton({ onClick }: {onClick: () => void;}) {
  const canArchive = useCanArchive('foster_placements', { id: 'na' });
  if (!canArchive) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Archive placement"
      className="ml-auto p-1 -mr-1 rounded-md text-text-secondary/60 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

      <Trash2Icon className="w-3.5 h-3.5" />
    </button>);

}

// — Medical History View ————————————————————————————————————
const STATUS_TONE: Record<
  string,
  {
    wrap: string;
    label: string;
  }> =
{
  completed: {
    wrap: 'bg-[#DDEFE2] text-[#3E7B52]',
    label: 'Completed'
  },
  scheduled: {
    wrap: 'bg-[#DCEAF7] text-[#356A9A]',
    label: 'Scheduled'
  },
  due: {
    wrap: 'bg-[#F8E7C8] text-[#A36B00]',
    label: 'Due'
  },
  overdue: {
    wrap: 'bg-[#F5D7D7] text-[#9B3A3A]',
    label: 'Overdue'
  },
  cancelled: {
    wrap: 'bg-background text-text-secondary border border-border',
    label: 'Cancelled'
  }
};
interface MedicalHistoryViewProps {
  records: ReturnType<typeof useWhisker>['medicalRecords'];
  onArchive: (record: MedicalRecord) => void;
  onEdit: (record: MedicalRecord) => void;
  onComplete: (record: MedicalRecord) => void;
}
function MedicalHistoryView({
  records,
  onArchive,
  onEdit,
  onComplete
}: MedicalHistoryViewProps) {
  if (records.length === 0) {
    return (
      <Card className="p-10 text-center text-text-secondary">
        <MedicalKitIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-text-primary mb-1">
          No medical records yet
        </p>
        <p className="text-sm">
          Add a vaccine, exam, or procedure to start the medical record.
        </p>
      </Card>);

  }
  // Group by status bucket
  const overdue = records.filter((r) => r.status === 'overdue');
  const upcoming = records.filter(
    (r) => r.status === 'due' || r.status === 'scheduled'
  );
  const completed = records.
  filter((r) => r.status === 'completed').
  sort(
    (a, b) =>
    new Date(b.performed_date || 0).getTime() -
    new Date(a.performed_date || 0).getTime()
  );
  const other = records.filter((r) => r.status === 'cancelled');
  // Sort upcoming by soonest due
  upcoming.sort(
    (a, b) =>
    new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()
  );
  return (
    <div className="space-y-4">
      {overdue.length > 0 &&
      <MedicalGroup
        title="Overdue"
        icon={AlertCircleIcon}
        tone="urgent"
        count={overdue.length}
        records={overdue}
        onArchive={onArchive}
        onEdit={onEdit}
        onComplete={onComplete} />

      }
      {upcoming.length > 0 &&
      <MedicalGroup
        title="Upcoming or Unresolved"
        icon={ClockIcon}
        tone="info"
        count={upcoming.length}
        records={upcoming}
        onArchive={onArchive}
        onEdit={onEdit}
        onComplete={onComplete} />

      }
      {completed.length > 0 &&
      <MedicalGroup
        title="Completed"
        icon={CheckCircle2Icon}
        tone="success"
        count={completed.length}
        records={completed}
        onArchive={onArchive}
        onEdit={onEdit}
        onComplete={onComplete} />

      }
      {other.length > 0 &&
      <MedicalGroup
        title="Other"
        icon={CircleIcon}
        tone="neutral"
        count={other.length}
        records={other}
        onArchive={onArchive}
        onEdit={onEdit}
        onComplete={onComplete} />

      }
    </div>);

}
interface MedicalGroupProps {
  title: string;
  icon: React.ElementType;
  tone: 'urgent' | 'info' | 'success' | 'neutral';
  count: number;
  records: ReturnType<typeof useWhisker>['medicalRecords'];
  onArchive: (r: MedicalRecord) => void;
  onEdit: (r: MedicalRecord) => void;
  onComplete: (r: MedicalRecord) => void;
}
function MedicalGroup({
  title,
  icon: Icon,
  tone,
  count,
  records,
  onArchive,
  onEdit,
  onComplete
}: MedicalGroupProps) {
  const { peopleIndex: people, clinicEvents } = useWhisker();
  const toneColor = {
    urgent: 'text-status-urgent-text',
    info: 'text-primary',
    success: 'text-[#3E7B52]',
    neutral: 'text-text-secondary'
  }[tone];
  // Resolve performer/facility: known contact/clinic, else free-text fallback.
  const performerLabel = (r: MedicalRecord): string | null => {
    if (r.provider_contact_id) {
      const p = people.find((x) => x.id === r.provider_contact_id);
      if (p) return `${p.first_name} ${p.last_name}`;
    }
    return r.provider_name || null;
  };
  const facilityLabel = (r: MedicalRecord): string | null => {
    if (r.clinic_id) {
      const c = clinicEvents.find((x) => x.id === r.clinic_id);
      if (c) return `${formatDate(c.date_time)} clinic`;
    }
    return r.facility_name || null;
  };
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-background/60 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${toneColor}`} />
        <span className={`text-sm font-semibold ${toneColor}`}>{title}</span>
        <span className="text-xs text-text-secondary">({count})</span>
      </div>
      <div className="divide-y divide-border">
        {records.map((r) => {
          const tone = STATUS_TONE[r.status] || STATUS_TONE.cancelled;
          // A completed record can have no date (the "Date unknown" escape
          // hatch on the form) — show that explicitly rather than a bare dash.
          const dateUnknown = r.status === 'completed' && !r.performed_date;
          const dateLabel = r.performed_date ?
          formatDate(r.performed_date) :
          r.due_date ?
          formatDate(r.due_date) :
          '—';
          const datePrefix =
          r.status === 'completed' ?
          'Performed' :
          r.status === 'overdue' ?
          'Was due' :
          'Due';
          // A scheduled/due row whose due_date has passed reads as "unresolved"
          // — flagged inline so the user can mark it completed or cancelled
          // without wading into the modal first.
          const today = format(new Date(), 'yyyy-MM-dd');
          const isPastDue =
          (r.status === 'due' || r.status === 'scheduled') &&
          !!r.due_date &&
          r.due_date < today;
          const canMarkComplete =
          r.status !== 'completed' && r.status !== 'cancelled';
          return (
            <div
              key={r.id}
              className="px-5 py-4 hover:bg-background/40 transition-colors">
              
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="min-w-0">
                  <h4 className="font-semibold text-text-primary truncate">
                    {r.procedure_name}
                  </h4>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {PROCEDURE_TYPE_LABELS[r.procedure_type] ||
                    r.procedure_type}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tone.wrap}`}>

                    {tone.label}
                  </span>
                  {canMarkComplete &&
                  <button
                    type="button"
                    onClick={() => onComplete(r)}
                    aria-label="Mark complete"
                    title="Mark complete"
                    className="p-1 rounded-md text-text-secondary/60 hover:text-[#3E7B52] hover:bg-[#DDEFE2]/60 transition-colors">

                      <CheckIcon className="w-3.5 h-3.5" />
                    </button>
                  }
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    aria-label="Edit medical record"
                    title="Edit"
                    className="p-1 rounded-md text-text-secondary/60 hover:text-primary hover:bg-primary/10 transition-colors">

                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <MedicalArchiveButton onClick={() => onArchive(r)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                <span>
                  {dateUnknown ?
                  <span className="italic text-text-secondary">Date unknown</span> :

                  <>
                      <span className="text-text-secondary/70">{datePrefix}:</span>{' '}
                      <span className="text-text-primary font-medium">
                        {dateLabel}
                      </span>
                    </>
                  }
                </span>
                {performerLabel(r) &&
                <span>
                    <span className="text-text-secondary/70">By:</span>{' '}
                    <span className="text-text-primary">{performerLabel(r)}</span>
                  </span>
                }
                {facilityLabel(r) &&
                <span>
                    <span className="text-text-secondary/70">At:</span>{' '}
                    <span className="text-text-primary">{facilityLabel(r)}</span>
                  </span>
                }
                {r.next_due_date &&
                <span>
                    <span className="text-text-secondary/70">Next due:</span>{' '}
                    <span className="text-text-primary font-medium">
                      {formatDate(r.next_due_date)}
                    </span>
                  </span>
                }
              </div>
              {isPastDue &&
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#A36B00]">
                  <AlertCircleIcon className="w-3.5 h-3.5 shrink-0" />
                  Overdue — mark as completed or cancelled
                </p>
              }
              {r.notes &&
              <p className="text-sm text-text-secondary mt-2 italic">
                  {r.notes}
                </p>
              }
            </div>);

        })}
      </div>
    </Card>);

}