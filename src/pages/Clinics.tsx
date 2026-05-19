import React, { useMemo, useState } from 'react';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NewClinicEventModal } from '../components/clinics/NewClinicEventModal';
import { ClinicDetailModal } from '../components/clinics/ClinicDetailModal';
import {
  StethoscopeIcon,
  PlusIcon,
  MapPinIcon,
  UserIcon } from
'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { ClinicEvent, ClinicEventStatus } from '../types';

const EVENT_STATUS_LABEL: Record<ClinicEventStatus, string> = {
  planning: 'Planning',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  canceled: 'Canceled'
};
const EVENT_STATUS_PILL: Record<ClinicEventStatus, string> = {
  planning: 'bg-[#F8E7C8] text-[#A36B00]',
  scheduled: 'bg-[#DCEAF7] text-[#356A9A]',
  in_progress: 'bg-[#E8DEEC] text-[#6E4E80]',
  completed: 'bg-[#DDEFE2] text-[#3E7B52]',
  canceled: 'bg-[#F5D7D7] text-[#9B3A3A]'
};

export function Clinics() {
  const { clinicEvents, clinicSlots, people } = useWhisker();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const sorted = [...clinicEvents].sort(
      (a, b) =>
      new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
    );
    return {
      upcoming: sorted.filter(
        (e) =>
        new Date(e.date_time).getTime() >= now && e.status !== 'canceled'
      ),
      past: sorted.
      filter(
        (e) =>
        new Date(e.date_time).getTime() < now || e.status === 'canceled'
      ).
      reverse()
    };
  }, [clinicEvents, now]);

  const display = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <StethoscopeIcon className="w-8 h-8 text-primary" />
            Clinics
          </h1>
          <p className="text-text-secondary mt-1">
            Plan spay/neuter and vaccine clinics. Assign cats to slots.
          </p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2">
          <PlusIcon className="w-4 h-4" />
          New Clinic
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('upcoming')}
          className={cn(
            'px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            tab === 'upcoming' ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>

          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setTab('past')}
          className={cn(
            'px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            tab === 'past' ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>

          Past ({past.length})
        </button>
      </div>

      {display.length === 0 ?
      <Card className="p-10 text-center text-text-secondary">
          <StethoscopeIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            {tab === 'upcoming' ? 'No upcoming clinics' : 'No past clinics'}
          </p>
          {tab === 'upcoming' &&
        <p className="text-sm">
              Create a clinic when the next vet date is set.
            </p>
        }
        </Card> :

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {display.map((e) => {
          const vet = e.veterinarian_person_id ?
          people.find((p) => p.id === e.veterinarian_person_id) :
          undefined;
          const slotsForEvent = clinicSlots.filter(
            (s) =>
            s.clinic_event_id === e.id &&
            s.status !== 'canceled'
          );
          return (
            <ClinicEventCard
              key={e.id}
              event={e}
              vetName={vet ? `${vet.first_name} ${vet.last_name}` : undefined}
              slotsFilled={slotsForEvent.length}
              onOpen={() => setSelectedId(e.id)} />);


        })}
        </div>
      }

      <NewClinicEventModal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)} />

      <ClinicDetailModal
        isOpen={selectedId !== null}
        onClose={() => setSelectedId(null)}
        clinicEventId={selectedId} />

    </div>);

}

interface ClinicEventCardProps {
  event: ClinicEvent;
  vetName?: string;
  slotsFilled: number;
  onOpen: () => void;
}
function ClinicEventCard({
  event,
  vetName,
  slotsFilled,
  onOpen
}: ClinicEventCardProps) {
  const date = new Date(event.date_time);
  const dayLabel = date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  const percentFilled = Math.min(
    100,
    Math.round((slotsFilled / Math.max(1, event.slot_capacity)) * 100)
  );
  return (
    <Card
      className="p-5 cursor-pointer hover:shadow-soft-lg transition-shadow"
      onClick={onOpen}>

      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-lg font-heading font-bold text-text-primary">
            {dayLabel}
          </h3>
          <p className="text-sm text-text-secondary">{timeLabel}</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0',
            EVENT_STATUS_PILL[event.status]
          )}>

          {EVENT_STATUS_LABEL[event.status]}
        </span>
      </div>

      <div className="space-y-1.5 text-sm text-text-secondary mb-3">
        <div className="flex items-start gap-2">
          <MapPinIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="truncate">{event.location}</span>
        </div>
        {vetName &&
        <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 shrink-0" />
            <span>{vetName}</span>
          </div>
        }
      </div>

      {/* Capacity bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
          <span>Slot capacity</span>
          <span className="tabular-nums font-medium text-text-primary">
            {slotsFilled} / {event.slot_capacity}
          </span>
        </div>
        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all duration-500 bg-primary"
            style={{ width: `${percentFilled}%` }} />

        </div>
      </div>
    </Card>);

}
