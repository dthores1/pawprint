import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MedicalRecord } from '../types';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { Avatar } from '../components/ui/Avatar';
import { AddMedicalModal } from '../components/animals/AddMedicalModal';
import { AddNoteModal } from '../components/animals/AddNoteModal';
import { ChangeStatusModal } from '../components/animals/ChangeStatusModal';
import { PlaceAnimalModal } from '../components/animals/PlaceAnimalModal';
import { ActionNeededCallout } from '../components/animals/ActionNeededCallout';
import { RelationshipsCard } from '../components/animals/RelationshipsCard';
import { AdoptionProfileCard } from '../components/animals/AdoptionProfileCard';
import { PhotoGallery } from '../components/animals/PhotoGallery';
import { calculateAge, formatDate } from '../lib/utils';
import {
  SyringeIcon,
  FileTextIcon,
  HomeIcon,
  CheckCircle2Icon,
  CircleIcon,
  ArrowLeftIcon,
  Edit2Icon,
  ActivityIcon,
  MessageSquareIcon,
  ClockIcon,
  AlertCircleIcon,
  ImageIcon,
  CameraIcon } from
'lucide-react';
import { motion } from 'framer-motion';
import { MedicalKitIcon } from '../components/ui/MedicalKitIcon';
import { PawPrintIcon as PawPrintGlyph } from '../components/ui/PawPrintIcon';
import { BoneIcon } from '../components/ui/BoneIcon';
import { CatIcon } from '../components/icons/CatIcon';
import { animalBreedLabel } from '../lib/breedsApi';
export function AnimalProfile() {
  const { id } = useParams<{
    id: string;
  }>();
  const {
    animals,
    placements,
    fosters,
    medicalRecords,
    notes,
    photos,
    breeds,
    addPhoto
  } = useWhisker();
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'medical' | 'photos'>(
    'timeline'
  );
  const [timelineFilter, setTimelineFilter] = useState<
    'all' | 'placements' | 'medical' | 'notes'>(
    'all');
  const [heroImageError, setHeroImageError] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const heroFileInputRef = useRef<HTMLInputElement>(null);
  // Reset the image-error state when navigating between animals so the
  // placeholder doesn't persist after the photo URL changes.
  useEffect(() => {
    setHeroImageError(false);
  }, [id]);
  const animal = animals.find((a) => a.id === id);
  if (!animal) {
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
      category: 'profile',
      file,
      setAsProfile: true
    });
    setHeroUploading(false);
    if (heroFileInputRef.current) heroFileInputRef.current.value = '';
  };
  // Derived data
  const animalPlacements = placements.filter((p) => p.animal_id === animal.id);
  const activePlacement = animalPlacements.find(
    (p) => p.placement_status === 'active'
  );
  const currentFoster = activePlacement ?
  fosters.find((f) => f.id === activePlacement.foster_parent_id) :
  null;
  const animalMedical = medicalRecords.filter((m) => m.animal_id === animal.id);
  const upcomingMedical = animalMedical.filter(
    (m) =>
    m.status === 'due' || m.status === 'scheduled' || m.status === 'overdue'
  );
  const animalNotes = notes.filter((n) => n.animal_id === animal.id);
  const animalPhotosCount = photos.filter(
    (p) => p.animal_id === animal.id
  ).length;
  // Build Timeline
  type TimelineEvent = {
    id: string;
    date: string;
    type: 'intake' | 'medical' | 'placement' | 'note';
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
  };
  const timeline: TimelineEvent[] = [
  {
    id: 'intake',
    date: animal.intake_date,
    type: 'intake',
    title: 'Intake',
    description: `Source: ${animal.intake_source || 'Not specified'}`,
    icon: ActivityIcon,
    color: 'bg-[#E5E2DC] text-[#6B6B6B]'
  },
  ...animalMedical.
  filter((m) => m.status === 'completed').
  map((m) => ({
    id: m.id,
    date: m.performed_date!,
    type: 'medical' as const,
    title: `Medical: ${m.procedure_name}`,
    description: `Provider: ${m.provider_name || 'Unknown'}${m.notes ? ` - ${m.notes}` : ''}`,
    icon: SyringeIcon,
    color: 'bg-[#F3E4D7] text-[#D98C5F]'
  })),
  ...animalPlacements.map((p) => {
    const foster = fosters.find((f) => f.id === p.foster_parent_id);
    return {
      id: p.id,
      date: p.start_date.split('T')[0],
      type: 'placement' as const,
      title: `Placed in Foster`,
      description: `With ${foster?.first_name} ${foster?.last_name}`,
      icon: HomeIcon,
      color: 'bg-[#DCEAF7] text-[#356A9A]'
    };
  }),
  ...animalNotes.map((n) => ({
    id: n.id,
    date: n.created_at.split('T')[0],
    type: 'note' as const,
    title: `Note: ${n.note_type}`,
    description: n.body,
    icon: MessageSquareIcon,
    color: 'bg-background text-text-secondary'
  }))].
  sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first
  // Readiness Checklist logic
  const hasRabies = animalMedical.some(
    (m) =>
    m.procedure_name.toLowerCase().includes('rabies') &&
    m.status === 'completed'
  );
  const isSpayed = animalMedical.some(
    (m) => m.procedure_type === 'spay_neuter' && m.status === 'completed'
  );
  const hasMicrochip = !!animal.microchip_number;
  const hasBehaviorNote = animalNotes.some((n) => n.note_type === 'behavior');
  const checklist = [
  {
    label: 'Spay/Neuter Complete',
    done: isSpayed
  },
  {
    label: 'Rabies Vaccine',
    done: hasRabies
  },
  {
    label: 'Microchipped',
    done: hasMicrochip
  },
  {
    label: 'Behavior Assessed',
    done: hasBehaviorNote
  }];

  const readinessPercent =
  checklist.filter((c) => c.done).length / checklist.length * 100;
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
              alt={animal.name}
              className="w-full h-full object-cover"
              onError={() => setHeroImageError(true)} /> :


            <div className="w-full h-full flex items-center justify-center">
                {/* Avatar-style fallback — matches the "peach" tone used for
                   requester avatars elsewhere in the app. */}
                <div className="w-32 h-32 rounded-full bg-[#EBD4C0] text-[#A85A2A] flex items-center justify-center">
                  {animal.species === 'Dog' ?
                <BoneIcon className="w-14 h-14" /> :
                animal.species === 'Cat' ?
                <CatIcon className="w-14 h-14" /> :

                <PawPrintGlyph className="w-14 h-14" />
                }
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
                    <h1 className="text-4xl font-heading font-bold text-text-primary break-words">
                      {animal.name}
                    </h1>
                    <span className="font-mono text-xs font-medium bg-background border border-border text-text-secondary px-2 py-1 rounded-md">
                      #{animal.id}
                    </span>
                  </div>
                  <p className="text-lg text-text-secondary">
                    {animalBreedLabel(animal, breeds) || animal.species} •{' '}
                    {animal.sex} •{' '}
                    <span className="whitespace-nowrap">
                      {calculateAge(animal.estimated_birth_date)}
                    </span>
                  </p>
                  {animal.birthdate_source === 'estimated_age' &&
                  animal.estimated_age_value != null &&
                  <p className="text-xs text-text-secondary mt-0.5">
                      Estimated {animal.estimated_age_value}{' '}
                      {animal.estimated_age_unit}
                      {animal.estimated_age_as_of ?
                    ` as of ${formatDate(animal.estimated_age_as_of)}` :
                    ''}
                    </p>
                  }
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsPlaceModalOpen(true)}>

                    <HomeIcon className="w-4 h-4 mr-2" />
                    {currentFoster ? 'Reassign Foster' : 'Place in Foster'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsStatusModalOpen(true)}>

                    <Edit2Icon className="w-4 h-4 mr-2" /> Edit
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <StatusBadge
                  status={animal.status}
                  className="text-sm px-3 py-1" />
                
                <PriorityBadge
                  priority={animal.priority}
                  className="text-sm px-3 py-1" />
                
                <SpeciesBadge species={animal.species} showLabel size="md" />
                {animal.microchip_number &&
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-background border border-border text-text-secondary">
                    Chip: {animal.microchip_number}
                  </span>
                }
              </div>

              <p className="text-text-primary mb-6 max-w-2xl leading-relaxed">
                {animal.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#DCEAF7] text-[#356A9A] rounded-lg">
                  <HomeIcon className="w-5 h-5" />
                </div>
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
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#F3E4D7] text-[#D98C5F] rounded-lg">
                  <SyringeIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Next Medical</p>
                  {upcomingMedical.length > 0 ?
                  <p className="font-medium text-status-urgent-text">
                      {upcomingMedical[0].procedure_name} (
                      {formatDate(upcomingMedical[0].due_date!)})
                    </p> :

                  <p className="font-medium text-text-primary">Up to date</p>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <ActionNeededCallout
        animalId={animal.id}
        priority={animal.priority}
        actionNeeded={animal.action_needed} />
      

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tabs (Timeline / Medical History) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-card border border-border shadow-soft self-start">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'timeline' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>
                
                <ActivityIcon className="w-4 h-4" /> Timeline
              </button>
              <button
                onClick={() => setActiveTab('medical')}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'medical' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>
                
                <MedicalKitIcon className="w-4 h-4" /> Medical History
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
            </div>

            {activeTab !== 'photos' &&
            <div className="flex gap-2">
                <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNoteModalOpen(true)}>
                
                  <FileTextIcon className="w-4 h-4 mr-2" /> Add Note
                </Button>
                <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMedicalModalOpen(true)}>
                
                  <SyringeIcon className="w-4 h-4 mr-2" /> Add Medical
                </Button>
              </div>
            }
          </div>

          {activeTab === 'timeline' &&
          <Card className="overflow-hidden">
              {/* Filter subtabs — sit inside the card so they read as part of
                 the timeline, not a separate floating element. */}
              <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border bg-background/40">
                {(
                [
                { key: 'all', label: 'All Activity' },
                { key: 'placements', label: 'Placements' },
                { key: 'medical', label: 'Medical' },
                { key: 'notes', label: 'Notes' }] as const).
                map((f) =>
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTimelineFilter(f.key)}
                  className={`px-3 h-8 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${timelineFilter === f.key ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

                    {f.label}
                  </button>
              )}
              </div>

              {timelineFilter === 'placements' ?
            <PlacementTimelineList
              placements={animalPlacements}
              fosters={fosters} /> :


            <div className="p-6">
                  {(() => {
                const filtered = timeline.filter((e) => {
                  if (timelineFilter === 'all') return true;
                  if (timelineFilter === 'medical') return e.type === 'medical';
                  if (timelineFilter === 'notes') return e.type === 'note';
                  return true;
                });
                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-6 text-sm text-text-secondary">
                          No {timelineFilter === 'medical' ? 'medical events' : 'notes'} yet.
                        </div>);

                }
                return (
                  <div className="relative border-l-2 border-border ml-4 space-y-8 pb-4">
                        {filtered.map((event, index) =>
                    <motion.div
                      key={`${event.id}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
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
                              </div>
                              <p className="text-text-secondary">
                                {event.description}
                              </p>
                            </div>
                          </motion.div>
                    )}
                      </div>);

              })()}
                </div>
            }
            </Card>
          }

          {activeTab === 'medical' &&
          <MedicalHistoryView records={animalMedical} />
          }

          {activeTab === 'photos' && <PhotoGallery animalId={animal.id} />}
        </div>

        {/* Right Column: Sidebar Widgets */}
        <div className="space-y-6">
          {/* Adoption Listing (only shown when adoptable) */}
          <AdoptionProfileCard
            animalId={animal.id}
            status={animal.status}
            adoptionProfileUrl={animal.adoption_profile_url} />
          

          {/* Relationships (auto-hides when none exist) */}
          <RelationshipsCard animalId={animal.id} />

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
              <div key={i} className="flex items-center gap-3">
                  {item.done ?
                <CheckCircle2Icon className="w-5 h-5 text-[#3E7B52]" /> :

                <PawPrintGlyph className="w-5 h-5 text-border" />
                }
                  <span
                  className={
                  item.done ? 'text-text-primary' : 'text-text-secondary'
                  }>
                  
                    {item.label}
                  </span>
                </div>
              )}
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

          {/* Upcoming Medical Widget */}
          {upcomingMedical.length > 0 &&
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
          }
        </div>
      </div>

      <AddMedicalModal
        isOpen={isMedicalModalOpen}
        onClose={() => setIsMedicalModalOpen(false)}
        animalId={animal.id} />
      
      <AddNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        animalId={animal.id} />
      
      <ChangeStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        animalId={animal.id} />

      <PlaceAnimalModal
        isOpen={isPlaceModalOpen}
        onClose={() => setIsPlaceModalOpen(false)}
        animalId={animal.id} />

    </div>);

}
// — Placement Timeline View ————————————————————————————————————
// Compact, range-based history of an animal's fosters. Each row shows
// "MMM YYYY – MMM YYYY" (or "MMM YYYY – Present" for the active row) and
// the foster's name, linked. Newest first.
function formatPlacementRange(startISO: string, endISO?: string): string {
  const start = new Date(startISO);
  const sm = start.toLocaleString('en-US', { month: 'short' });
  const sy = start.getFullYear();
  if (!endISO) return `${sm} ${sy} – Present`;
  const end = new Date(endISO);
  const em = end.toLocaleString('en-US', { month: 'short' });
  const ey = end.getFullYear();
  return sy === ey ? `${sm} – ${em} ${sy}` : `${sm} ${sy} – ${em} ${ey}`;
}
// Friendly duration between two dates: "11 days", "6 months", "1 yr 5 mo".
// `endISO` undefined means "still active" — measured against now.
function formatPlacementDuration(startISO: string, endISO?: string): string {
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date();
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
  let months =
  (end.getFullYear() - start.getFullYear()) * 12 +
  (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  months = Math.max(1, months);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years} yr ${rem} mo`;
}
interface PlacementTimelineListProps {
  placements: ReturnType<typeof useWhisker>['placements'];
  fosters: ReturnType<typeof useWhisker>['fosters'];
}
function PlacementTimelineList({
  placements,
  fosters
}: PlacementTimelineListProps) {
  if (placements.length === 0) {
    return (
      <div className="p-10 text-center text-text-secondary">
        <HomeIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-text-primary mb-1">
          No foster history yet
        </p>
        <p className="text-sm">
          When this animal is placed with a foster, the timeline will start here.
        </p>
      </div>);

  }
  // Active first (no end_date), then completed by recency.
  const sorted = [...placements].sort((a, b) => {
    if (!a.end_date && b.end_date) return -1;
    if (a.end_date && !b.end_date) return 1;
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
  });
  return (
    <div className="p-6">
      <div className="relative border-l-2 border-border ml-4 space-y-8 pb-4">
        {sorted.map((p) => {
          const foster = fosters.find((f) => f.id === p.foster_parent_id);
          const isActive = p.placement_status === 'active';
          return (
            <div key={p.id} className="relative pl-8">
              <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full flex items-center justify-center border-4 border-card bg-[#DCEAF7] text-[#356A9A]">
                <HomeIcon className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-baseline gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-text-primary tabular-nums">
                    {formatPlacementRange(p.start_date, p.end_date)}
                  </span>
                  <span className="text-xs text-text-secondary tabular-nums">
                    · {formatPlacementDuration(p.start_date, p.end_date)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-text-secondary">
                  <span>
                    Placed with{' '}
                    {foster ?
                    <Link
                      to={`/fosters/${foster.id}`}
                      className="font-medium text-primary hover:underline">
                        {foster.first_name} {foster.last_name}
                      </Link> :
                    <span className="font-medium text-text-secondary italic">
                        Unknown foster
                      </span>
                    }
                  </span>
                  {isActive &&
                  <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-[#DDEFE2] text-[#3E7B52]">
                      Active
                    </span>
                  }
                  {p.placement_type && p.placement_type !== 'foster' &&
                  <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-[#DCEAF7] text-[#356A9A]">
                      {p.placement_type.replace('_', ' ')}
                    </span>
                  }
                </div>
                {p.reason_ended &&
                <p className="text-xs text-text-secondary mt-1">
                    {p.reason_ended}
                  </p>
                }
                {p.notes &&
                <p className="text-sm text-text-secondary mt-1 italic">
                    {p.notes}
                  </p>
                }
              </div>
            </div>);

        })}
      </div>
    </div>);

}
// — Medical History View ————————————————————————————————————
const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  vaccine: 'Vaccine',
  exam: 'Exam',
  spay_neuter: 'Spay/Neuter',
  medication: 'Medication',
  surgery: 'Surgery',
  microchip: 'Microchip',
  deworming: 'Deworming',
  test: 'Test'
};
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
  canceled: {
    wrap: 'bg-background text-text-secondary border border-border',
    label: 'Canceled'
  }
};
interface MedicalHistoryViewProps {
  records: ReturnType<typeof useWhisker>['medicalRecords'];
}
function MedicalHistoryView({ records }: MedicalHistoryViewProps) {
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
  const other = records.filter((r) => r.status === 'canceled');
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
        records={overdue} />

      }
      {upcoming.length > 0 &&
      <MedicalGroup
        title="Upcoming"
        icon={ClockIcon}
        tone="info"
        count={upcoming.length}
        records={upcoming} />

      }
      {completed.length > 0 &&
      <MedicalGroup
        title="Completed"
        icon={CheckCircle2Icon}
        tone="success"
        count={completed.length}
        records={completed} />

      }
      {other.length > 0 &&
      <MedicalGroup
        title="Other"
        icon={CircleIcon}
        tone="neutral"
        count={other.length}
        records={other} />

      }
    </div>);

}
interface MedicalGroupProps {
  title: string;
  icon: React.ElementType;
  tone: 'urgent' | 'info' | 'success' | 'neutral';
  count: number;
  records: ReturnType<typeof useWhisker>['medicalRecords'];
}
function MedicalGroup({
  title,
  icon: Icon,
  tone,
  count,
  records
}: MedicalGroupProps) {
  const { people, clinicEvents } = useWhisker();
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
          const tone = STATUS_TONE[r.status] || STATUS_TONE.canceled;
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
                <span
                  className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tone.wrap}`}>
                  
                  {tone.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                <span>
                  <span className="text-text-secondary/70">{datePrefix}:</span>{' '}
                  <span className="text-text-primary font-medium">
                    {dateLabel}
                  </span>
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