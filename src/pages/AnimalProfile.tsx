import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MedicalRecord, Trait } from '../types';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, PriorityBadge, AnimalFlags } from '../components/ui/Badge';
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
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { FilesList, AttachedFilesCard } from '../components/animals/FilesList';
import { SummaryTab } from '../components/animals/SummaryTab';
import { AdoptionProfileTab } from '../components/animals/AdoptionProfileTab';
import { PhotoGallery } from '../components/animals/PhotoGallery';
import { PLACEMENT_PURPOSE_LABELS } from '../lib/placementPurpose';
import {
  calculateAge,
  formatDate,
  animalDisplayName,
  animalShowsRescueIdBadge,
  humanizeSnakeCase,
  formatDatesInText } from
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
  MegaphoneIcon,
  CalendarIcon,
  FolderIcon } from
'lucide-react';
import { format } from 'date-fns';
import { ArchiveConfirmDialog } from '../components/archive/ArchiveConfirmDialog';
import { useCanArchive } from '../components/archive/useCanArchive';
import { motion } from 'framer-motion';
import { MedicalKitIcon } from '../components/ui/MedicalKitIcon';
import { PawPrintIcon as PawPrintGlyph } from '../components/ui/PawPrintIcon';
import { animalBreedLabel } from '../lib/breedsApi';
import { litterLabel } from '../lib/litters';
import { isInCare } from '../lib/animalStatus';
import { track } from '../lib/analytics';
import { PROCEDURE_TYPE_LABELS } from '../lib/medicalOptions';
import { speciesIconByName } from '../lib/speciesIcons';
import {
  ADOPTION_RETURN_REASON_LABELS,
  isActiveAdoption } from
'../lib/adoptions';
import {
  useCanManageAnimals,
  useCanManageMedical,
  useCanManageExternalListings,
  useCanManageFosters,
  useCanManageAdoptions,
  useIsActiveFosterOf } from
'../lib/useAnimalPermissions';
import { RequestReassignmentModal } from '../components/animals/RequestReassignmentModal';
import { EndPlacementModal } from '../components/animals/EndPlacementModal';
import { useFostersEnabled } from '../lib/useFostersEnabled';

// A done/pending checklist row, shared by the outcome summary cards below.
function SummaryCheckRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-start gap-3">
      {done ?
      <CheckCircle2Icon className="w-5 h-5 text-[#3E7B52] shrink-0" /> :
      <PawPrintGlyph className="w-5 h-5 text-border shrink-0" />}
      <span className={done ? 'text-text-primary' : 'text-text-secondary'}>
        {label}
      </span>
    </div>);

}

