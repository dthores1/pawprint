import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { PlaceAnimalModal } from '../components/animals/PlaceAnimalModal';
import { EditFosterModal } from '../components/fosters/EditFosterModal';
import { AddressDisplay } from '../components/ui/AddressDisplay';
import { personToAddressValue } from '../lib/address';
import { animalDisplayName, hasStatedCapacity } from '../lib/utils';
import {
  ArrowLeftIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  HomeIcon,
  CheckCircle2Icon,
  Edit2Icon,
  Trash2Icon,
  InfoIcon } from
'lucide-react';
import { ArchiveConfirmDialog } from '../components/archive/ArchiveConfirmDialog';
import { useCanArchive } from '../components/archive/useCanArchive';
import { useCanManageFosters } from '../lib/useAnimalPermissions';
import { InviteToAppModal } from '../components/people/InviteToAppModal';
import { useAuth } from '../context/AuthContext';
import { Send as SendIcon } from 'lucide-react';
export function FosterProfile() {
  const { id } = useParams<{
    id: string;
  }>();
  // Index so past placements of now-historical animals still resolve.
  const {
    fosters,
    fostersLoading,
    ensurePerson,
    placements,
    animalsIndex: animals
  } = useWhisker();
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const navigate = useNavigate();
  const canArchiveBase = useCanArchive('people', { id: id ?? 'na' });
  const { currentOrg, currentPersonId } = useAuth();
  const isAdmin = currentOrg?.role === 'owner' || currentOrg?.role === 'admin';
  const canManageFosters = useCanManageFosters();
  // Block self-archive even for admins — there's no sensible recovery path
  // if an admin removes their own contact / member record from the UI.
  const isSelf = !!currentPersonId && currentPersonId === id;
  const canArchive = canArchiveBase && !isSelf;
  const foster = fosters.find((f) => f.id === id);
  // The default load is active-only, so an inactive foster's profile won't be
  // present — fetch the person by id on demand (it joins `fosters` once merged,
  // if they have the foster_parent role). `resolved` separates loading from 404.
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    if (!id || foster) return;
    setResolved(false);
    let cancelled = false;
    ensurePerson(id).finally(() => {
      if (!cancelled) setResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, foster, ensurePerson]);
  if (!foster) {
    if (fostersLoading || !resolved) {
      return <div className="p-8 text-center text-text-secondary">Loading…</div>;
    }
    return <div className="p-8 text-center">Foster not found.</div>;
  }
  const fosterPlacements = placements.filter(
    (p) => p.person_id === foster.id
  );
  const activePlacements = fosterPlacements.filter(
    (p) => p.placement_status === 'active'
  );
  const pastPlacements = fosterPlacements.filter(
    (p) => p.placement_status === 'completed'
  );
  const activeCount = activePlacements.length;
  const cap = foster.max_capacity ?? 0;
  const isFull = cap > 0 && activeCount >= cap; // Don't show "at maximum capacity" for a cap of zero
  const capacityPercent = cap > 0 ? activeCount / cap * 100 : 0;
  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/fosters"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">

          <ArrowLeftIcon className="w-4 h-4" /> Back to Fosters
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && !foster.user_id && foster.email &&
          <Button
            variant="soft"
            size="sm"
            onClick={() => setIsInviteOpen(true)}>

              <SendIcon className="w-4 h-4 mr-2" /> Invite to Whiskerville
            </Button>
          }
          {canManageFosters &&
          <Button
            variant="soft"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}>

            <Edit2Icon className="w-4 h-4 mr-2" /> Edit
          </Button>
          }
          {canArchive &&
          <button
            type="button"
            onClick={() => setArchiving(true)}
            aria-label="Archive foster"
            title="Archive foster"
            className="p-2 rounded-lg text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

              <Trash2Icon className="w-4 h-4" />
            </button>
          }
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Info */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <Avatar
                src={foster.photo_url}
                name={`${foster.first_name} ${foster.last_name}`}
                colorKey={foster.id}
                type="person"
                size="xl"
                className="mb-4" />
              
              <h1 className="text-2xl font-heading font-bold text-text-primary">
                {foster.first_name} {foster.last_name}
              </h1>
              <div className="flex gap-2 mt-2">
                {foster.active ?
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DDEFE2] text-[#3E7B52]">
                    <CheckCircle2Icon className="w-3.5 h-3.5" /> Active Foster
                  </span> :

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-background text-text-secondary border border-border">
                    Inactive
                  </span>
                }
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-border">
              <div className="flex items-start gap-3">
                <MapPinIcon className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
                {personToAddressValue(foster) ?
                <AddressDisplay value={personToAddressValue(foster)} /> :
                <span className="text-text-primary">—</span>
                }
              </div>
              <div className="flex items-center gap-3">
                <PhoneIcon className="w-5 h-5 text-text-secondary shrink-0" />
                {foster.phone ?
                <a
                  href={`tel:${foster.phone}`}
                  className="text-primary hover:underline">

                  {foster.phone}
                </a> :
                <span className="text-text-primary">—</span>
                }
              </div>
              <div className="flex items-center gap-3">
                <MailIcon className="w-5 h-5 text-text-secondary shrink-0" />
                {foster.email ?
                <a
                  href={`mailto:${foster.email}`}
                  className="text-primary hover:underline">

                  {foster.email}
                </a> :
                <span className="text-text-primary">—</span>
                }
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
              <InfoIcon className="w-5 h-5 text-secondary" />
              Preferences & Notes
            </h3>
            <div className="mb-4">
              <p className="text-sm text-text-secondary mb-2">
                Preferred Species
              </p>
              <div className="flex gap-2">
                {(foster.preferred_species ?? []).map((s) =>
                <span
                  key={s}
                  className="px-3 py-1 bg-accent text-secondary rounded-lg text-sm font-medium">
                  
                    {s}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">Notes</p>
              <p className="text-text-primary text-sm leading-relaxed">
                {foster.notes || 'No notes provided.'}
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column: Placements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Capacity Overview */}
          <Card className="p-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-xl font-heading font-bold">
                  Current Capacity
                </h2>
                <p className="text-text-secondary">Animals currently in care</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-heading font-bold text-primary">
                  {activeCount}
                </span>
                <span className="text-text-secondary text-lg">
                  {hasStatedCapacity(foster.max_capacity) ?
                  ` / ${cap}` :
                  ' in care'}
                </span>
              </div>
            </div>
            {hasStatedCapacity(foster.max_capacity) ?
            <>
                <div className="w-full bg-background rounded-full h-4 overflow-hidden mb-2">
                  <div
                  className={`h-4 rounded-full transition-all duration-1000 ${isFull ? 'bg-status-urgent-text' : 'bg-[#3E7B52]'}`}
                  style={{
                    width: `${Math.min(100, capacityPercent)}%`
                  }} />

                </div>
                {isFull &&
              <p className="text-sm text-status-urgent-text font-medium text-right">
                    At maximum capacity
                  </p>
              }
              </> :

            <p className="text-sm text-text-secondary">
                No capacity limit specified.
              </p>
            }
          </Card>

          {/* Current Placements */}
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <HomeIcon className="w-5 h-5 text-primary" />
                Current Placements
              </h2>
              {canManageFosters &&
              <Button
                variant="primary"
                size="sm"
                disabled={!foster.active}
                onClick={() => setIsPlaceModalOpen(true)}>

                <HomeIcon className="w-4 h-4 mr-2" />
                Place Animal
              </Button>
              }
            </div>
            {!foster.active &&
            <p className="text-sm text-text-secondary mb-4">
                This foster is inactive and cannot receive new placements.
              </p>
            }
            {activePlacements.length === 0 ?
            <p className="text-sm text-text-secondary">
                No animals currently placed with this foster.
              </p> :

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activePlacements.map((placement) => {
                const animal = animals.find(
                  (a) => a.id === placement.animal_id
                );
                if (!animal) return null;
                return (
                  <Link
                    key={placement.id}
                    to={`/animals/${animal.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-background transition-colors group">

                      <div className="relative shrink-0">
                        <Avatar
                        src={animal.primary_photo_url}
                        type="animal"
                        species={animal.species} />

                        <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                          <SpeciesBadge species={animal.species} />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                          {animalDisplayName(animal)}
                        </p>
                        <StatusBadge status={animal.status} className="mt-1" />
                      </div>
                    </Link>);

              })}
              </div>
            }
          </Card>

          {/* Past Placements */}
          {pastPlacements.length > 0 &&
          <div className="pt-4">
              <h3 className="text-lg font-heading font-bold mb-4 text-text-secondary">
                Past Placements
              </h3>
              <Card>
                <div className="divide-y divide-border">
                  {pastPlacements.map((placement) => {
                  const animal = animals.find(
                    (a) => a.id === placement.animal_id
                  );
                  if (!animal) return null;
                  return (
                    <div
                      key={placement.id}
                      className="p-4 flex items-center justify-between">
                      
                        <div className="flex items-center gap-4">
                          <Avatar
                          src={animal.primary_photo_url}
                          type="animal"
                          size="sm" />
                        
                          <div>
                            <Link
                            to={`/animals/${animal.id}`}
                            className="font-medium text-text-primary hover:text-primary">
                            
                              {animalDisplayName(animal)}
                            </Link>

                            <p className="text-sm text-text-secondary">
                              {new Date(
                              placement.start_date
                            ).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}{' '}
                              -{' '}
                              {placement.end_date ?
                            new Date(
                              placement.end_date
                            ).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) :
                            'Unknown'}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-text-secondary bg-background px-2 py-1 rounded-md">
                          {placement.notes || 'Completed'}
                        </span>
                      </div>);

                })}
                </div>
              </Card>
            </div>
          }
        </div>
      </div>

      <PlaceAnimalModal
        isOpen={isPlaceModalOpen}
        onClose={() => setIsPlaceModalOpen(false)}
        fosterId={foster.id} />

      <EditFosterModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        foster={foster} />

      {archiving &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchiving(false)}
        table="people"
        id={foster.id}
        typeLabel="foster"
        entityLabel={`${foster.first_name} ${foster.last_name}`}
        onArchived={() => navigate('/fosters')} />

      }
      <InviteToAppModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        person={foster} />

    </div>);

}