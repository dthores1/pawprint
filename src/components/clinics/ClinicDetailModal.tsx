import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Label, Input } from '../ui/Forms';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { AnimalSearchPicker } from '../ui/AnimalSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import {
  ClinicSlotProcedure,
  ClinicSlotProcedureType,
  ClinicSlotStatus,
  ClinicEventStatus } from
'../../types';
import { cn, formatDate } from '../../lib/utils';
import {
  StethoscopeIcon,
  MapPinIcon,
  UserIcon,
  TruckIcon,
  ClipboardListIcon,
  PlusIcon,
  CheckIcon,
  XIcon,
  Trash2Icon } from
'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clinicEventId: string | null;
}
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
// Stable display order for the procedure chips / picker.
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

export function ClinicDetailModal({ isOpen, onClose, clinicEventId }: Props) {
  const {
    clinicEvents,
    clinicSlots,
    clinicSlotProcedures,
    animals,
    people,
    addClinicSlot,
    updateClinicSlot,
    deleteClinicSlot,
    addClinicSlotProcedure,
    updateClinicSlotProcedure,
    deleteClinicSlotProcedure
  } = useWhisker();
  const { currentPersonId } = useAuth();

  const [adding, setAdding] = useState(false);
  const [newAnimalId, setNewAnimalId] = useState('');
  const [newProcedures, setNewProcedures] = useState<ClinicSlotProcedureType[]>([
  'spay_neuter']
  );
  const [newNotes, setNewNotes] = useState('');

  if (!clinicEventId) return null;
  const event = clinicEvents.find((e) => e.id === clinicEventId);
  if (!event) return null;

  const slots = clinicSlots.filter((s) => s.clinic_event_id === clinicEventId);
  const filled = slots.filter(
    (s) => s.status !== 'canceled' && s.status !== 'no_show'
  ).length;
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

  // Animals not already in a slot at this clinic.
  const animalsAvailable = animals.filter(
    (a) => !slots.some((s) => s.animal_id === a.id && s.status !== 'canceled')
  );

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnimalId || newProcedures.length === 0) return;
    addClinicSlot(
      {
        clinic_event_id: clinicEventId,
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clinic Details"
      className="max-w-3xl">

      <div className="space-y-6">
        {/* Header summary */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-xl font-heading font-bold text-text-primary flex items-center gap-2">
                <StethoscopeIcon className="w-5 h-5 text-primary" />
                {formatDate(event.date_time)}
              </h3>
              <p className="text-text-secondary text-sm mt-1">
                {new Date(event.date_time).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                EVENT_STATUS_PILL[event.status]
              )}>

              {EVENT_STATUS_LABEL[event.status]}
            </span>
          </div>
          <div className="text-sm text-text-secondary flex items-start gap-2">
            <MapPinIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{event.location}</span>
          </div>
        </div>

        {/* Roles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RoleCard
            icon={UserIcon}
            label="Veterinarian"
            value={vet ? `${vet.first_name} ${vet.last_name}` : 'Unassigned'}
            sub={vet?.organization_name} />

          <RoleCard
            icon={ClipboardListIcon}
            label="Clinic contact"
            value={
            contact ? `${contact.first_name} ${contact.last_name}` : '—'
            } />

          <RoleCard
            icon={TruckIcon}
            label="Transport coordinator"
            value={
            transportCoord ?
            `${transportCoord.first_name} ${transportCoord.last_name}` :
            '—'
            } />

          <RoleCard
            icon={ClipboardListIcon}
            label="Intake coordinator"
            value={
            intakeCoord ?
            `${intakeCoord.first_name} ${intakeCoord.last_name}` :
            '—'
            } />

        </div>

        {event.notes &&
        <div className="bg-[#F3E4D7]/30 p-4 rounded-xl text-sm text-text-primary border border-[#D98C5F]/20">
            {event.notes}
          </div>
        }

        {/* Slots */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-text-primary">
              Slots
              <span className="text-text-secondary font-normal text-sm ml-2">
                {filled} of {event.slot_capacity} filled
              </span>
            </h4>
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
                      <p className="font-medium text-text-primary truncate">
                        {animal?.name || 'Unknown'}
                      </p>
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
                    {/*
                      Native <select> here (not the Forms Select primitive) so
                      we can hold a compact pill shape. The primitive ships
                      `w-full` which can't be overridden by a w-auto utility —
                      Tailwind generates w-full after w-auto, so source order
                      makes w-full win.
                    */}
                    <select
                    value={s.status}
                    onChange={(e) =>
                    updateClinicSlot(s.id, {
                      status: e.target.value as ClinicSlotStatus
                    })
                    }
                    className={cn(
                      'shrink-0 h-7 text-xs font-semibold px-2.5 pr-7 rounded-full border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      // Inline SVG chevron so we don't depend on flex layout
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
                    <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remove ${animal?.name || 'this animal'} from this clinic?`)) {
                        deleteClinicSlot(s.id);
                      }
                    }}
                    aria-label="Remove slot"
                    className="shrink-0 p-1.5 rounded-md text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

                      <Trash2Icon className="w-4 h-4" />
                    </button>
                  </div>);

            })}
            </div>
          }
        </div>
      </div>
    </Modal>);

}

// Per-slot procedure chips: click a chip to toggle done, × to remove, "+ Add"
// to attach another procedure type not already on the slot.
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

interface RoleCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}
function RoleCard({ icon: Icon, label, value, sub }: RoleCardProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-border">
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
    </div>);

}
