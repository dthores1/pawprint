import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { useAuth } from '../context/AuthContext';
import { ArchiveConfirmDialog } from '../components/archive/ArchiveConfirmDialog';
import { useCanArchive } from '../components/archive/useCanArchive';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Label, Input } from '../components/ui/Forms';
import { AnimalSearchPicker } from '../components/ui/AnimalSearchPicker';
import { AddressDisplay } from '../components/ui/AddressDisplay';
import { EditClinicEventModal } from '../components/clinics/EditClinicEventModal';
import { ClinicCompletionModal } from '../components/clinics/ClinicCompletionModal';
import {
  ClinicEventStatus,
  ClinicSlotStatus,
  ClinicSlotProcedure,
  ClinicSlotProcedureType } from
'../types';
import { cn, formatDate } from '../lib/utils';
import {
  ArrowLeftIcon,
  StethoscopeIcon,
  MapPinIcon,
  UserIcon,
  TruckIcon,
  ClipboardListIcon,
  PlusIcon,
  CheckIcon,
  XIcon,
  Trash2Icon,
  Edit2Icon,
  CheckCircle2Icon,
  UsersIcon } from
'lucide-react';

const PROCEDURE_LABEL: Record<ClinicSlotProcedureType, string> = {
  spay_neuter: 'Spay/Neuter',
  vaccines: 'Vaccines',
  dental: 'Dental',
  exam: 'Exam',
  recheck: 'Recheck',
  flea_treatment: 'Flea Treatment',
  deworming: 'Deworming',
  microchip: 'Microchip',
  other: 'Other'
};
const PROCEDURE_ORDER: ClinicSlotProcedureType[] = [
'spay_neuter',
'vaccines',
'flea_treatment',
'deworming',
'microchip',
'dental',
'exam',
'recheck',
'other'];

const SLOT_STATUS_LABEL: Record<ClinicSlotStatus, string> = {
  reserved: 'Reserved',
  confirmed: 'Confirmed',
  completed: 'Completed',
  no_show: 'No-show',
  canceled: 'Canceled'
};
const SLOT_STATUS_PILL: Record<ClinicSlotStatus, string> = {
  reserved: 'bg-[#E5E2DC] text-[#6B6B6B]',
  confirmed: 'bg-[#DCEAF7] text-[#356A9A]',
  completed: 'bg-[#DDEFE2] text-[#3E7B52]',
  no_show: 'bg-[#F5D7D7] text-[#9B3A3A]',
  canceled: 'bg-background text-text-secondary border border-border'
};
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

