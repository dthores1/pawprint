import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HeartIcon, PlusIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { GuidanceLink } from '../components/guidance/GuidanceLink';
import { Avatar } from '../components/ui/Avatar';
import { useWhisker } from '../context/WhiskerContext';
import { useCanManageAdoptions } from '../lib/useAnimalPermissions';
import { animalDisplayName, formatDate, cn } from '../lib/utils';
import {
  ADOPTION_STATUS_LABELS,
  isActiveAdoption,
  formatDonation } from
'../lib/adoptions';
import { Adoption, AdoptionStatus } from '../types';
import { StartAdoptionModal } from '../components/animals/StartAdoptionModal';
import { UpdateAdoptionModal } from '../components/animals/UpdateAdoptionModal';
import { CompleteAdoptionModal } from '../components/animals/CompleteAdoptionModal';
import { CancelAdoptionModal } from '../components/animals/CancelAdoptionModal';
import { AdoptionReturnModal } from '../components/animals/AdoptionReturnModal';

type AdoptionsTab = 'pending' | 'completed' | 'returned' | 'all';
const TABS: { key: AdoptionsTab; label: string }[] = [
{ key: 'pending', label: 'Pending' },
{ key: 'completed', label: 'Completed' },
{ key: 'returned', label: 'Returned' },
{ key: 'all', label: 'All' }];

// Soft status pills, color-grouped by lifecycle (active vs terminal outcomes).
function adoptionStatusClasses(status: AdoptionStatus): string {
  if (status === 'completed') return 'bg-[#DDEFE2] text-[#3E7B52]';
  if (status === 'returned') return 'bg-[#E8DEEC] text-[#6E4E80]';
  if (status === 'cancelled') return 'bg-[#E0E0E0] text-[#555555]';
  return 'bg-[#F3E4D7] text-[#B8632E]'; // any in-progress status
}

function matchesTab(a: Adoption, tab: AdoptionsTab): boolean {
  switch (tab) {
    case 'pending':return isActiveAdoption(a);
    case 'completed':return a.status === 'completed';
    case 'returned':return a.status === 'returned';
    case 'all':return true;
  }
}

type ModalState =
{ kind: 'complete' | 'cancel' | 'update'; adoptionId: string } |
{ kind: 'return'; animalId: string } |
null;

