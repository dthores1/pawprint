import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { UpdateAdoptionModal } from './UpdateAdoptionModal';
import { CompleteAdoptionModal } from './CompleteAdoptionModal';
import {
  HeartIcon,
  CheckCircle2Icon,
  CircleIcon,
  Edit2Icon,
  XIcon } from
'lucide-react';
import { formatDate } from '../../lib/utils';
import {
  ADOPTION_STATUS_LABELS,
  adoptionMilestones,
  formatDonation } from
'../../lib/adoptions';

interface AdoptionPanelProps {
  adoptionId: string;
}

// Shown on the animal profile while an adoption is active (not completed /
// cancelled). Surfaces the adopter, status, milestones, and the workflow actions.
export function AdoptionPanel({ adoptionId }: AdoptionPanelProps) {
  const { adoptions, people, cancelAdoption } = useWhisker();
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);

  const adoption = adoptions.find((a) => a.id === adoptionId);
  if (!adoption) return null;
  const adopter = people.find((p) => p.id === adoption.adopter_id);
  const milestones = adoptionMilestones(adoption);
  const donation = formatDonation(adoption.donation_amount);
  const readyToComplete = adoption.status === 'ready_for_placement';

  const handleCancel = () => {
    if (
    window.confirm(
      'Cancel this adoption? The record is kept in history; the animal is not marked adopted.'
    ))
    {
      cancelAdoption(adoption.id);
    }
  };

  return (
    <Card className="p-6 border-l-4 border-l-[#D98C5F]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-xl font-heading font-bold flex items-center gap-2">
          <HeartIcon className="w-5 h-5 text-[#D98C5F]" />
          Adoption in Progress
        </h2>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#F3E4D7] text-[#B8632E] shrink-0">
          {ADOPTION_STATUS_LABELS[adoption.status]}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-sm text-text-secondary">Adopter</p>
          {adopter ?
          <Link
            to={`/contacts/${adopter.id}`}
            className="font-medium text-primary hover:underline">

              {adopter.first_name} {adopter.last_name}
            </Link> :

          <p className="font-medium text-text-primary">Unknown</p>
          }
        </div>
        <div>
          <p className="text-sm text-text-secondary">Started</p>
          <p className="font-medium text-text-primary">
            {formatDate(adoption.created_at.split('T')[0])}
          </p>
        </div>
        {donation &&
        <div>
            <p className="text-sm text-text-secondary">Donation</p>
            <p className="font-medium text-text-primary">{donation}</p>
          </div>
        }
      </div>

      {/* Milestones reached so far */}
      <div className="space-y-2 mb-5">
        {milestones.map((m) =>
        <div key={m.label} className="flex items-center gap-2 text-sm">
            <CheckCircle2Icon className="w-4 h-4 text-[#3E7B52] shrink-0" />
            <span className="text-text-primary">{m.label}</span>
            <span className="text-text-secondary">
              · {formatDate(m.at!.split('T')[0])}
            </span>
          </div>
        )}
        {!readyToComplete &&
        <div className="flex items-center gap-2 text-sm text-text-secondary">
            <CircleIcon className="w-4 h-4 shrink-0" />
            <span>Next: {ADOPTION_STATUS_LABELS[adoption.status]}</span>
          </div>
        }
      </div>

      {adoption.notes &&
      <p className="text-sm text-text-secondary mb-5 leading-relaxed">
          {adoption.notes}
        </p>
      }

      <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
        {readyToComplete &&
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCompleteOpen(true)}>

            <CheckCircle2Icon className="w-4 h-4 mr-2" />
            Complete Adoption
          </Button>
        }
        <Button variant="soft" size="sm" onClick={() => setIsUpdateOpen(true)}>
          <Edit2Icon className="w-4 h-4 mr-1.5" />
          Update
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="text-[#9B3A3A] hover:bg-[#F5D7D7]/60 hover:text-[#9B3A3A]">

          <XIcon className="w-4 h-4 mr-1.5" />
          Cancel Adoption
        </Button>
      </div>

      <UpdateAdoptionModal
        isOpen={isUpdateOpen}
        adoptionId={adoption.id}
        onClose={() => setIsUpdateOpen(false)} />

      <CompleteAdoptionModal
        isOpen={isCompleteOpen}
        adoptionId={adoption.id}
        onClose={() => setIsCompleteOpen(false)} />

    </Card>);

}