export function ClinicProfile() {
  const { id } = useParams<{id: string;}>();
  const {
    clinicEvents,
    clinicSlots,
    clinicSlotProcedures,
    animals,
    people,
    addClinicSlot,
    updateClinicSlot,
    addClinicSlotProcedure,
    updateClinicSlotProcedure,
    deleteClinicSlotProcedure
  } = useWhisker();
  const { currentPersonId } = useAuth();

  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newAnimalId, setNewAnimalId] = useState('');
  const [newProcedures, setNewProcedures] = useState<ClinicSlotProcedureType[]>([
  'spay_neuter']
  );
  const [newNotes, setNewNotes] = useState('');
  const navigate = useNavigate();

  const event = clinicEvents.find((e) => e.id === id);
  if (!event) {
    return (
      <div className="p-8 text-center text-text-secondary">
        Clinic not found. <Link to="/clinics" className="text-primary">Back to Clinics</Link>
      </div>);

  }

  const slots = clinicSlots.filter((s) => s.clinic_event_id === event.id);
  const filled = slots.filter(
    (s) => s.status !== 'canceled' && s.status !== 'no_show'
  ).length;
  const percentFilled = Math.min(
    100,
    Math.round(filled / Math.max(1, event.slot_capacity) * 100)
  );

  const vet = event.veterinarian_person_id ?
  people.find((p) => p.id === event.veterinarian_person_id) :
  undefined;
  const contact = event.contact_person_id ?
  people.find((p) => p.id === event.contact_person_id) :
  undefined;
  const transportCoord = event.transport_coordinator_person_id ?
  people.find((p) => p.id === event.transport_coordinator_person_id) :
  undefined;
  const intakeCoord = event.intake_coordinator_person_id ?
  people.find((p) => p.id === event.intake_coordinator_person_id) :
  undefined;

  const animalsAvailable = animals.filter(
    (a) => !slots.some((s) => s.animal_id === a.id && s.status !== 'canceled')
  );

  const canComplete =
  (event.status === 'scheduled' || event.status === 'in_progress') &&
  slots.length > 0;

  // Clinic archives are admin-only and gated to states where it's safe to
  // remove from active workflows (planning / completed / canceled). The
  // server enforces the same rule; this just hides the button.
  const canArchive =
  useCanArchive('clinic_events', { id: event.id }) &&
  event.status !== 'scheduled' &&
  event.status !== 'in_progress';
  // Per-slot archive is admin-only and blocked while the clinic is running.
  // Same gate the server applies; we just hide the icon proactively.
  const canArchiveSlot =
  useCanArchive('clinic_slots', { id: 'na' }) &&
  event.status !== 'in_progress';
  const [archivingSlot, setArchivingSlot] = useState<
    {id: string;animalName: string;} | null>(
    null);

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnimalId || newProcedures.length === 0) return;
    addClinicSlot(
      {
        clinic_event_id: event.id,
        animal_id: newAnimalId,
        reserved_by_person_id: currentPersonId ?? undefined,
        status: 'reserved',
        notes: newNotes.trim() || undefined
      },
      newProcedures
    );
    setNewAnimalId('');
    setNewProcedures(['spay_neuter']);
    setNewNotes('');
    setAdding(false);
  };
  const toggleNewProcedure = (p: ClinicSlotProcedureType) =>
  setNewProcedures((prev) =>
  prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
  );

  const dateLabel = formatDate(event.date_time);
  const timeLabel = new Date(event.date_time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/clinics"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">

          <ArrowLeftIcon className="w-4 h-4" /> Back to Clinics
        </Link>
        <div className="flex items-center gap-2">
          {canComplete &&
          <Button size="sm" onClick={() => setCompleting(true)}>
              <CheckCircle2Icon className="w-4 h-4 mr-2" />
              Complete Clinic
            </Button>
          }
          <Button variant="soft" size="sm" onClick={() => setEditing(true)}>
            <Edit2Icon className="w-4 h-4 mr-2" /> Edit
          </Button>
          {canArchive &&
          <button
            type="button"
            onClick={() => setArchiving(true)}
            aria-label="Archive clinic"
            title="Archive clinic"
            className="p-2 rounded-lg text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

              <Trash2Icon className="w-4 h-4" />
            </button>
          }
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — summary */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                <StethoscopeIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-heading font-bold text-text-primary leading-tight">
                  {dateLabel}
                </h1>
                <p className="text-text-secondary text-sm">{timeLabel}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  EVENT_STATUS_PILL[event.status]
                )}>

                {EVENT_STATUS_LABEL[event.status]}
              </span>
            </div>

            <div className="space-y-3 pt-4 border-t border-border text-sm">
              <div className="flex items-start gap-3">
                <MapPinIcon className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
                {event.location_address ?
                <AddressDisplay value={event.location_address} /> :
                <span className="text-text-primary">{event.location}</span>
                }
              </div>
              <div className="flex items-start gap-3">
                <UsersIcon className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                    <span>Slot capacity</span>
                    <span className="tabular-nums font-medium text-text-primary">
                      {filled} / {event.slot_capacity}
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500 bg-primary"
                      style={{ width: `${percentFilled}%` }} />

                  </div>
                </div>
              </div>
            </div>
          </Card>

          {event.notes &&
          <Card className="p-6">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Notes
              </h3>
              <p className="text-text-primary text-sm whitespace-pre-wrap leading-relaxed">
                {event.notes}
              </p>
            </Card>
          }
        </div>

        {/* Right column — roles + slots */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-heading font-bold text-text-primary mb-4">
              Roles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RoleCard
                icon={UserIcon}
                label="Veterinarian"
                value={vet ? `${vet.first_name} ${vet.last_name}` : 'Unassigned'}
                sub={vet?.organization_name}
                personId={vet?.id} />

              <RoleCard
                icon={ClipboardListIcon}
                label="Clinic contact"
                value={contact ? `${contact.first_name} ${contact.last_name}` : '—'}
                personId={contact?.id} />

              <RoleCard
                icon={TruckIcon}
                label="Transport coordinator"
                value={
                transportCoord ?
                `${transportCoord.first_name} ${transportCoord.last_name}` :
                '—'
                }
                personId={transportCoord?.id} />

              <RoleCard
                icon={ClipboardListIcon}
                label="Intake coordinator"
                value={
                intakeCoord ?
                `${intakeCoord.first_name} ${intakeCoord.last_name}` :
                '—'
                }
                personId={intakeCoord?.id} />

            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-text-primary">
                Slots
                <span className="text-text-secondary font-normal text-sm ml-2">
                  {filled} of {event.slot_capacity} filled
                </span>
              </h2>
              {!adding && filled < event.slot_capacity &&
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Animal
                </Button>
              }
            </div>

            {adding &&
            <form
              onSubmit={handleAddSlot}
              className="p-4 border border-border rounded-xl bg-background/60 mb-3 space-y-3">

                <div>
                  <Label htmlFor="add_animal">Animal</Label>
                  <AnimalSearchPicker
                  id="add_animal"
                  animals={animalsAvailable}
                  value={newAnimalId}
                  onChange={setNewAnimalId} />

                </div>
                <div>
                  <Label>Procedures</Label>
                  <div className="flex flex-wrap gap-2">
                    {PROCEDURE_ORDER.map((p) => {
                    const active = newProcedures.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleNewProcedure(p)}
                        aria-pressed={active}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                          active ?
                          'bg-primary text-white border-primary' :
                          'bg-white text-text-secondary border-border hover:border-primary/50'
                        )}>

                          {PROCEDURE_LABEL[p]}
                        </button>);

                  })}
                  </div>
                  {newProcedures.length === 0 &&
                <p className="mt-1.5 text-xs text-[#9B3A3A]">
                      Pick at least one procedure.
                    </p>
                }
                </div>
                <div>
                  <Label htmlFor="add_notes">Notes (optional)</Label>
                  <Input
                  id="add_notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)} />

                </div>
                <div className="flex justify-end gap-2">
                  <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdding(false)}>

                    Cancel
                  </Button>
                  <Button
                  type="submit"
                  size="sm"
                  disabled={!newAnimalId || newProcedures.length === 0}>

                    Reserve Slot
                  </Button>
                </div>
              </form>
            }

            {slots.length === 0 ?
            <p className="text-sm text-text-secondary text-center py-6">
                No animals assigned yet.
              </p> :

            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                {slots.map((s) => {
                const animal = animals.find((a) => a.id === s.animal_id);
                return (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-background/40 transition-colors">

                      <div className="shrink-0 mt-0.5">
                        <Avatar
                        src={animal?.primary_photo_url}
                        type="animal"
                        species={animal?.species}
                        size="sm" />

                      </div>
                      <div className="flex-1 min-w-0">
                        {animal ?
                      <Link
                        to={`/animals/${animal.id}`}
                        className="font-medium text-text-primary truncate hover:text-primary transition-colors">

                            {animal.name}
                          </Link> :

                      <p className="font-medium text-text-primary truncate">
                            Unknown
                          </p>
                      }
                        <SlotProcedureChips
                        procedures={clinicSlotProcedures.filter(
                          (p) => p.clinic_slot_id === s.id
                        )}
                        onToggle={(proc) =>
                        updateClinicSlotProcedure(proc.id, {
                          completed: !proc.completed
                        })
                        }
                        onRemove={(proc) => deleteClinicSlotProcedure(proc.id)}
                        onAdd={(type) => addClinicSlotProcedure(s.id, type)} />

                        {s.notes &&
                      <p className="text-xs text-text-secondary italic mt-1.5 truncate">
                            {s.notes}
                          </p>
                      }
                      </div>
                      <select
                      value={s.status}
                      onChange={(e) =>
                      updateClinicSlot(s.id, {
                        status: e.target.value as ClinicSlotStatus
                      })
                      }
                      className={cn(
                        'shrink-0 h-7 text-xs font-semibold px-2.5 pr-7 rounded-full border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        'bg-[length:0.65em_0.65em] bg-no-repeat bg-[right_0.5rem_center]',
                        "bg-[url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")]",
                        SLOT_STATUS_PILL[s.status]
                      )}>

                        {(Object.keys(SLOT_STATUS_LABEL) as ClinicSlotStatus[]).
                      map((k) =>
                      <option key={k} value={k}>
                              {SLOT_STATUS_LABEL[k]}
                            </option>
                      )}
                      </select>
                      {canArchiveSlot &&
                    <button
                      type="button"
                      onClick={() =>
                      setArchivingSlot({
                        id: s.id,
                        animalName: animal?.name || 'this animal'
                      })
                      }
                      aria-label="Archive slot"
                      title="Archive slot"
                      className="shrink-0 p-1.5 rounded-md text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    }
                    </div>);

              })}
              </div>
            }
          </Card>
        </div>
      </div>

      <EditClinicEventModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        event={event} />


      <ClinicCompletionModal
        isOpen={completing}
        onClose={() => setCompleting(false)}
        clinicEventId={event.id} />

      {archiving &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchiving(false)}
        table="clinic_events"
        id={event.id}
        typeLabel="clinic"
        entityLabel={`${formatDate(event.date_time)} clinic`}
        onArchived={() => navigate('/clinics')} />

      }
      {archivingSlot &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchivingSlot(null)}
        table="clinic_slots"
        id={archivingSlot.id}
        typeLabel="slot"
        entityLabel={`${archivingSlot.animalName}'s slot`} />

      }
    </div>);

}

