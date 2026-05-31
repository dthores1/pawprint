import React, { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Textarea } from '../ui/Forms';
import { useWhisker } from '../../context/WhiskerContext';
import {
  ClinicSlotProcedureType,
  ClinicSlotStatus,
  ProcedureType } from
'../../types';
import { cn, formatDate } from '../../lib/utils';
import {
  CheckIcon,
  CheckCircle2Icon,
  XCircleIcon,
  CalendarOffIcon,
  AlertTriangleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  StethoscopeIcon } from
'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clinicEventId: string | null;
}

type Attendance = 'attended' | 'no_show' | 'canceled';

interface PerSlotState {
  attendance: Attendance;
  /** Existing planned procedure id → whether it was actually completed. */
  plannedCompleted: Record<string, boolean>;
  /** Procedure types added in-flow (not yet persisted). */
  added: ClinicSlotProcedureType[];
  notes: string;
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


// Map a clinic-slot procedure onto the medical record's narrower taxonomy.
// `dental` has no direct medical analog yet, so it falls under `surgery`.
const MEDICAL_TYPE: Record<ClinicSlotProcedureType, ProcedureType> = {
  spay_neuter: 'spay_neuter',
  vaccines: 'vaccine',
  dental: 'surgery',
  exam: 'exam',
  recheck: 'exam',
  flea_treatment: 'medication',
  deworming: 'deworming',
  microchip: 'microchip',
  other: 'exam'
};

const ATTENDANCE_TO_SLOT: Record<Attendance, ClinicSlotStatus> = {
  attended: 'completed',
  no_show: 'no_show',
  canceled: 'canceled'
};

type Step = 1 | 2 | 3;

export function ClinicCompletionModal({ isOpen, onClose, clinicEventId }: Props) {
  const {
    clinicEvents,
    clinicSlots,
    clinicSlotProcedures,
    animals,
    people,
    medicalRecords,
    updateClinicEvent,
    updateClinicSlot,
    updateClinicSlotProcedure,
    addClinicSlotProcedure,
    addMedicalRecord
  } = useWhisker();

  const event = clinicEventId ?
  clinicEvents.find((e) => e.id === clinicEventId) :
  undefined;
  const slots = useMemo(
    () =>
    event ? clinicSlots.filter((s) => s.clinic_event_id === event.id) : [],
    [clinicSlots, event]
  );

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [overrideAllNoShow, setOverrideAllNoShow] = useState(false);

  // Per-slot interactive state, keyed by slot id. Initialised from the
  // current slot/procedure rows the first time the modal opens for this
  // event, then mutated locally until the user confirms in step 3.
  const [state, setState] = useState<Record<string, PerSlotState>>({});
  const [initFor, setInitFor] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !event) return;
    if (initFor === event.id) return;
    const next: Record<string, PerSlotState> = {};
    for (const s of slots) {
      const planned = clinicSlotProcedures.filter(
        (p) => p.clinic_slot_id === s.id
      );
      const plannedCompleted: Record<string, boolean> = {};
      for (const p of planned) {
        plannedCompleted[p.id] = true; // default each planned procedure to completed
      }
      const attendance: Attendance =
      s.status === 'no_show' ? 'no_show' :
      s.status === 'canceled' ? 'canceled' :
      'attended';
      next[s.id] = {
        attendance,
        plannedCompleted,
        added: [],
        notes: ''
      };
    }
    setState(next);
    setStep(1);
    setOverrideAllNoShow(false);
    setInitFor(event.id);
  }, [isOpen, event, slots, clinicSlotProcedures, initFor]);

  if (!event) return null;

  const vet = event.veterinarian_person_id ?
  people.find((p) => p.id === event.veterinarian_person_id) :
  undefined;
  const vetName = vet ? `${vet.first_name} ${vet.last_name}` : undefined;
  const clinicDate = new Date(event.date_time).toISOString().slice(0, 10);

  const setSlot = (slotId: string, patch: Partial<PerSlotState>) =>
  setState((prev) => ({ ...prev, [slotId]: { ...prev[slotId], ...patch } }));

  const togglePlanned = (slotId: string, procId: string) => {
    const cur = state[slotId];
    if (!cur) return;
    setSlot(slotId, {
      plannedCompleted: {
        ...cur.plannedCompleted,
        [procId]: !cur.plannedCompleted[procId]
      }
    });
  };
  const toggleAdded = (slotId: string, type: ClinicSlotProcedureType) => {
    const cur = state[slotId];
    if (!cur) return;
    setSlot(slotId, {
      added: cur.added.includes(type) ?
      cur.added.filter((t) => t !== type) :
      [...cur.added, type]
    });
  };

  const attendingSlots = slots.filter((s) => state[s.id]?.attendance === 'attended');
  const noShowSlots = slots.filter((s) => state[s.id]?.attendance === 'no_show');
  const canceledSlots = slots.filter((s) => state[s.id]?.attendance === 'canceled');

  // Summary numbers for step 3.
  const totalCompletedProcedures = attendingSlots.reduce((sum, s) => {
    const st = state[s.id];
    if (!st) return sum;
    const planned = clinicSlotProcedures.filter(
      (p) => p.clinic_slot_id === s.id
    );
    const checkedPlanned = planned.filter((p) => st.plannedCompleted[p.id]).length;
    return sum + checkedPlanned + st.added.length;
  }, 0);
  const attendingWithoutProcedures = attendingSlots.filter((s) => {
    const st = state[s.id];
    if (!st) return false;
    const planned = clinicSlotProcedures.filter(
      (p) => p.clinic_slot_id === s.id
    );
    const checkedPlanned = planned.filter((p) => st.plannedCompleted[p.id]).length;
    return checkedPlanned + st.added.length === 0;
  });
  const recordsToCreate = totalCompletedProcedures;

  const hasNoAnimals = slots.length === 0;
  const allNoShow =
  slots.length > 0 &&
  attendingSlots.length === 0 &&
  canceledSlots.length === 0;
  const blocksStep1 = hasNoAnimals || allNoShow && !overrideAllNoShow;

  const handleComplete = async () => {
    if (!event) return;
    setSubmitting(true);
    try {
      // 1. Mirror attendance onto slot statuses.
      for (const s of slots) {
        const st = state[s.id];
        if (!st) continue;
        const desired = ATTENDANCE_TO_SLOT[st.attendance];
        if (s.status !== desired) {
          updateClinicSlot(s.id, { status: desired });
        }
      }

      // 2. Sync planned procedure `completed` flags + persist newly added ones.
      for (const s of attendingSlots) {
        const st = state[s.id];
        if (!st) continue;
        const planned = clinicSlotProcedures.filter(
          (p) => p.clinic_slot_id === s.id
        );
        for (const p of planned) {
          const wantCompleted = !!st.plannedCompleted[p.id];
          if (p.completed !== wantCompleted) {
            updateClinicSlotProcedure(p.id, { completed: wantCompleted });
          }
        }
        for (const type of st.added) {
          addClinicSlotProcedure(s.id, type, { completed: true });
        }
      }

      // 3. Create medical records for every completed procedure. Skip any
      //    procedure that already has a medical record tied to this clinic
      //    + animal + type combo, so re-running the flow doesn't duplicate.
      for (const s of attendingSlots) {
        const st = state[s.id];
        if (!st) continue;
        const planned = clinicSlotProcedures.filter(
          (p) => p.clinic_slot_id === s.id
        );
        const completedTypes: ClinicSlotProcedureType[] = [
        ...planned.
        filter((p) => st.plannedCompleted[p.id]).
        map((p) => p.procedure_type),
        ...st.added];

        for (const procType of completedTypes) {
          const medType = MEDICAL_TYPE[procType];
          const alreadyExists = medicalRecords.some(
            (m) =>
            m.clinic_id === event.id &&
            m.animal_id === s.animal_id &&
            m.procedure_type === medType &&
            m.procedure_name === PROCEDURE_LABEL[procType]
          );
          if (alreadyExists) continue;
          addMedicalRecord({
            animal_id: s.animal_id,
            procedure_type: medType,
            procedure_name: PROCEDURE_LABEL[procType],
            performed_date: clinicDate,
            status: 'completed',
            provider_contact_id: event.veterinarian_person_id,
            provider_name: vetName,
            clinic_id: event.id,
            facility_name: event.location,
            notes: st.notes.trim() || undefined
          });
        }
      }

      // 4. Flip the event itself to completed.
      updateClinicEvent(event.id, { status: 'completed' });

      // Reset so the modal re-initialises if reopened against the same event.
      setInitFor(null);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setInitFor(null);
        onClose();
      }}
      title="Complete Clinic"
      className="max-w-3xl">

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-heading font-bold text-text-primary flex items-center gap-2">
              <StethoscopeIcon className="w-5 h-5 text-primary" />
              {formatDate(event.date_time)}
            </h3>
            <p className="text-sm text-text-secondary mt-0.5">{event.location}</p>
          </div>
          <Stepper step={step} />
        </div>

        {step === 1 &&
        <Step1
          slots={slots}
          animals={animals}
          state={state}
          setSlot={setSlot} />

        }

        {step === 2 &&
        <Step2
          attendingSlots={attendingSlots}
          animals={animals}
          procedures={clinicSlotProcedures}
          state={state}
          setSlot={setSlot}
          togglePlanned={togglePlanned}
          toggleAdded={toggleAdded} />

        }

        {step === 3 &&
        <Step3
          attendingSlots={attendingSlots}
          noShowSlots={noShowSlots}
          canceledSlots={canceledSlots}
          attendingWithoutProcedures={attendingWithoutProcedures}
          recordsToCreate={recordsToCreate}
          animals={animals}
          procedures={clinicSlotProcedures}
          state={state} />

        }

        {/* Validation messages */}
        {step === 1 && hasNoAnimals &&
        <ValidationBanner
          icon={AlertTriangleIcon}
          tone="warn"
          message="This clinic has no animals scheduled. Add animals before completing it." />

        }
        {step === 1 && allNoShow && !hasNoAnimals &&
        <div className="rounded-xl border border-[#F8E7C8] bg-[#FFF7E6] p-3 text-sm text-[#A36B00] flex items-start gap-2">
            <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">All animals are marked as No-show.</p>
              <p className="text-xs mt-1">
                Completing will close this clinic without creating any medical records.
              </p>
              <label className="inline-flex items-center gap-2 mt-2 text-xs cursor-pointer">
                <input
                type="checkbox"
                checked={overrideAllNoShow}
                onChange={(e) => setOverrideAllNoShow(e.target.checked)}
                className="rounded border-[#A36B00]" />

                <span>I understand — proceed anyway</span>
              </label>
            </div>
          </div>
        }

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (step === 1) {
                setInitFor(null);
                onClose();
              } else {
                setStep((s) => (s - 1) as Step);
              }
            }}
            disabled={submitting}>

            {step === 1 ?
            'Cancel' :

            <span className="inline-flex items-center gap-1">
                <ChevronLeftIcon className="w-4 h-4" />
                Back
              </span>
            }
          </Button>
          {step < 3 ?
          <Button
            type="button"
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={blocksStep1 || submitting}>

              Next
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Button> :

          <Button
            type="button"
            onClick={handleComplete}
            disabled={submitting}>

              {submitting ? 'Completing…' : 'Complete Clinic'}
            </Button>
          }
        </div>
      </div>
    </Modal>);

}

