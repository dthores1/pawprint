import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { ArchiveConfirmDialog } from '../components/archive/ArchiveConfirmDialog';
import { useCanArchive } from '../components/archive/useCanArchive';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { StatusBadge, PriorityBadge, AnimalFlags } from '../components/ui/Badge';
import { EditLitterModal } from '../components/animals/EditLitterModal';
import { AddLitterMemberModal } from '../components/animals/AddLitterMemberModal';
import {
  ArrowLeftIcon,
  CalendarIcon,
  HeartIcon,
  HomeIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon } from
'lucide-react';
import {
  formatDate,
  calculateAge,
  animalDisplayName } from
'../lib/utils';
import {
  litterMembers,
  litterLabel,
  memberNoun,
  summarizeLitterStatuses } from
'../lib/litters';

export function LitterProfile() {
  const { id } = useParams<{ id: string }>();
  const { litters, animals, fosters, breeds } = useWhisker();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const navigate = useNavigate();
  const canArchive = useCanArchive('litters', { id: id ?? 'na' });

  const litter = litters.find((l) => l.id === id);
  if (!litter) {
    return <div className="p-8 text-center">Litter not found.</div>;
  }

  const members = litterMembers(animals, litter.id);
  const mother = litter.mother_animal_id ?
  animals.find((a) => a.id === litter.mother_animal_id) :
  null;
  const breedLabel =
  litter.breed_text ||
  (litter.breed_id ?
  breeds.find((b) => b.id === litter.breed_id)?.name :
  undefined);
  const summary = summarizeLitterStatuses(members);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/animals"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">

          <ArrowLeftIcon className="w-4 h-4" /> Back to Animals
        </Link>
        <div className="flex gap-2">
          <Button variant="soft" size="sm" onClick={() => setIsAddOpen(true)}>
            <PlusIcon className="w-4 h-4 mr-2" /> Add Animal
          </Button>
          <Button variant="soft" size="sm" onClick={() => setIsEditOpen(true)}>
            <Edit2Icon className="w-4 h-4 mr-2" /> Update Group
          </Button>
          {canArchive &&
          <button
            type="button"
            onClick={() => setArchiving(true)}
            aria-label="Archive litter"
            title="Archive litter"
            className="p-2 rounded-lg text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

              <Trash2Icon className="w-4 h-4" />
            </button>
          }
        </div>
      </div>

      {/* Litter metadata */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-text-primary">
              {litterLabel(litter, breeds)}
            </h1>
            <p className="text-text-secondary mt-1">
              {members.length} {memberNoun(litter.species, members.length)}
              {breedLabel ? ` · ${breedLabel}` : ''}
            </p>
          </div>
          <SpeciesBadge species={litter.species} showLabel size="md" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background text-text-secondary rounded-lg">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Intake</p>
              <p className="font-medium text-text-primary">
                {formatDate(litter.intake_date)}
                {litter.intake_source ? ` · ${litter.intake_source}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F3E4D7] text-[#D98C5F] rounded-lg">
              <HeartIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Mother</p>
              {mother ?
              <Link
                to={`/animals/${mother.id}`}
                className="font-medium text-primary hover:underline">

                  {mother.name}
                </Link> :

              <p className="font-medium text-text-primary">Unknown</p>
              }
            </div>
          </div>
        </div>

        {summary &&
        <p className="text-sm text-text-secondary mt-4 pt-4 border-t border-border">
            {summary}
          </p>
        }
        {litter.notes &&
        <p className="text-sm text-text-primary mt-4 leading-relaxed">
            {litter.notes}
          </p>
        }
      </Card>

      {/* Members */}
      <div>
        <h2 className="text-xl font-heading font-bold mb-4">Animals in Litter</h2>
        {members.length === 0 ?
        <Card className="p-8 text-center text-text-secondary">
            No animals in this litter yet.
          </Card> :

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((animal) => {
            const foster = animal.current_foster_id ?
            fosters.find((f) => f.id === animal.current_foster_id) :
            null;
            return (
              <Link key={animal.id} to={`/animals/${animal.id}`} className="block group">
                  <Card hoverLift className="p-4 flex items-center gap-4">
                    <div className="relative shrink-0">
                      <Avatar
                      src={animal.primary_photo_url}
                      type="animal"
                      species={animal.species} />

                      <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                        <SpeciesBadge species={animal.species} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                        {animalDisplayName(animal)}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {calculateAge(animal.estimated_birth_date)} · {animal.sex}
                        {foster ?
                      ` · with ${foster.first_name} ${foster.last_name}` :
                      ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <StatusBadge status={animal.status} />
                        <PriorityBadge priority={animal.priority} />
                        <AnimalFlags animal={animal} isFostered={!!foster} />
                      </div>
                    </div>
                  </Card>
                </Link>);

          })}
          </div>
        }
      </div>

      <EditLitterModal
        isOpen={isEditOpen}
        litterId={litter.id}
        onClose={() => setIsEditOpen(false)} />

      <AddLitterMemberModal
        isOpen={isAddOpen}
        litterId={litter.id}
        onClose={() => setIsAddOpen(false)} />

      {archiving &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchiving(false)}
        table="litters"
        id={litter.id}
        typeLabel="litter"
        entityLabel={litterLabel(litter)}
        onArchived={() => navigate('/animals')} />

      }
    </div>);

}
