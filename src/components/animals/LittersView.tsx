import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SpeciesBadge } from '../ui/SpeciesBadge';
import { PawPrintIcon } from '../ui/PawPrintIcon';
import { EditLitterModal } from './EditLitterModal';
import { AddLitterMemberModal } from './AddLitterMemberModal';
import {
  CalendarIcon,
  HomeIcon,
  HeartIcon,
  SyringeIcon,
  PlusIcon,
  Edit2Icon } from
'lucide-react';
import { formatDate } from '../../lib/utils';
import {
  litterMembers,
  litterLabel,
  memberNoun,
  summarizeLitterStatuses,
  litterPrimaryFoster,
  nextLitterMilestone } from
'../../lib/litters';

export function LittersView() {
  const { litters, littersLoading, animals, fosters, medicalRecords, breeds } =
  useWhisker();
  const [editLitterId, setEditLitterId] = useState<string | null>(null);
  const [addMemberLitterId, setAddMemberLitterId] = useState<string | null>(
    null
  );

  if (littersLoading && litters.length === 0) {
    return (
      <div className="p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
        Loading litters…
      </div>);

  }
  if (litters.length === 0) {
    return (
      <div className="p-12 text-center bg-card rounded-2xl border border-border">
        <div className="flex flex-col items-center gap-3">
          <PawPrintIcon className="w-10 h-10 text-text-secondary/30" />
          <p className="text-text-secondary">
            No litters yet. Use <span className="font-medium">Add Litter</span> to
            group animals taken in together.
          </p>
        </div>
      </div>);

  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {litters.map((litter) => {
          const members = litterMembers(animals, litter.id);
          const count = members.length;
          const summary = summarizeLitterStatuses(members);
          const { foster, distinctCount } = litterPrimaryFoster(members, fosters);
          const milestone = nextLitterMilestone(members, medicalRecords);
          const mother = litter.mother_animal_id ?
          animals.find((a) => a.id === litter.mother_animal_id) :
          null;
          return (
            <Card key={litter.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <Link
                  to={`/litters/${litter.id}`}
                  className="font-heading font-bold text-lg text-text-primary hover:text-primary transition-colors leading-snug">

                  {litterLabel(litter, breeds)}
                </Link>
                <SpeciesBadge species={litter.species} />
              </div>

              <div className="space-y-2 text-sm flex-1">
                <div className="flex items-center gap-2 text-text-secondary">
                  <PawPrintIcon className="w-4 h-4 shrink-0" />
                  <span className="font-medium text-text-primary">
                    {count} {memberNoun(litter.species, count)}
                  </span>
                </div>
                {summary &&
                <p className="text-text-secondary pl-6 leading-relaxed">
                    {summary}
                  </p>
                }
                <div className="flex items-center gap-2 text-text-secondary">
                  <CalendarIcon className="w-4 h-4 shrink-0" />
                  <span>Intake {formatDate(litter.intake_date)}</span>
                </div>
                {mother &&
                <div className="flex items-center gap-2 text-text-secondary">
                    <HeartIcon className="w-4 h-4 shrink-0" />
                    <span>
                      Mother:{' '}
                      <Link
                      to={`/animals/${mother.id}`}
                      className="text-primary hover:underline">

                        {mother.name}
                      </Link>
                    </span>
                  </div>
                }
                {(foster || distinctCount > 1) &&
                <div className="flex items-center gap-2 text-text-secondary">
                    <HomeIcon className="w-4 h-4 shrink-0" />
                    <span>
                      {foster ?
                      <>
                          With{' '}
                          <Link
                          to={`/fosters/${foster.id}`}
                          className="text-primary hover:underline">

                            {foster.first_name} {foster.last_name}
                          </Link>
                        </> :

                      `Across ${distinctCount} fosters`}
                    </span>
                  </div>
                }
                {milestone &&
                <div className="flex items-center gap-2 text-text-secondary">
                    <SyringeIcon className="w-4 h-4 shrink-0" />
                    <span>
                      Next: {milestone.procedure_name} ·{' '}
                      {formatDate(milestone.due_date!)}
                    </span>
                  </div>
                }
              </div>

              <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => setAddMemberLitterId(litter.id)}>

                  <PlusIcon className="w-4 h-4 mr-1.5" /> Add Animal
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => setEditLitterId(litter.id)}>

                  <Edit2Icon className="w-4 h-4 mr-1.5" /> Update Group
                </Button>
              </div>
            </Card>);

        })}
      </div>

      {editLitterId &&
      <EditLitterModal
        isOpen={!!editLitterId}
        litterId={editLitterId}
        onClose={() => setEditLitterId(null)} />
      }
      {addMemberLitterId &&
      <AddLitterMemberModal
        isOpen={!!addMemberLitterId}
        litterId={addMemberLitterId}
        onClose={() => setAddMemberLitterId(null)} />
      }
    </>);

}