function Stepper({ step }: {step: Step;}) {
  const labels: [Step, string][] = [
  [1, 'Attendance'],
  [2, 'Procedures'],
  [3, 'Review']];

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {labels.map(([n, label], i) =>
      <React.Fragment key={n}>
          <div
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
            step === n ?
            'bg-primary text-white' :
            step > n ?
            'bg-status-adoptable-bg text-status-adoptable-text' :
            'bg-background text-text-secondary border border-border'
          )}>

            <span
            className={cn(
              'w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold',
              step === n ?
              'bg-white/25' :
              step > n ?
              'bg-status-adoptable-text/15' :
              'bg-card border border-border'
            )}>

              {step > n ? <CheckIcon className="w-2.5 h-2.5" /> : n}
            </span>
            {label}
          </div>
          {i < labels.length - 1 &&
        <ChevronRightIcon className="w-3 h-3 text-text-secondary/60" />
        }
        </React.Fragment>
      )}
    </div>);

}

function ValidationBanner({
  icon: Icon,
  tone,
  message
}: {
  icon: React.ElementType;
  tone: 'warn' | 'error';
  message: string;
}) {
  const cls =
  tone === 'error' ?
  'border-[#F5D7D7] bg-[#FBE9E9] text-[#9B3A3A]' :
  'border-[#F8E7C8] bg-[#FFF7E6] text-[#A36B00]';
  return (
    <div className={cn('rounded-xl border p-3 text-sm flex items-start gap-2', cls)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>);

}

function AnimalRow({
  animal,
  right
}: {
  animal: {id: string;name: string;species?: string;primary_photo_url?: string;} | undefined;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar
        src={animal?.primary_photo_url}
        type="animal"
        species={animal?.species as any}
        size="sm" />

      <p className="flex-1 font-medium text-text-primary truncate">
        {animal?.name || 'Unknown'}
      </p>
      {right}
    </div>);

}

// ————— Step 1: confirm attendance ——————————————————————————

function Step1({
  slots,
  animals,
  state,
  setSlot
}: {
  slots: {id: string;animal_id: string;}[];
  animals: any[];
  state: Record<string, PerSlotState>;
  setSlot: (id: string, patch: Partial<PerSlotState>) => void;
}) {
  return (
    <div>
      <h4 className="font-semibold text-text-primary mb-2">Confirm Attendance</h4>
      <p className="text-sm text-text-secondary mb-3">
        Mark each animal as attended, a no-show, or cancelled.
      </p>
      <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
        {slots.length === 0 ?
        <p className="text-sm text-text-secondary text-center py-6">
            No animals on this clinic.
          </p> :

        slots.map((s) => {
          const animal = animals.find((a) => a.id === s.animal_id);
          const st = state[s.id];
          if (!st) return null;
          return (
            <AnimalRow
              key={s.id}
              animal={animal}
              right={
              <div className="flex items-center gap-1.5">
                  <AttendancePill
                  active={st.attendance === 'attended'}
                  onClick={() => setSlot(s.id, { attendance: 'attended' })}
                  tone="green"
                  icon={CheckCircle2Icon}
                  label="Attended" />

                  <AttendancePill
                  active={st.attendance === 'no_show'}
                  onClick={() => setSlot(s.id, { attendance: 'no_show' })}
                  tone="red"
                  icon={XCircleIcon}
                  label="No-show" />

                  <AttendancePill
                  active={st.attendance === 'canceled'}
                  onClick={() => setSlot(s.id, { attendance: 'canceled' })}
                  tone="gray"
                  icon={CalendarOffIcon}
                  label="Cancelled" />

                </div>
              } />);


        })
        }
      </div>
    </div>);

}

function AttendancePill({
  active,
  onClick,
  tone,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  tone: 'green' | 'red' | 'gray';
  icon: React.ElementType;
  label: string;
}) {
  const activeCls = {
    green: 'bg-status-adoptable-bg text-status-adoptable-text border-status-adoptable-text/30',
    red: 'bg-[#F5D7D7] text-[#9B3A3A] border-[#9B3A3A]/30',
    gray: 'bg-background text-text-secondary border-border'
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
        active ?
        activeCls :
        'bg-white text-text-secondary border-border hover:border-primary/40'
      )}>

      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>);

}

