import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { useWhisker } from '../../context/WhiskerContext';
import { ArchiveConfirmDialog } from '../archive/ArchiveConfirmDialog';
import { useCanArchive } from '../archive/useCanArchive';
import {
  HeartIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  Trash2Icon } from
'lucide-react';
import { formatDate } from '../../lib/utils';
import { Adoption } from '../../types';
import {
  adoptionAnimalIds,
  adoptionMilestones,
  adoptionOutcomeLabel,
  isLostAdoption,
  formatDonation } from
'../../lib/adoptions';
import { animalDisplayName } from '../../lib/utils';
import { track } from '../../lib/analytics';

interface AdoptionHistoryCardProps {
  /** Closed (terminal) adoptions only, oldest first. */
  adoptions: Adoption[];
  /** Whether the viewer may reopen a lost (unsuccessfully closed) adoption.
   *  Defaults to true. */
  canManage?: boolean;
  /** Reopening only makes sense while the animal is still in care with no
   *  other adoption in progress — the caller knows both. */
  allowReopen?: boolean;
}

// Badge tones match the status pills on the Adoptions page.
function outcomeBadgeClasses(a: Adoption): string {
  if (a.status === 'completed') return 'bg-[#DDEFE2] text-[#3E7B52]';
  if (a.status === 'returned') return 'bg-[#E8DEEC] text-[#6E4E80]';
  return 'bg-[#E0E0E0] text-[#555555]';
}

function closedAt(a: Adoption): string {
  return a.returned_at ?? a.cancelled_at ?? a.completed_at ?? a.created_at;
}

// Compact, collapsed-by-default history of an animal's closed adoptions.
// Closed adoptions are part of the animal's story but rarely actionable, so
// each one is a one-line row that expands into its details on click (one at a
// time); row actions (reopen / delete) live in a small overflow menu. The
// in-progress adoption (if any) gets the full AdoptionPanel instead.
export function AdoptionHistoryCard({
  adoptions,
  canManage = true,
  allowReopen = false
}: AdoptionHistoryCardProps) {
  const { peopleIndex, animalsIndex, reopenAdoption } = useWhisker();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<
    {id: string;adopterName: string;} | null>(
    null);
  // Archiving is admin-gated; the server only allows it on lost rows.
  const canArchive = useCanArchive('adoptions', { id: 'na' });

  if (adoptions.length === 0) return null;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        <HeartIcon className="w-4 h-4 text-text-secondary" />
        <h2 className="text-base font-heading font-bold text-text-primary">
          Adoption History ({adoptions.length})
        </h2>
      </div>

      <div className="divide-y divide-border">
        {adoptions.map((a) => {
          const adopter = peopleIndex.find((p) => p.id === a.adopter_id);
          const adopterName = adopter ?
          `${adopter.first_name} ${adopter.last_name}` :
          'Unknown adopter';
          const expanded = expandedId === a.id;
          const donation = formatDonation(a.donation_amount);
          const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;
          const canReopenRow =
          canManage && allowReopen && isLostAdoption(a);
          const canArchiveRow = canArchive && isLostAdoption(a);
          const hasMenu = canReopenRow || canArchiveRow;
          return (
            <div key={a.id}>
              <div className="flex items-center pr-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : a.id)}
                  aria-expanded={expanded}
                  className="flex-1 min-w-0 flex items-center gap-3 px-6 py-3 text-left hover:bg-background/60 transition-colors">

                  <Chevron className="w-4 h-4 text-text-secondary shrink-0" />
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {adopterName}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${outcomeBadgeClasses(
                      a
                    )}`}>

                    {adoptionOutcomeLabel(a)}
                  </span>
                  <span className="ml-auto text-sm text-text-secondary whitespace-nowrap">
                    {formatDate(closedAt(a).split('T')[0])}
                  </span>
                </button>

                {hasMenu &&
                <div className="relative shrink-0">
                    <button
                    type="button"
                    onClick={() => setMenuId(menuId === a.id ? null : a.id)}
                    aria-label="Adoption actions"
                    aria-haspopup="menu"
                    className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors">

                      <MoreHorizontalIcon className="w-4 h-4" />
                    </button>
                    {menuId === a.id &&
                  <>
                        <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuId(null)} />

                        <div
                      role="menu"
                      className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border bg-white shadow-soft-lg py-1">

                          {canReopenRow &&
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuId(null);
                          reopenAdoption(a.id);
                          track('adoption_reopened', {
                            animal_id: a.animal_id
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background text-left">

                              <RotateCcwIcon className="w-4 h-4 text-text-secondary" />
                              Reopen Adoption
                            </button>
                      }
                          {canArchiveRow &&
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuId(null);
                          setArchiving({ id: a.id, adopterName });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#9B3A3A] hover:bg-[#F5D7D7]/60 text-left">

                              <Trash2Icon className="w-4 h-4" />
                              Delete
                            </button>
                      }
                        </div>
                      </>
                  }
                  </div>
                }
              </div>

              {expanded &&
              <div className="px-6 pb-4 pl-[3.25rem] space-y-3">
                  {adoptionAnimalIds(a).length > 1 &&
                <p className="text-sm text-text-secondary">
                      Bonded pair — one application for{' '}
                      <span className="text-text-primary font-medium">
                        {adoptionAnimalIds(a).
                    map((id) => animalsIndex.find((an) => an.id === id)).
                    filter(Boolean).
                    map((an) => animalDisplayName(an!)).
                    join(' & ')}
                      </span>
                    </p>
                }
                  {(adopter || donation) &&
                <p className="text-sm">
                      {donation &&
                  <span className="text-text-secondary">
                          Donation {donation}
                          {adopter && ' · '}
                        </span>
                  }
                      {adopter &&
                  <Link
                    to={`/contacts/${adopter.id}`}
                    className="font-medium text-primary hover:underline">

                          View Contact
                        </Link>
                  }
                    </p>
                }

                  <div className="space-y-2">
                    {adoptionMilestones(a).map((m) =>
                  <div
                    key={m.label}
                    className="flex items-center gap-2 text-sm">

                        <CheckCircle2Icon className="w-4 h-4 text-[#3E7B52] shrink-0" />
                        <span className="text-text-primary">{m.label}</span>
                        <span className="text-text-secondary">
                          · {formatDate(m.at!.split('T')[0])}
                        </span>
                      </div>
                  )}
                  </div>

                  {a.notes &&
                <p className="text-sm text-text-secondary leading-relaxed">
                      {a.notes}
                    </p>
                }
                </div>
              }
            </div>);

        })}
      </div>

      {archiving &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchiving(null)}
        table="adoptions"
        id={archiving.id}
        typeLabel="adoption"
        entityLabel={`closed adoption (${archiving.adopterName})`} />
      }
    </Card>);

}