// An icon + label + value row for the outcome summaries (e.g. "Adopted — Jun 4").
function SummaryValueRow({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-text-secondary shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-text-secondary">
          {label}
        </p>
        <p className="text-text-primary">{value}</p>
      </div>
    </div>);

}

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
    animalFiles,
    breeds,
    litters,
    traits,
    animalTraits,
    sites,
    externalListings,
    addPhoto,
    updateMedicalRecord,
    updateAnimal,
    addNote
  } = useWhisker();
  // Permission gating. Admins/owners and MANAGE_ANIMALS holders manage freely;
  // the active foster of *this* animal gets the limited care-collaboration set.
  // (Called before the early returns below so hook order stays stable.)
  const canManageAnimals = useCanManageAnimals();
  const canManageMedical = useCanManageMedical();
  const canManageListings = useCanManageExternalListings();
  const canManageFosters = useCanManageFosters();
  const fostersEnabled = useFostersEnabled();
  const canManageAdoptions = useCanManageAdoptions();
  const isActiveFoster = useIsActiveFosterOf(id);
  // "Foster-only": the current user is the assigned foster but cannot manage
  // animals outright — they get the limited edit/care scope, not full control.
  const fosterOnly = isActiveFoster && !canManageAnimals;
  // May touch the foster-collaboration surfaces (notes, photos, traits, AI).
  const canCollaborate = canManageAnimals || isActiveFoster;
  const [isReassignRequestOpen, setIsReassignRequestOpen] = useState(false);
  const [isTraitsModalOpen, setIsTraitsModalOpen] = useState(false);
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
  const [editingMedical, setEditingMedical] = useState<MedicalRecord | null>(
    null
  );
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [isEndPlacementOpen, setIsEndPlacementOpen] = useState(false);
  const [isStartAdoptionOpen, setIsStartAdoptionOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isAddPhotoOpen, setIsAddPhotoOpen] = useState(false);
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'summary' | 'timeline' | 'medical' | 'photos' | 'files' | 'adoption'>(
    'summary'
  );
  // Analytics wrappers — fire only on user interaction (not default state).
  const selectTab = (
  tab: 'summary' | 'timeline' | 'medical' | 'photos' | 'files' | 'adoption') =>
  {
    track('tab_viewed', { page: 'animal_profile', tab });
    setActiveTab(tab);
  };
  const openModal = (modal: string, setOpen: (open: boolean) => void) => {
    track('modal_opened', { page: 'animal_profile', modal });
    setOpen(true);
  };
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
  // Foster placement only applies to animals still in care — hide the placement
  // controls once an animal is adopted, released, or deceased.
  const inCare = isInCare(animal.status);
  // Released/deceased are terminal cases: the AI Summary is reframed as a "Case
  // Summary" (still useful history), and the adoption-marketing profile is hidden.
  const isTerminalCase =
  animal.status === 'released' || animal.status === 'deceased';
  const canHaveAdoptionProfile = !isTerminalCase;
  const adopter = animal.adopted_by_id ?
  people.find((p) => p.id === animal.adopted_by_id) :
  null;
  // Rescue Site this animal came from (drives the header "Origin" stat).
  const originSite = animal.site_id ?
  sites.find((s) => s.id === animal.site_id) :
  null;
  // The litter this animal belongs to (drives the header "Litter" stat).
  const litter = animal.litter_id ?
  litters.find((l) => l.id === animal.litter_id) :
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
  const animalFilesList = animalFiles.filter((f) => f.animal_id === animal.id);
  const animalFilesCount = animalFilesList.length;
  const medicalFiles = animalFilesList.filter((f) => f.category === 'medical_record');
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
  ...animalPlacements.flatMap((p) => {
    const foster = fosters.find((f) => f.id === p.person_id);
    const fosterName = foster ?
    `${foster.first_name} ${foster.last_name}` :
    'unknown foster';
    const events: TimelineEvent[] = [
    {
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
    }];

    // A completed placement also gets an end event (reassignment, adoption,
    // or an explicit End Placement) — with the reason as the trailing text.
    if (p.placement_status === 'completed' && p.end_date) {
      events.push({
        id: `${p.id}-ended`,
        date: p.end_date.split('T')[0],
        ts: p.end_date,
        type: 'placement' as const,
        title: 'Foster Placement Ended',
        description: `With ${fosterName}`,
        descriptionTail: p.reason_ended || undefined,
        icon: HomeIcon,
        color: 'bg-[#E5E2DC] text-[#6B6B6B]'
      });
    }
    return events;
  }),
  ...animalNotes.map((n) => ({
    id: n.id,
    date: n.created_at.split('T')[0],
    ts: n.created_at,
    type: 'note' as const,
    title: `Note: ${humanizeSnakeCase(n.note_type)}`,
    description: formatDatesInText(n.body),
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
      description: formatDatesInText(a.description),
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
        formatDatesInText(`${a.description} — ${a.completion_note}`) :
        formatDatesInText(a.description),
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
    // Directly-recorded adoptions never had an inquiry — their created_at is
    // just the day the record was backfilled, so no "started" event.
    const evs: TimelineEvent[] =
    ad.source === 'direct' ?
    [] :
    [
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
      description:
      ad.source === 'direct' ?
      adopterPerson ?
      `Adopted by ${adopterName}. Recorded directly.` :
      'Recorded directly.' :
      `Adopted by ${adopterName}.`,
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
              {/* Name + actions. Content-driven wrap instead of a viewport
                  breakpoint: this column's width depends on the sidebar and
                  hero image, not the viewport, so breakpoints misfire on
                  tablets. The name block reserves a 16rem basis and grows;
                  when the actions can't fit beside it they wrap onto their
                  own line as a group (and wrap internally if still tight) —
                  the name is never squeezed under the buttons. */}
              <div className="flex flex-wrap items-start gap-4 mb-4">
                <div className="grow shrink basis-64 min-w-0">
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
                <div className="flex flex-wrap gap-2">
                  {canManageAdoptions && animal.status === 'adoptable' && !activeAdoption &&
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openModal('start_adoption', setIsStartAdoptionOpen)}>

                      <HeartIcon className="w-4 h-4 mr-2" />
                      Start Adoption
                    </Button>
                  }
                  {fostersEnabled && canManageFosters && inCare &&
                  <Button
                    variant={
                    animal.status === 'adoptable' ? 'outline' : 'primary'
                    }
                    size="sm"
                    onClick={() => openModal('place_animal', setIsPlaceModalOpen)}>

                      <HomeIcon className="w-4 h-4 mr-2" />
                      {currentFoster ? 'Reassign Foster' : 'Place in Foster'}
                    </Button>
                  }
                  {/* The assigned foster can't reassign themselves — they ask a
                      coordinator to find a new placement. */}
                  {fostersEnabled && fosterOnly && inCare &&
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openModal('reassign_request', setIsReassignRequestOpen)}>

                      <HomeIcon className="w-4 h-4 mr-2" />
                      Request Reassignment
                    </Button>
                  }
                  {canManageAdoptions && isAdopted &&
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openModal('adoption_return', setIsReturnModalOpen)}>

                      <FrownIcon className="w-4 h-4 mr-2" />
                      Adoption Return
                    </Button>
                  }
                  {(canManageAnimals || fosterOnly) &&
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openModal('change_status', setIsStatusModalOpen)}>

                    <Edit2Icon className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  }
                  <AnimalArchiveButton onClick={() => setArchivingAnimal(true)} />
                </div>
              </div>

              {/* Traits — full-width row under the name/breed line (cap 6 + "+N").
                  The whole row is the click target to open the trait editor. */}
              {animalTraitList.length > 0 ?
              <button
                type="button"
                onClick={canCollaborate ? () => openModal('edit_traits', setIsTraitsModalOpen) : undefined}
                disabled={!canCollaborate}
                aria-label={canCollaborate ? 'Edit traits' : 'Traits'}
                className="group w-full text-left flex items-start gap-2 mb-4 disabled:cursor-default">

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
              canCollaborate ?
              <button
                type="button"
                onClick={() => openModal('edit_traits', setIsTraitsModalOpen)}
                className="flex items-center gap-2 mb-4 text-xs font-medium text-primary hover:underline">

                  <TagIcon className="w-4 h-4 shrink-0" />
                  + Add traits
                </button> :
              null
              }

              <div className="flex flex-wrap items-center gap-2 mb-6">
                <StatusBadge
                  status={animal.status}
                  className="text-sm px-3 py-1" />

                {/* An adopted animal known to have died in its new home keeps
                    the Adopted status (deceased = died in OUR care); this quiet
                    annotation says "don't follow up". */}
                {animal.status === 'adopted' && animal.known_to_be_deceased &&
                <span className="text-sm text-text-secondary">
                    (Deceased
                    {animal.date_of_death ?
                  ` ${formatDate(animal.date_of_death)}` :
                  ''})
                  </span>
                }

                <PriorityBadge
                  priority={animal.priority}
                  className="text-sm px-3 py-1" />
                
                {/* No "Fostered" chip here — the Current Foster row below the
                    header already conveys it. (List cards still pass isFostered.) */}
                <AnimalFlags
                  animal={animal}
                  size="md" />

                {animal.microchip_number &&
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-background border border-border text-text-secondary">
                    Chip: {animal.microchip_number}
                  </span>
                }
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-border">
              {/* With foster management off, the Current Foster cell is hidden
                  — EXCEPT while an active placement exists (grandfathered:
                  the animal is physically in someone's home, so who has it
                  must stay visible until the placement is ended). The
                  Adopted By variant always shows once adopted. */}
              {(isAdopted || fostersEnabled || !!currentFoster) &&
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
                  fostersEnabled ?
                  <Link
                    to={`/fosters/${currentFoster.id}`}
                    className="font-medium text-primary hover:underline">

                        {currentFoster.first_name} {currentFoster.last_name}
                      </Link> :

                  // Grandfathered (fosters off): the profile route is
                  // gated, so show the name unlinked.
                  <p className="font-medium text-text-primary">
                        {currentFoster.first_name} {currentFoster.last_name}
                      </p> :

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
                    {/* The "no new foster" exit — the animal returns to the
                        org's direct care. Reassignment stays in the header
                        button; this covers foster-unavailable and program
                        wind-down (incl. when foster management is off). */}
                    {currentFoster && canManageFosters &&
                  <button
                    type="button"
                    onClick={() => openModal('end_placement', setIsEndPlacementOpen)}
                    className="block text-xs font-medium text-text-secondary hover:text-[#9B3A3A] underline underline-offset-2 mt-0.5">

                        End placement
                      </button>
                  }
                  </div>
                }
              </div>
              }
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
              {litter &&
              <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
                    <PawPrintGlyph className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary">Litter</p>
                    <Link
                    to={`/litters/${litter.id}`}
                    className="font-medium text-primary hover:underline truncate block">
                      {litterLabel(litter, breeds)}
                    </Link>
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
        priority={animal.priority}
        canManage={canCollaborate} />

      {activeAdoption && <AdoptionPanel adoptionId={activeAdoption.id} canManage={canManageAdoptions} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tabs (Timeline / Medical History) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs — scroll horizontally on narrow widths (hidden scrollbar +
              edge fades + active-tab auto-scroll via ScrollableTabs). */}
          <ScrollableTabs
              activeKey={activeTab}
              className="rounded-xl bg-card border border-border shadow-soft">
              <div className="inline-flex items-center gap-1 p-1">
              <button
                data-tabkey="summary"
                onClick={() => selectTab('summary')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'summary' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

                <SparklesIcon className="w-4 h-4" /> Summary
              </button>
              <button
                data-tabkey="timeline"
                onClick={() => selectTab('timeline')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'timeline' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

                <ActivityIcon className="w-4 h-4" /> Timeline
              </button>
              <button
                data-tabkey="medical"
                onClick={() => selectTab('medical')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'medical' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

                <MedicalKitIcon className="w-4 h-4" /> Medical Records
                {animalMedical.length > 0 &&
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-background text-text-secondary font-semibold">
                    {animalMedical.length}
                  </span>
                }
              </button>
              <button
                data-tabkey="photos"
                onClick={() => selectTab('photos')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'photos' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

                <ImageIcon className="w-4 h-4" /> Photos
                {animalPhotosCount > 0 &&
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-background text-text-secondary font-semibold">
                    {animalPhotosCount}
                  </span>
                }
              </button>
              <button
                data-tabkey="files"
                onClick={() => selectTab('files')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'files' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

                <FolderIcon className="w-4 h-4" /> Files
                {animalFilesCount > 0 &&
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-background text-text-secondary font-semibold">
                    {animalFilesCount}
                  </span>
                }
              </button>
              {/* Adoption marketing copy is only meaningful pre-adoption —
                  hidden entirely for released/deceased animals. */}
              {canHaveAdoptionProfile &&
              <button
                data-tabkey="adoption"
                onClick={() => selectTab('adoption')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'adoption' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

                <MegaphoneIcon className="w-4 h-4" /> Adoption Profile
              </button>
              }
              </div>
            </ScrollableTabs>

          {/* The per-tab "Add …" action sits just above its content and is
              grouped with it (space-y-2) so it reads as that section's toolbar
              rather than a button floating in the gap. Collapses entirely on
              tabs with no primary action (empty:hidden). */}
          <div className="space-y-2">
            <div className="flex justify-end empty:hidden">
              {activeTab === 'timeline' && canCollaborate &&
              <Button variant="soft" size="sm" onClick={() => openModal('add_note', setIsNoteModalOpen)}>
                  <FileTextIcon className="w-4 h-4 mr-2" /> Add Note
                </Button>
              }
              {activeTab === 'medical' && canManageMedical &&
              <Button variant="soft" size="sm" onClick={() => openModal('add_medical', setIsMedicalModalOpen)}>
                  <SyringeIcon className="w-4 h-4 mr-2" /> Add Medical Record
                </Button>
              }
              {activeTab === 'photos' && canCollaborate &&
              <Button variant="soft" size="sm" onClick={() => openModal('add_photo', setIsAddPhotoOpen)}>
                  <ImageIcon className="w-4 h-4 mr-2" /> Add Photo
                </Button>
              }
              {activeTab === 'files' && canCollaborate &&
              <Button variant="soft" size="sm" onClick={() => openModal('add_file', setIsAddFileOpen)}>
                  <FolderIcon className="w-4 h-4 mr-2" /> Add File
                </Button>
              }
            </div>

          {activeTab === 'summary' &&
          <SummaryTab
            animalId={animal.id}
            canManage={canCollaborate}
            caseMode={isTerminalCase}
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
          <div className="space-y-5">
            <MedicalHistoryView
              records={animalMedical}
              canManage={canManageMedical}
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

            {/* Master file list lives in the Files tab; surface only the
                medical-categorized ones here for convenience. */}
            <AttachedFilesCard files={medicalFiles} title="Attached medical files" />
          </div>
          }

          {activeTab === 'photos' &&
          <PhotoGallery
            animalId={animal.id}
            canManage={canCollaborate}
            isAddOpen={isAddPhotoOpen}
            onAddOpenChange={setIsAddPhotoOpen} />
          }

          {activeTab === 'files' &&
          <FilesList
            animalId={animal.id}
            canManage={canCollaborate}
            isAddOpen={isAddFileOpen}
            onAddOpenChange={setIsAddFileOpen} />
          }

          {activeTab === 'adoption' && (
          canHaveAdoptionProfile ?
          <AdoptionProfileTab
            animalId={animal.id}
            canManage={canCollaborate}
            traitCount={animalTraitList.length}
            noteCount={animalNotes.length}
            fosterUpdateCount={
            animalNotes.filter((n) => n.note_type === 'foster_update').length
            }
            medicalCount={animalMedical.length} /> :

          // Reachable only if the tab was open when the status changed — the tab
          // is otherwise hidden. Explain rather than showing invalid marketing copy.
          <Card className="p-8 text-center">
              <MegaphoneIcon className="w-8 h-8 mx-auto mb-3 text-text-secondary opacity-40" />
              <p className="font-medium text-text-primary mb-1">
                Adoption Profile unavailable
              </p>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Adoption profiles can only be generated for animals currently
                being prepared for adoption.
              </p>
            </Card>)
          }
          </div>
        </div>

        {/* Right Column: Sidebar Widgets */}
        <div className="space-y-6">
          {/* Right-sidebar outcome card — Adoption Readiness while in care, then
              a status-specific summary once the animal reaches a final outcome. */}
          {inCare &&
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
            {/* The checklist is advisory, not a gate — the button shows for any
                in-care animal (readiness < 100% just gets a heads-up below) so
                promoting to Adoptable never requires Edit → status. */}
            {canManageAnimals &&
            animal.status !== 'adoptable' &&
            animal.status !== 'adopted' &&
            <div className="mt-6">
                <Button
              className="w-full bg-[#DDEFE2] text-[#3E7B52] hover:bg-[#C8E6D0]"
              onClick={() => {
                updateAnimal(animal.id, { status: 'adoptable' });
                addNote({
                  animal_id: animal.id,
                  author_name: 'Current User',
                  note_type: 'general',
                  body: `status: ${animal.status} → adoptable. Marked adoptable from the readiness checklist.`
                });
                track('animal_status_changed', {
                  animal_id: animal.id,
                  new_status: 'adoptable',
                  new_priority: animal.priority
                });
              }}>

                  Mark as Adoptable
                </Button>
                {readinessPercent < 100 &&
            <p className="mt-2 text-xs text-text-secondary text-center">
                    {checklist.filter((c) => !c.done).length} readiness item
                    {checklist.filter((c) => !c.done).length === 1 ? '' : 's'}{' '}
                    still open.
                  </p>
            }
              </div>
            }
          </Card>
          }

          {/* Adopted → Adoption Summary (no CTA). */}
          {animal.status === 'adopted' &&
          <Card className="p-6">
              <h3 className="text-lg font-heading font-bold mb-4">
                Adoption Summary
              </h3>
              <div className="space-y-3">
                {adopter &&
              <SummaryValueRow
                icon={<HeartIcon className="w-5 h-5" />}
                label="Adopter"
                value={`${adopter.first_name} ${adopter.last_name}`.trim()} />
              }
                {animal.adopted_at &&
              <SummaryValueRow
                icon={<CalendarIcon className="w-5 h-5" />}
                label="Adopted"
                value={formatDate(animal.adopted_at)} />
              }
                <div className="pt-3 border-t border-border space-y-3">
                  {checklist.map((item, i) =>
                <SummaryCheckRow key={i} done={item.done} label={item.label} />
                )}
                </div>
              </div>
            </Card>
          }

          {/* Released → Release Summary (no CTA). */}
          {animal.status === 'released' &&
          <Card className="p-6">
              <h3 className="text-lg font-heading font-bold mb-4">
                Release Summary
              </h3>
              <div className="space-y-3">
                {checklist.map((item, i) =>
              <SummaryCheckRow key={i} done={item.done} label={item.label} />
              )}
                <div className="pt-3 border-t border-border">
                  <SummaryValueRow
                  icon={<CalendarIcon className="w-5 h-5" />}
                  label="Released"
                  value={
                  animal.released_at ?
                  formatDate(animal.released_at) :
                  'Date not recorded'
                  } />
                </div>
              </div>
            </Card>
          }

          {/* Deceased → Case Summary (no CTA). */}
          {animal.status === 'deceased' &&
          <Card className="p-6">
              <h3 className="text-lg font-heading font-bold mb-4">Case Summary</h3>
              <div className="space-y-3">
                <SummaryValueRow
                icon={<CalendarIcon className="w-5 h-5" />}
                label="Date of death"
                value={
                animal.date_of_death ?
                formatDate(animal.date_of_death) :
                'Not recorded'
                } />
                {animal.cause_of_death?.trim() &&
              <SummaryValueRow
                icon={<FileTextIcon className="w-5 h-5" />}
                label="Cause of death"
                value={animal.cause_of_death} />
              }
                <div className="pt-3 border-t border-border space-y-3">
                  <SummaryCheckRow
                  done={animalMedical.some((m) => m.procedure_type === 'necropsy')}
                  label="Necropsy performed" />

                  <SummaryCheckRow done={hasMicrochip} label="Microchipped" />
                  <SummaryCheckRow
                  done={animalMedical.length > 0}
                  label="Medical records on file" />

                </div>
              </div>
            </Card>
          }

          {/* External adoption listings (Petfinder, the org's site, social…) */}
          <ExternalListingsCard animalId={animal.id} canManage={canManageListings} />

          {/* Relationships (auto-hides when none exist) */}
          <RelationshipsCard animalId={animal.id} canManage={canManageAnimals} />

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
        animalId={animal.id}
        fosterScope={fosterOnly} />

      <EditTraitsModal
        isOpen={isTraitsModalOpen}
        onClose={() => setIsTraitsModalOpen(false)}
        animal={animal} />

      <PlaceAnimalModal
        isOpen={isPlaceModalOpen}
        onClose={() => setIsPlaceModalOpen(false)}
        animalId={animal.id} />

      <EndPlacementModal
        isOpen={isEndPlacementOpen}
        onClose={() => setIsEndPlacementOpen(false)}
        animal={animal}
        foster={currentFoster} />

      <RequestReassignmentModal
        isOpen={isReassignRequestOpen}
        onClose={() => setIsReassignRequestOpen(false)}
        animal={animal} />

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
  canManage: boolean;
  onArchive: (record: MedicalRecord) => void;
  onEdit: (record: MedicalRecord) => void;
  onComplete: (record: MedicalRecord) => void;
}
function MedicalHistoryView({
  records,
  canManage,
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
        canManage={canManage}
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
        canManage={canManage}
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
        canManage={canManage}
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
        canManage={canManage}
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
  canManage: boolean;
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
  canManage,
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
                  {canManage && canMarkComplete &&
                  <button
                    type="button"
                    onClick={() => onComplete(r)}
                    aria-label="Mark complete"
                    title="Mark complete"
                    className="p-1 rounded-md text-text-secondary/60 hover:text-[#3E7B52] hover:bg-[#DDEFE2]/60 transition-colors">

                      <CheckIcon className="w-3.5 h-3.5" />
                    </button>
                  }
                  {canManage &&
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    aria-label="Edit medical record"
                    title="Edit"
                    className="p-1 rounded-md text-text-secondary/60 hover:text-primary hover:bg-primary/10 transition-colors">

                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  }
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