// ————— Step 2: confirm procedures ——————————————————————————

function Step2({
  attendingSlots,
  animals,
  procedures,
  state,
  setSlot,
  togglePlanned,
  toggleAdded
}: {
  attendingSlots: {id: string;animal_id: string;}[];
  animals: any[];
  procedures: {id: string;clinic_slot_id: string;procedure_type: ClinicSlotProcedureType;}[];
  state: Record<string, PerSlotState>;
  setSlot: (id: string, patch: Partial<PerSlotState>) => void;
  togglePlanned: (slotId: string, procId: string) => void;
  toggleAdded: (slotId: string, type: ClinicSlotProcedureType) => void;
}) {
  return (
    <div>
      <h4 className="font-semibold text-text-primary mb-2">Confirm Procedures</h4>
      <p className="text-sm text-text-secondary mb-3">
        For each attending animal, confirm what was done. Uncheck anything that
        didn't happen, add procedures that weren't planned, and leave a note if needed.
      </p>
      {attendingSlots.length === 0 ?
      <div className="border border-border rounded-xl p-6 text-center text-sm text-text-secondary">
          No attending animals — nothing to record.
        </div> :

      <div className="space-y-3">
          {attendingSlots.map((s) => {
          const animal = animals.find((a) => a.id === s.animal_id);
          const st = state[s.id];
          if (!st) return null;
          const planned = procedures.filter((p) => p.clinic_slot_id === s.id);
          const plannedTypes = new Set(planned.map((p) => p.procedure_type));
          const addable = PROCEDURE_ORDER.filter((t) => !plannedTypes.has(t));
          return (
            <div
              key={s.id}
              className="border border-border rounded-xl p-3 bg-background/40 space-y-2.5">

                <div className="flex items-center gap-3">
                  <Avatar
                  src={animal?.primary_photo_url}
                  type="animal"
                  species={animal?.species}
                  size="sm" />

                  <p className="font-medium text-text-primary truncate">
                    {animal?.name || 'Unknown'}
                  </p>
                </div>

                {planned.length > 0 &&
              <div>
                    <p className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
                      Planned
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {planned.map((p) => {
                    const checked = !!st.plannedCompleted[p.id];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlanned(s.id, p.id)}
                        aria-pressed={checked}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          checked ?
                          'bg-status-adoptable-bg text-status-adoptable-text border-status-adoptable-text/30' :
                          'bg-white text-text-secondary border-border line-through'
                        )}>

                            {checked && <CheckIcon className="w-3 h-3" />}
                            {PROCEDURE_LABEL[p.procedure_type]}
                          </button>);

                  })}
                    </div>
                  </div>
              }

                {addable.length > 0 &&
              <div>
                    <p className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
                      Add procedures
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {addable.map((t) => {
                    const checked = st.added.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleAdded(s.id, t)}
                        aria-pressed={checked}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          checked ?
                          'bg-primary text-white border-primary' :
                          'bg-white text-text-secondary border-dashed border-border hover:border-primary/50'
                        )}>

                            {checked && <CheckIcon className="w-3 h-3" />}
                            {PROCEDURE_LABEL[t]}
                          </button>);

                  })}
                    </div>
                  </div>
              }

                <div>
                  <p className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
                    Notes (optional)
                  </p>
                  <Textarea
                  rows={2}
                  value={st.notes}
                  onChange={(e) => setSlot(s.id, { notes: e.target.value })}
                  placeholder="e.g. requires recheck in 2 weeks" />

                </div>
              </div>);

        })}
        </div>
      }
    </div>);

}

