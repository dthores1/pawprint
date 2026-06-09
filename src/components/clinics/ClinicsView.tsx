import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { StethoscopeIcon, MapPinIcon, UserIcon, CheckCircle2Icon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ExportButton } from '../ui/ExportButton';
import { CsvColumn } from '../../lib/csv';
import { ClinicEvent, ClinicEventStatus } from '../../types';

// Any not-yet-finished clinic can be marked complete (including Planning —
// people don't always advance the status). Empty clinics are allowed too, since
// attendees can be added during the completion flow.
function isCompletable(status: ClinicEventStatus): boolean {
  return status !== 'completed' && status !== 'cancelled';
}

const EVENT_STATUS_LABEL: Record<ClinicEventStatus, string> = {
  planning: 'Planning',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled'
};
const EVENT_STATUS_PILL: Record<ClinicEventStatus, string> = {
  planning: 'bg-[#F8E7C8] text-[#A36B00]',
  scheduled: 'bg-[#DCEAF7] text-[#356A9A]',
  in_progress: 'bg-[#E8DEEC] text-[#6E4E80]',
  completed: 'bg-[#DDEFE2] text-[#3E7B52]',
  cancelled: 'bg-[#F5D7D7] text-[#9B3A3A]'
};

export function ClinicsView() {
  const { clinicEvents, clinicSlots, peopleIndex: people } = useWhisker();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const navigate = useNavigate();

  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const sorted = [...clinicEvents].sort(
      (a, b) =>
      new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
    );
    return {
      upcoming: sorted.filter(
        (e) =>
        new Date(e.date_time).getTime() >= now && e.status !== 'cancelled'
      ),
      past: sorted.
      filter(
        (e) =>
        new Date(e.date_time).getTime() < now || e.status === 'cancelled'
      ).
      reverse()
    };
  }, [clinicEvents, now]);

  const display = tab === 'upcoming' ? upcoming : past;

  const filledFor = (e: ClinicEvent) =>
  clinicSlots.filter(
    (s) => s.clinic_event_id === e.id && s.status !== 'cancelled'
  ).length;
  const vetNameFor = (e: ClinicEvent) => {
    const v = e.veterinarian_person_id ?
    people.find((p) => p.id === e.veterinarian_person_id) :
    undefined;
    return v ? `${v.first_name} ${v.last_name}` : '';
  };

  // CSV export columns for the current (Upcoming/Past) clinics view.
  const clinicCsvColumns: CsvColumn<ClinicEvent>[] = [
  { header: 'Date', value: (e) =>
      new Date(e.date_time).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      }) },
  { header: 'Time', value: (e) =>
      new Date(e.date_time).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit'
      }) },
  { header: 'Location', value: (e) => e.location },
  { header: 'Address', value: (e) => e.location_address },
  { header: 'Veterinarian', value: (e) => vetNameFor(e) },
  { header: 'Status', value: (e) => EVENT_STATUS_LABEL[e.status] },
  { header: 'Slots Filled', value: (e) => filledFor(e) },
  { header: 'Slot Capacity', value: (e) => e.slot_capacity },
  { header: 'Notes', value: (e) => e.notes }];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 border-b border-border">
        <div className="flex gap-2">
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
        <ExportButton
          entityLabel="Clinics"
          noun="clinics"
          filenameBase="clinics"
          columns={clinicCsvColumns}
          current={display}
          allRows={clinicEvents}
          allCount={clinicEvents.length}
          triggerClassName="h-9 text-sm px-3 mb-1" />
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
            s.status !== 'cancelled'
          );
          return (
            <ClinicEventCard
              key={e.id}
              event={e}
              vetName={vet ? `${vet.first_name} ${vet.last_name}` : undefined}
              slotsFilled={slotsForEvent.length}
              onMarkComplete={() => navigate(`/clinics/${e.id}/complete`)} />);


        })}
        </div>
      }
    </div>);

}

interface ClinicEventCardProps {
  event: ClinicEvent;
  vetName?: string;
  slotsFilled: number;
  onMarkComplete: () => void;
}
function ClinicEventCard({
  event,
  vetName,
  slotsFilled,
  onMarkComplete
}: ClinicEventCardProps) {
  const completable = isCompletable(event.status);
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
    Math.round(slotsFilled / Math.max(1, event.slot_capacity) * 100)
  );
  return (
    <Link to={`/clinics/${event.id}`} className="block">
      <Card className="p-5 cursor-pointer hover:shadow-soft-lg transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="text-lg font-heading font-bold text-text-primary">
              {dayLabel}
            </h3>
            <p className="text-sm text-text-secondary">{timeLabel}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                EVENT_STATUS_PILL[event.status]
              )}>

              {EVENT_STATUS_LABEL[event.status]}
            </span>
            {completable &&
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMarkComplete();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">

                <CheckCircle2Icon className="w-3.5 h-3.5" />
                Mark Complete
              </button>
            }
          </div>
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
      </Card>
    </Link>);

}