interface RoleCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  personId?: string;
}
function RoleCard({ icon: Icon, label, value, sub, personId }: RoleCardProps) {
  const body =
  <>
      <div className="p-1.5 rounded-lg bg-card text-text-secondary shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-text-secondary">
          {label}
        </p>
        <p className="font-medium text-text-primary truncate">{value}</p>
        {sub && <p className="text-xs text-text-secondary truncate">{sub}</p>}
      </div>
    </>;

  if (personId) {
    return (
      <Link
        to={`/contacts/${personId}`}
        className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-border hover:border-primary/40 transition-colors">

        {body}
      </Link>);

  }
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-border">
      {body}
    </div>);

}

function SlotProcedureChips({
  procedures,
  onToggle,
  onRemove,
  onAdd
}: {
  procedures: ClinicSlotProcedure[];
  onToggle: (proc: ClinicSlotProcedure) => void;
  onRemove: (proc: ClinicSlotProcedure) => void;
  onAdd: (type: ClinicSlotProcedureType) => void;
}) {
  const present = new Set(procedures.map((p) => p.procedure_type));
  const addable = PROCEDURE_ORDER.filter((t) => !present.has(t));
  const ordered = [...procedures].sort(
    (a, b) =>
    PROCEDURE_ORDER.indexOf(a.procedure_type) -
    PROCEDURE_ORDER.indexOf(b.procedure_type)
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {ordered.map((proc) =>
      <span
        key={proc.id}
        className={cn(
          'inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium border transition-colors',
          proc.completed ?
          'bg-status-adoptable-bg text-status-adoptable-text border-transparent' :
          'bg-white text-text-secondary border-border'
        )}>

          <button
          type="button"
          onClick={() => onToggle(proc)}
          title={proc.completed ? 'Mark as not done' : 'Mark as done'}
          className="inline-flex items-center gap-1">

            {proc.completed && <CheckIcon className="w-3 h-3" />}
            {PROCEDURE_LABEL[proc.procedure_type]}
          </button>
          <button
          type="button"
          onClick={() => onRemove(proc)}
          aria-label={`Remove ${PROCEDURE_LABEL[proc.procedure_type]}`}
          className="rounded-full p-0.5 text-text-secondary/70 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

            <XIcon className="w-3 h-3" />
          </button>
        </span>
      )}
      {addable.length > 0 &&
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onAdd(e.target.value as ClinicSlotProcedureType);
          }
        }}
        aria-label="Add procedure"
        className="h-6 text-xs rounded-full border border-dashed border-border bg-white px-2 text-text-secondary cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary">

          <option value="">+ Add</option>
          {addable.map((t) =>
        <option key={t} value={t}>
              {PROCEDURE_LABEL[t]}
            </option>
        )}
        </select>
      }
    </div>);

}