// ————— Step 3: review ——————————————————————————————————

function Step3({
  attendingSlots,
  noShowSlots,
  canceledSlots,
  attendingWithoutProcedures,
  recordsToCreate,
  animals,
  procedures,
  state
}: {
  attendingSlots: {id: string;animal_id: string;}[];
  noShowSlots: {id: string;animal_id: string;}[];
  canceledSlots: {id: string;animal_id: string;}[];
  attendingWithoutProcedures: {id: string;animal_id: string;}[];
  recordsToCreate: number;
  animals: any[];
  procedures: {id: string;clinic_slot_id: string;procedure_type: ClinicSlotProcedureType;}[];
  state: Record<string, PerSlotState>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-text-primary mb-2">Review &amp; Complete</h4>
        <p className="text-sm text-text-secondary">
          Confirm the summary below. Completing the clinic will create medical
          records for every checked procedure and lock the clinic as completed.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile label="Attended" value={attendingSlots.length} tone="green" />
        <StatTile label="No-show" value={noShowSlots.length} tone="red" />
        <StatTile label="Cancelled" value={canceledSlots.length} tone="gray" />
        <StatTile label="Records to create" value={recordsToCreate} tone="primary" />
      </div>

      {attendingWithoutProcedures.length > 0 &&
      <ValidationBanner
        icon={AlertTriangleIcon}
        tone="warn"
        message={`${attendingWithoutProcedures.length} attended ${
        attendingWithoutProcedures.length === 1 ? 'animal has' : 'animals have'
        } no procedures checked — they'll be marked attended but no medical records will be created.`} />

      }

      {attendingSlots.length > 0 &&
      <div>
          <h5 className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
            Attended
          </h5>
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
            {attendingSlots.map((s) => {
            const animal = animals.find((a) => a.id === s.animal_id);
            const st = state[s.id];
            const planned = procedures.filter((p) => p.clinic_slot_id === s.id);
            const completedTypes: ClinicSlotProcedureType[] = [
            ...planned.
            filter((p) => st?.plannedCompleted[p.id]).
            map((p) => p.procedure_type),
            ...st?.added ?? []];

            return (
              <div key={s.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                    src={animal?.primary_photo_url}
                    type="animal"
                    species={animal?.species}
                    size="sm" />

                    <p className="flex-1 font-medium text-text-primary truncate">
                      {animal?.name || 'Unknown'}
                    </p>
                  </div>
                  {completedTypes.length > 0 ?
                <div className="flex flex-wrap gap-1.5 mt-2 pl-11">
                      {completedTypes.map((t, i) =>
                  <span
                    key={`${t}-${i}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-adoptable-bg text-status-adoptable-text">

                          <CheckIcon className="w-3 h-3" />
                          {PROCEDURE_LABEL[t]}
                        </span>
                  )}
                    </div> :

                <p className="text-xs text-text-secondary italic mt-1 pl-11">
                      No procedures recorded
                    </p>
                }
                  {st?.notes.trim() &&
                <p className="text-xs text-text-secondary mt-1.5 pl-11">
                      <span className="font-medium">Note:</span> {st.notes.trim()}
                    </p>
                }
                </div>);

          })}
          </div>
        </div>
      }

      {(noShowSlots.length > 0 || canceledSlots.length > 0) &&
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {noShowSlots.length > 0 &&
        <NameList
          label="No-show"
          slots={noShowSlots}
          animals={animals} />

        }
          {canceledSlots.length > 0 &&
        <NameList
          label="Cancelled"
          slots={canceledSlots}
          animals={animals} />

        }
        </div>
      }
    </div>);

}

function StatTile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: 'green' | 'red' | 'gray' | 'primary';
}) {
  const cls = {
    green: 'bg-status-adoptable-bg text-status-adoptable-text',
    red: 'bg-[#F5D7D7] text-[#9B3A3A]',
    gray: 'bg-background text-text-secondary border border-border',
    primary: 'bg-primary/10 text-primary'
  }[tone];
  return (
    <div className={cn('rounded-xl p-3', cls)}>
      <p className="text-2xl font-heading font-bold tabular-nums">{value}</p>
      <p className="text-xs uppercase tracking-wider mt-0.5 opacity-80">{label}</p>
    </div>);

}

function NameList({
  label,
  slots,
  animals
}: {
  label: string;
  slots: {id: string;animal_id: string;}[];
  animals: any[];
}) {
  return (
    <div>
      <h5 className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
        {label}
      </h5>
      <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
        {slots.map((s) => {
          const animal = animals.find((a) => a.id === s.animal_id);
          return (
            <div key={s.id} className="px-4 py-2 flex items-center gap-3">
              <Avatar
                src={animal?.primary_photo_url}
                type="animal"
                species={animal?.species}
                size="sm" />

              <p className="text-sm text-text-primary truncate">
                {animal?.name || 'Unknown'}
              </p>
            </div>);

        })}
      </div>
    </div>);

}