export function Adoptions() {
  const { adoptions, animalsIndex, peopleIndex, placements } = useWhisker();
  const canManage = useCanManageAdoptions();
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab: AdoptionsTab =
  param === 'completed' || param === 'returned' || param === 'all' ?
  param :
  'pending';
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const setTab = (next: AdoptionsTab) => {
    setSearchParams(next === 'pending' ? {} : { tab: next }, { replace: true });
  };

  // Newest first (by start date). Terminal records sink naturally via the tabs.
  const rows = adoptions.
  filter((a) => matchesTab(a, tab)).
  sort((a, b) => b.created_at.localeCompare(a.created_at));

  // TODO - REMOVE IF YOU OPT TO NOT SHOW FOSTER COLUMN
  // const activeFosterFor = (animalId: string) => {
  //   const placement = placements.find(
  //     (p) => p.animal_id === animalId && p.placement_status === 'active'
  //   );
  //   if (!placement) return null;
  //   return peopleIndex.find((p) => p.id === placement.person_id) ?? null;
  // };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <HeartIcon className="w-8 h-8 text-primary" />
            Adoptions
          </h1>
          <p className="text-text-secondary mt-1">
            Track pending and completed adoptions across the organization.
          </p>
          <GuidanceLink guidanceKey="adoptions_intro" />
        </div>
        {canManage &&
        <Button onClick={() => setIsStartOpen(true)} className="gap-2">
            <PlusIcon className="w-4 h-4" />
            Start Adoption
          </Button>
        }
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) =>
        <button
          key={t.key}
          type="button"
          onClick={() => setTab(t.key)}
          className={cn(
            '-mb-px px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            tab === t.key ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>

            {t.label}
          </button>
        )}
      </div>

      {rows.length === 0 ?
      <Card className="p-10 text-center text-text-secondary">
          <HeartIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            {tab === 'all' ? 'No adoptions yet' : `No ${tab} adoptions`}
          </p>
          <p className="text-sm">
            {tab === 'pending' ?
          'Start an adoption for an adoptable animal to see it here.' :
          'Nothing to show in this view yet.'}
          </p>
        </Card> :

      <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-secondary">
                  <th className="font-medium px-5 py-3">Animal</th>
                  <th className="font-medium px-5 py-3">Adopter</th>
                  <th className="font-medium px-5 py-3">Status</th>
                  <th className="font-medium px-5 py-3">Started</th>
                  <th className="font-medium px-5 py-3">Completed</th>
                  <th className="font-medium px-5 py-3">Fee</th>
                  {/* <th className="font-medium px-5 py-3">Foster</th> */}
                  <th className="font-medium px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((a) => {
                  const animal = animalsIndex.find((x) => x.id === a.animal_id);
                  const adopter = peopleIndex.find((x) => x.id === a.adopter_id);
                  // TODO - REMOVE IF YOU OPT TO NOT SHOW FOSTER COLUMN
                  // const foster = activeFosterFor(a.animal_id);
                  const donation = formatDonation(a.donation_amount);
                  const readyToComplete = a.status === 'ready_for_placement';
                  return (
                    <tr key={a.id} className="hover:bg-background/60">
                      <td className="px-5 py-3">
                        {animal ?
                        <Link
                          to={`/animals/${animal.id}`}
                          className="flex items-center gap-2.5 min-w-0 group">

                            <Avatar
                            name={animalDisplayName(animal)}
                            src={animal.primary_photo_url}
                            type="animal"
                            species={animal.species}
                            size="sm" />

                            <span className="font-medium text-text-primary group-hover:text-primary truncate">
                              {animalDisplayName(animal)}
                            </span>
                          </Link> :

                        <span className="text-text-secondary">Unknown</span>
                        }
                      </td>
                      <td className="px-5 py-3">
                        {adopter ?
                        <Link
                          to={`/contacts/${adopter.id}`}
                          className="text-primary hover:underline">

                            {adopter.first_name} {adopter.last_name}
                          </Link> :

                        <span className="text-text-secondary">Unknown</span>
                        }
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                            adoptionStatusClasses(a.status)
                          )}>

                          {ADOPTION_STATUS_LABELS[a.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                        {formatDate(a.created_at.split('T')[0])}
                      </td>
                      <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                        {a.completed_at ?
                        formatDate(a.completed_at.split('T')[0]) :
                        '—'}
                      </td>
                      <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                        {donation ?? '—'}
                      </td>
                      {/* TODO - REMOVE IF YOU OPT TO NOT SHOW FOSTER COLUMN */}
                      {/* <td className="px-5 py-3 text-text-secondary truncate max-w-[10rem]">
                        {foster ?
                        `${foster.first_name} ${foster.last_name}` :
                        '—'}
                      </td> */}
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                          {animal &&
                          <Link
                            to={`/animals/${animal.id}`}
                            className="text-xs font-medium text-text-secondary hover:text-primary">

                              View
                            </Link>
                          }
                          {canManage && isActiveAdoption(a) &&
                          <>
                              {readyToComplete ?
                            <button
                              type="button"
                              onClick={() =>
                              setModal({ kind: 'complete', adoptionId: a.id })
                              }
                              className="text-xs font-medium text-[#3E7B52] hover:underline">

                                  Complete
                                </button> :

                            <button
                              type="button"
                              onClick={() =>
                              setModal({ kind: 'update', adoptionId: a.id })
                              }
                              className="text-xs font-medium text-primary hover:underline">

                                  Update
                                </button>
                            }
                              <button
                              type="button"
                              onClick={() =>
                              setModal({ kind: 'cancel', adoptionId: a.id })
                              }
                              className="text-xs font-medium text-[#9B3A3A] hover:underline">

                                Cancel
                              </button>
                            </>
                          }
                          {canManage && a.status === 'completed' &&
                          <button
                            type="button"
                            onClick={() =>
                            setModal({ kind: 'return', animalId: a.animal_id })
                            }
                            className="text-xs font-medium text-[#6E4E80] hover:underline">

                              Mark Returned
                            </button>
                          }
                        </div>
                      </td>
                    </tr>);

                })}
              </tbody>
            </table>
          </div>
        </Card>
      }

      <StartAdoptionModal
        isOpen={isStartOpen}
        onClose={() => setIsStartOpen(false)} />

      <UpdateAdoptionModal
        isOpen={modal?.kind === 'update'}
        adoptionId={modal?.kind === 'update' ? modal.adoptionId : ''}
        onClose={() => setModal(null)} />

      <CompleteAdoptionModal
        isOpen={modal?.kind === 'complete'}
        adoptionId={modal?.kind === 'complete' ? modal.adoptionId : ''}
        onClose={() => setModal(null)} />

      <CancelAdoptionModal
        isOpen={modal?.kind === 'cancel'}
        adoptionId={modal?.kind === 'cancel' ? modal.adoptionId : ''}
        onClose={() => setModal(null)} />

      <AdoptionReturnModal
        isOpen={modal?.kind === 'return'}
        animalId={modal?.kind === 'return' ? modal.animalId : ''}
        onClose={() => setModal(null)} />

    </div>);

}
