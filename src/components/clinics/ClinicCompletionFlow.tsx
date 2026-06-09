import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Textarea, Select, Label, Input } from '../ui/Forms';
import { AnimalSearchPicker } from '../ui/AnimalSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import {
  ClinicSlotProcedureType,
  ClinicSlotStatus,
  ProcedureType,
  Procedure,
  Sex } from
'../../types';
import { cn, formatDate } from '../../lib/utils';
import {
  deriveProcedureName,
  getProcedureOptions,
  getDefaultProcedure,
  getProcedureLabel,
  showCustomProcedureName,
  PROCEDURE_TYPE_OPTIONS } from
'../../lib/medicalOptions';
import {
  CheckIcon,
  CheckCircle2Icon,
  XCircleIcon,
  XIcon,
  PlusIcon,
  AlertTriangleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ArrowLeftIcon,
  StethoscopeIcon } from
'lucide-react';

interface Props {
  clinicEventId: string | null;
  /** Called to leave the flow (cancel or after completing) — navigates back. */
  onClose: () => void;
}

// Binary attendance: did this animal receive care or not? (We don't distinguish
// no-show vs cancelled — there's no reporting need after the clinic date.)
type Attendance = 'attended' | 'did_not_attend';

interface Attendee {
  /** Real slot id, or a `added:<animalId>` temp key for late additions. */
  key: string;
  animal_id: string;
  isAdded: boolean;
}

// One medical record the user is building for an animal. Mirrors the Medical
// Records taxonomy (type + structured subtype) so completion produces accurate
// records, not coarse "procedures".
interface RecordDraft {
  id: string;
  procedure_type: ProcedureType;
  /** Structured subtype; '' means "not chosen yet" (invalid until picked). */
  procedure: Procedure | '';
  custom_procedure_name: string;
}

interface AttendeeState {
  attendance: Attendance;
  records: RecordDraft[];
  notes: string;
}

// Map a planned clinic-slot procedure onto the medical taxonomy used to pre-fill
// the record drafts. `vaccines` and `spay_neuter` resolve their subtype at
// pre-fill time (sex for spay/neuter; vaccines require an explicit choice).
const CLINIC_TO_MEDICAL: Record<
  ClinicSlotProcedureType,
  { type: ProcedureType; procedure?: Procedure }> =
{
  spay_neuter: { type: 'spay_neuter' },
  vaccines: { type: 'vaccine' },
  dental: { type: 'surgery', procedure: 'dental_surgery' },
  exam: { type: 'exam', procedure: 'wellness_exam' },
  recheck: { type: 'exam', procedure: 'recheck_exam' },
  flea_treatment: { type: 'parasite_prevention', procedure: 'flea_tick_prevention' },
  deworming: { type: 'parasite_prevention', procedure: 'deworming' },
  microchip: { type: 'microchip', procedure: 'microchip_implant' },
  other: { type: 'other' }
};

const ATTENDANCE_TO_SLOT: Record<Attendance, ClinicSlotStatus> = {
  attended: 'completed',
  did_not_attend: 'no_show'
};

let draftCounter = 0;
const newDraftId = () => `draft-${++draftCounter}`;

// Sensible default subtype for a type. Vaccines always start unset so the user
// must pick which vaccine (never silently records "Rabies").
function defaultProcedureFor(
type: ProcedureType,
species?: string | null,
sex?: Sex | null)
: Procedure | '' {
  if (type === 'vaccine') return '';
  return getDefaultProcedure({ procedureType: type, species, sex });
}

function blankDraft(species?: string | null, sex?: Sex | null): RecordDraft {
  return {
    id: newDraftId(),
    procedure_type: 'vaccine',
    procedure: defaultProcedureFor('vaccine', species, sex),
    custom_procedure_name: ''
  };
}

// Build record drafts from an animal's planned procedures.
function draftsFromPlanned(
plannedTypes: ClinicSlotProcedureType[],
species?: string | null,
sex?: Sex | null)
: RecordDraft[] {
  return plannedTypes.map((t) => {
    const m = CLINIC_TO_MEDICAL[t];
    const procedure = m.procedure ?? defaultProcedureFor(m.type, species, sex);
    return {
      id: newDraftId(),
      procedure_type: m.type,
      procedure,
      custom_procedure_name: ''
    };
  });
}

function isDraftComplete(d: RecordDraft): boolean {
  if (d.procedure === '') return false;
  if (d.procedure === 'other' && !d.custom_procedure_name.trim()) return false;
  return true;
}

type Step = 1 | 2 | 3;

export function ClinicCompletionFlow({ clinicEventId, onClose }: Props) {
  const {
    clinicEvents,
    clinicSlots,
    clinicSlotProcedures,
    animalsIndex: animals,
    people,
    medicalRecords,
    updateClinicEvent,
    updateClinicSlot,
    addClinicSlot,
    addMedicalRecord
  } = useWhisker();
  const { currentPersonId } = useAuth();

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
  // Confirmation gate before committing: future-dated clinic, or one that will
  // create no records.
  const [confirm, setConfirm] = useState<null | 'future' | 'no_records'>(null);

  const [state, setState] = useState<Record<string, AttendeeState>>({});
  const [initFor, setInitFor] = useState<string | null>(null);
  const [addedAnimals, setAddedAnimals] = useState<
    { tempId: string; animal_id: string }[]>(
    []);
  const [picking, setPicking] = useState(false);
  const [pickAnimalId, setPickAnimalId] = useState('');

  React.useEffect(() => {
    if (!event) return;
    if (initFor === event.id) return;
    const next: Record<string, AttendeeState> = {};
    for (const s of slots) {
      const planned = clinicSlotProcedures.
      filter((p) => p.clinic_slot_id === s.id).
      map((p) => p.procedure_type);
      const animal = animals.find((a) => a.id === s.animal_id);
      const attendance: Attendance =
      s.status === 'no_show' || s.status === 'cancelled' ?
      'did_not_attend' :
      'attended';
      next[s.id] = {
        attendance,
        records: draftsFromPlanned(planned, animal?.species, animal?.sex),
        notes: ''
      };
    }
    setState(next);
    setStep(1);
    setConfirm(null);
    setAddedAnimals([]);
    setPicking(false);
    setPickAnimalId('');
    setInitFor(event.id);
  }, [event, slots, clinicSlotProcedures, animals, initFor]);

  if (!event) {
    return (
      <div className="py-16 text-center text-text-secondary">
        Clinic not found.
      </div>);

  }

  const vet = event.veterinarian_person_id ?
  people.find((p) => p.id === event.veterinarian_person_id) :
  undefined;
  const vetName = vet ? `${vet.first_name} ${vet.last_name}` : undefined;
  const clinicDate = new Date(event.date_time).toISOString().slice(0, 10);

  const attendees: Attendee[] = [
  ...slots.map((s) => ({ key: s.id, animal_id: s.animal_id, isAdded: false })),
  ...addedAnimals.map((a) => ({
    key: a.tempId,
    animal_id: a.animal_id,
    isAdded: true
  }))];


  const animalOf = (key: string) => {
    const at = attendees.find((a) => a.key === key);
    return at ? animals.find((x) => x.id === at.animal_id) : undefined;
  };

  const setAttendee = (key: string, patch: Partial<AttendeeState>) =>
  setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const addRecord = (key: string) => {
    const a = animalOf(key);
    setState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        records: [...prev[key].records, blankDraft(a?.species, a?.sex)]
      }
    }));
  };
  const updateRecord = (key: string, draft: RecordDraft) =>
  setState((prev) => ({
    ...prev,
    [key]: {
      ...prev[key],
      records: prev[key].records.map((d) => d.id === draft.id ? draft : d)
    }
  }));
  const removeRecord = (key: string, id: string) =>
  setState((prev) => ({
    ...prev,
    [key]: {
      ...prev[key],
      records: prev[key].records.filter((d) => d.id !== id)
    }
  }));

  const confirmAddAnimal = () => {
    if (!pickAnimalId) return;
    const tempId = `added:${pickAnimalId}`;
    if (!addedAnimals.some((a) => a.tempId === tempId)) {
      setAddedAnimals((prev) => [...prev, { tempId, animal_id: pickAnimalId }]);
      setState((prev) => ({
        ...prev,
        [tempId]: { attendance: 'attended', records: [], notes: '' }
      }));
    }
    setPickAnimalId('');
    setPicking(false);
  };
  const removeAdded = (key: string) => {
    setAddedAnimals((prev) => prev.filter((a) => a.tempId !== key));
    setState((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  const attendingAttendees = attendees.filter(
    (a) => state[a.key]?.attendance === 'attended'
  );
  const didNotAttend = attendees.filter(
    (a) => state[a.key]?.attendance === 'did_not_attend'
  );

  const validRecordsFor = (key: string) =>
  (state[key]?.records ?? []).filter(isDraftComplete);
  const recordsToCreate = attendingAttendees.reduce(
    (sum, a) => sum + validRecordsFor(a.key).length,
    0
  );
  const attendingWithIncomplete = attendingAttendees.filter((a) =>
  (state[a.key]?.records ?? []).some((d) => !isDraftComplete(d))
  );
  // Late additions must get at least one (complete) record.
  const addedNeedingRecord = attendingAttendees.filter(
    (a) => a.isAdded && validRecordsFor(a.key).length === 0
  );

  const nonAbsentCount = attendingAttendees.length;
  const overCapacity =
  event.slot_capacity > 0 && nonAbsentCount > event.slot_capacity;

  const excludeAnimalIds = [
  ...slots.map((s) => s.animal_id),
  ...addedAnimals.map((a) => a.animal_id)];


  // Hard block (records that can't be created). Empty clinics / future dates are
  // soft — confirmed at the final click instead.
  const blocksComplete =
  submitting ||
  attendingWithIncomplete.length > 0 ||
  addedNeedingRecord.length > 0;
  const isFutureClinic = new Date(event.date_time).getTime() > Date.now();

  // Run completion, gating behind confirmations for a future date / no records.
  const attemptComplete = () => {
    if (blocksComplete) return;
    if (isFutureClinic) {
      setConfirm('future');
      return;
    }
    if (recordsToCreate === 0) {
      setConfirm('no_records');
      return;
    }
    void handleComplete();
  };
  const onConfirmFuture = () => {
    if (recordsToCreate === 0) {
      setConfirm('no_records');
      return;
    }
    setConfirm(null);
    void handleComplete();
  };
  const onConfirmNoRecords = () => {
    setConfirm(null);
    void handleComplete();
  };

  const handleComplete = async () => {
    if (!event) return;
    setSubmitting(true);
    try {
      // 1. Mirror attendance onto existing slot statuses.
      for (const s of slots) {
        const st = state[s.id];
        if (!st) continue;
        const desired = ATTENDANCE_TO_SLOT[st.attendance];
        if (s.status !== desired) {
          updateClinicSlot(s.id, { status: desired });
        }
      }

      // 2. Persist late additions as real slots (retroactive attendees). Their
      //    medical records are keyed by animal_id, so no slot id is needed here.
      for (const a of attendees) {
        if (!a.isAdded) continue;
        const st = state[a.key];
        if (!st) continue;
        await addClinicSlot(
          {
            clinic_event_id: event.id,
            animal_id: a.animal_id,
            reserved_by_person_id: currentPersonId ?? undefined,
            status: ATTENDANCE_TO_SLOT[st.attendance],
            notes: st.notes.trim() || undefined
          },
          []
        );
      }

      // 3. Create a medical record for every complete draft on attending
      //    animals. Skip any that already exists for this clinic+animal+type,
      //    so re-running is safe.
      for (const a of attendingAttendees) {
        const st = state[a.key];
        if (!st) continue;
        for (const d of validRecordsFor(a.key)) {
          const procedure = d.procedure || undefined;
          const procedureName = deriveProcedureName({
            procedure_type: d.procedure_type,
            procedure,
            custom_procedure_name: d.custom_procedure_name
          });
          const alreadyExists = medicalRecords.some(
            (m) =>
            m.clinic_id === event.id &&
            m.animal_id === a.animal_id &&
            m.procedure_type === d.procedure_type && (
            procedure ?
            m.procedure === procedure :
            m.procedure_name === procedureName)
          );
          if (alreadyExists) continue;
          addMedicalRecord({
            animal_id: a.animal_id,
            procedure_type: d.procedure_type,
            procedure,
            procedure_name: procedureName,
            custom_procedure_name:
            d.procedure === 'other' ?
            d.custom_procedure_name.trim() :
            undefined,
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

      // 4. Flip the event to completed.
      updateClinicEvent(event.id, { status: 'completed' });
      setInitFor(null);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-3">

          <ArrowLeftIcon className="w-4 h-4" /> Back to clinic
        </button>
        <h1 className="text-3xl font-heading font-bold text-text-primary">
          Complete Clinic
        </h1>
      </div>

      <div className="max-w-4xl space-y-5">
        {/* Clinic identity — page context, on the background. */}
        <div>
          <h3 className="text-lg font-heading font-bold text-text-primary flex items-center gap-2">
            <StethoscopeIcon className="w-5 h-5 text-primary shrink-0" />
            {formatDate(event.date_time)}
          </h3>
          <p className="text-sm text-text-secondary mt-0.5">{event.location}</p>
        </div>

        {/* Work area card. */}
        <Card className="p-5 sm:p-6 space-y-5">
          <div className="pb-4 border-b border-border overflow-x-auto">
            <Stepper step={step} />
          </div>

          {step === 1 &&
          <>
              <Step1
              attendees={attendees}
              animals={animals}
              state={state}
              setAttendee={setAttendee}
              onRemoveAdded={removeAdded} />


              <div>
                {picking ?
              <div className="border border-border rounded-xl p-3 bg-background/40 space-y-2">
                    <p className="text-xs uppercase tracking-wider text-text-secondary">
                      Add an animal to this clinic
                    </p>
                    <AnimalSearchPicker
                  animals={animals}
                  value={pickAnimalId}
                  onChange={setPickAnimalId}
                  excludeIds={excludeAnimalIds}
                  placeholder="Search animals by name or ID…" />

                    <div className="flex justify-end gap-2">
                      <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPicking(false);
                      setPickAnimalId('');
                    }}>

                        Cancel
                      </Button>
                      <Button
                    type="button"
                    size="sm"
                    onClick={confirmAddAnimal}
                    disabled={!pickAnimalId}>

                        Add Animal
                      </Button>
                    </div>
                  </div> :

              <button
                type="button"
                onClick={() => setPicking(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">

                    <PlusIcon className="w-4 h-4" />
                    Add Another Animal
                  </button>
              }
              </div>

              {overCapacity &&
            <p className="flex items-start gap-1.5 text-xs text-status-medical-text">
                  <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>
                    This exceeds the clinic's capacity of {event.slot_capacity}.
                    You can still complete it.
                  </span>
                </p>
            }
            </>
          }

          {step === 2 &&
          <Step2
            attendingAttendees={attendingAttendees}
            animals={animals}
            state={state}
            setAttendee={setAttendee}
            addRecord={addRecord}
            updateRecord={updateRecord}
            removeRecord={removeRecord} />

          }

          {step === 3 &&
          <Step3
            attendingAttendees={attendingAttendees}
            didNotAttend={didNotAttend}
            attendingWithIncomplete={attendingWithIncomplete}
            addedNeedingRecord={addedNeedingRecord}
            recordsToCreate={recordsToCreate}
            animals={animals}
            state={state} />

          }

          {/* Inline footer actions. */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (step === 1) {
                  onClose();
                } else {
                  setStep((s) => s - 1 as Step);
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
              onClick={() => setStep((s) => s + 1 as Step)}
              disabled={submitting}>

                Next
                <ChevronRightIcon className="w-4 h-4 ml-1" />
              </Button> :

            <Button
              type="button"
              onClick={attemptComplete}
              disabled={blocksComplete}>

                {submitting ? 'Completing…' : 'Complete Clinic'}
              </Button>
            }
          </div>
        </Card>
      </div>

      {/* Future-date confirmation. */}
      <Modal
        isOpen={confirm === 'future'}
        onClose={() => setConfirm(null)}
        title="Complete a future clinic?"
        footer={
        <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={onConfirmFuture}>Complete Anyway</Button>
          </div>
        }>

        <p className="text-sm text-text-secondary">
          This clinic is scheduled in the future. Are you sure you want to mark
          it as completed?
        </p>
      </Modal>

      {/* No-records confirmation. */}
      <Modal
        isOpen={confirm === 'no_records'}
        onClose={() => setConfirm(null)}
        title="No medical records will be created"
        footer={
        <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={onConfirmNoRecords}>Complete Clinic</Button>
          </div>
        }>

        <p className="text-sm text-text-secondary">
          {attendingAttendees.length === 0 ?
          'This clinic has no attending animals. Completing the clinic will not create any medical records.' :
          'No medical records will be created based on the current selections. Complete the clinic anyway?'}
        </p>
      </Modal>
    </div>);

}

function Stepper({ step }: {step: Step;}) {
  const labels: [Step, string][] = [
  [1, 'Attendance'],
  [2, 'Records'],
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

// ————— Step 1: confirm attendance (binary) ——————————————————

function Step1({
  attendees,
  animals,
  state,
  setAttendee,
  onRemoveAdded
}: {
  attendees: Attendee[];
  animals: any[];
  state: Record<string, AttendeeState>;
  setAttendee: (key: string, patch: Partial<AttendeeState>) => void;
  onRemoveAdded: (key: string) => void;
}) {
  return (
    <div>
      <h4 className="font-semibold text-text-primary mb-2">Confirm Attendance</h4>
      <p className="text-sm text-text-secondary mb-3">
        Mark whether each animal received care at this clinic.
      </p>
      <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
        {attendees.length === 0 ?
        <p className="text-sm text-text-secondary text-center py-6">
            No animals on this clinic.
          </p> :

        attendees.map((a) => {
          const animal = animals.find((x) => x.id === a.animal_id);
          const st = state[a.key];
          if (!st) return null;
          return (
            <div key={a.key} className="flex items-center gap-3 px-4 py-3">
                <Avatar
                src={animal?.primary_photo_url}
                type="animal"
                species={animal?.species}
                size="sm" />

                <p className="flex-1 font-medium text-text-primary truncate">
                  {animal?.name || 'Unknown'}
                </p>
                <div className="flex items-center gap-1.5">
                  {a.isAdded &&
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      Added
                    </span>
                }
                  <AttendancePill
                  active={st.attendance === 'attended'}
                  onClick={() => setAttendee(a.key, { attendance: 'attended' })}
                  tone="green"
                  icon={CheckCircle2Icon}
                  label="Attended" />

                  <AttendancePill
                  active={st.attendance === 'did_not_attend'}
                  onClick={() =>
                  setAttendee(a.key, { attendance: 'did_not_attend' })
                  }
                  tone="gray"
                  icon={XCircleIcon}
                  label="Did Not Attend" />

                  {a.isAdded &&
                <button
                  type="button"
                  onClick={() => onRemoveAdded(a.key)}
                  aria-label="Remove added animal"
                  className="p-1 rounded-md text-text-secondary/70 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

                      <XIcon className="w-4 h-4" />
                    </button>
                }
                </div>
              </div>);

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
  tone: 'green' | 'gray';
  icon: React.ElementType;
  label: string;
}) {
  const activeCls = {
    green: 'bg-status-adoptable-bg text-status-adoptable-text border-status-adoptable-text/30',
    gray: 'bg-background text-text-secondary border-border'
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
        active ?
        activeCls :
        'bg-white text-text-secondary border-border hover:border-primary/40'
      )}>

      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </button>);

}

// ————— Step 2: build medical records ————————————————————————

function Step2({
  attendingAttendees,
  animals,
  state,
  setAttendee,
  addRecord,
  updateRecord,
  removeRecord
}: {
  attendingAttendees: Attendee[];
  animals: any[];
  state: Record<string, AttendeeState>;
  setAttendee: (key: string, patch: Partial<AttendeeState>) => void;
  addRecord: (key: string) => void;
  updateRecord: (key: string, draft: RecordDraft) => void;
  removeRecord: (key: string, id: string) => void;
}) {
  return (
    <div>
      <h4 className="font-semibold text-text-primary mb-2">Medical Records</h4>
      <p className="text-sm text-text-secondary mb-3">
        Confirm the records to create for each animal. Pre-filled from the
        planned procedures — edit, remove, or add as needed.
      </p>
      {attendingAttendees.length === 0 ?
      <div className="border border-border rounded-xl p-6 text-center text-sm text-text-secondary">
          No attending animals — nothing to record.
        </div> :

      <div className="space-y-3">
          {attendingAttendees.map((a) => {
          const animal = animals.find((x) => x.id === a.animal_id);
          const st = state[a.key];
          if (!st) return null;
          const incomplete = st.records.some((d) => !isDraftComplete(d));
          const needsRecord = a.isAdded && st.records.length === 0;
          return (
            <div
              key={a.key}
              className="border border-border rounded-xl p-3 bg-background/40 space-y-3">

                <div className="flex items-center gap-3">
                  <Avatar
                  src={animal?.primary_photo_url}
                  type="animal"
                  species={animal?.species}
                  size="sm" />

                  <p className="font-medium text-text-primary truncate">
                    {animal?.name || 'Unknown'}
                  </p>
                  {a.isAdded &&
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      Added
                    </span>
                }
                </div>

                {st.records.length > 0 &&
              <div className="space-y-2">
                    {st.records.map((d) =>
                <RecordDraftRow
                  key={d.id}
                  draft={d}
                  species={animal?.species}
                  sex={animal?.sex}
                  onChange={(next) => updateRecord(a.key, next)}
                  onRemove={() => removeRecord(a.key, d.id)} />

                )}
                  </div>
              }

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                  type="button"
                  onClick={() => addRecord(a.key)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">

                    <PlusIcon className="w-4 h-4" />
                    Add Medical Record
                  </button>
                  {needsRecord &&
                <span className="inline-flex items-center gap-1 text-xs text-status-medical-text">
                      <AlertTriangleIcon className="w-3.5 h-3.5" />
                      Added animals need at least one record.
                    </span>
                }
                  {!needsRecord && incomplete &&
                <span className="inline-flex items-center gap-1 text-xs text-status-medical-text">
                      <AlertTriangleIcon className="w-3.5 h-3.5" />
                      Choose a subtype for each record.
                    </span>
                }
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
                    Notes (optional)
                  </p>
                  <Textarea
                  rows={2}
                  value={st.notes}
                  onChange={(e) => setAttendee(a.key, { notes: e.target.value })}
                  placeholder="Applies to this animal's records — e.g. recheck in 2 weeks" />

                </div>
              </div>);

        })}
        </div>
      }
    </div>);

}

function RecordDraftRow({
  draft,
  species,
  sex,
  onChange,
  onRemove
}: {
  draft: RecordDraft;
  species?: string | null;
  sex?: Sex | null;
  onChange: (next: RecordDraft) => void;
  onRemove: () => void;
}) {
  const options = getProcedureOptions({
    procedureType: draft.procedure_type,
    species,
    sex
  });
  const subtypeLabel = getProcedureLabel(draft.procedure_type);
  const needsSubtype = draft.procedure === '';
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-2.5">
      <div className="flex-1 min-w-[8rem]">
        <Label className="text-xs">Type</Label>
        <Select
          value={draft.procedure_type}
          onChange={(e) => {
            const nextType = e.target.value as ProcedureType;
            onChange({
              ...draft,
              procedure_type: nextType,
              procedure: defaultProcedureFor(nextType, species, sex),
              custom_procedure_name: ''
            });
          }}
          className="h-9 text-sm">

          {PROCEDURE_TYPE_OPTIONS.map((o) =>
          <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )}
        </Select>
      </div>
      <div className="flex-1 min-w-[8rem]">
        <Label className="text-xs">{subtypeLabel}</Label>
        <Select
          value={draft.procedure}
          onChange={(e) =>
          onChange({ ...draft, procedure: e.target.value as Procedure | '' })
          }
          className={cn(
            'h-9 text-sm',
            needsSubtype && 'border-status-medical-text/50'
          )}>

          {options.length !== 1 && <option value="">Select…</option>}
          {options.map((o) =>
          <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )}
        </Select>
      </div>
      {showCustomProcedureName(draft.procedure) &&
      <div className="flex-1 min-w-[8rem]">
          <Label className="text-xs">Name</Label>
          <Input
          value={draft.custom_procedure_name}
          onChange={(e) =>
          onChange({ ...draft, custom_procedure_name: e.target.value })
          }
          placeholder="e.g. Distemper booster"
          className="h-9 text-sm" />

        </div>
      }
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove record"
        className="h-9 w-9 inline-flex items-center justify-center rounded-md text-text-secondary/70 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors shrink-0">

        <XIcon className="w-4 h-4" />
      </button>
    </div>);

}

// ————— Step 3: review ——————————————————————————————————

function Step3({
  attendingAttendees,
  didNotAttend,
  attendingWithIncomplete,
  addedNeedingRecord,
  recordsToCreate,
  animals,
  state
}: {
  attendingAttendees: Attendee[];
  didNotAttend: Attendee[];
  attendingWithIncomplete: Attendee[];
  addedNeedingRecord: Attendee[];
  recordsToCreate: number;
  animals: any[];
  state: Record<string, AttendeeState>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-text-primary mb-2">Review &amp; Complete</h4>
        <p className="text-sm text-text-secondary">
          These are the medical records that will be created. Completing the
          clinic creates them and locks the clinic as completed.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Attended" value={attendingAttendees.length} tone="green" />
        <StatTile label="Did not attend" value={didNotAttend.length} tone="gray" />
        <StatTile label="Records to create" value={recordsToCreate} tone="primary" />
      </div>

      {recordsToCreate === 0 &&
      <ValidationBanner
        icon={AlertTriangleIcon}
        tone="warn"
        message="No medical records will be created based on the current selections." />

      }

      {(addedNeedingRecord.length > 0 || attendingWithIncomplete.length > 0) &&
      <ValidationBanner
        icon={AlertTriangleIcon}
        tone="error"
        message="Some animals have unfinished records — go back to the Records step and choose a subtype (or remove the record) before completing." />

      }

      {attendingAttendees.length > 0 &&
      <div>
          <h5 className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
            Attended
          </h5>
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
            {attendingAttendees.map((a) => {
            const animal = animals.find((x) => x.id === a.animal_id);
            const st = state[a.key];
            const valid = (st?.records ?? []).filter(isDraftComplete);
            return (
              <div key={a.key} className="px-4 py-3">
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
                  {valid.length > 0 ?
                <div className="flex flex-wrap gap-1.5 mt-2 pl-11">
                      {valid.map((d) =>
                  <span
                    key={d.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-adoptable-bg text-status-adoptable-text">

                          <CheckIcon className="w-3 h-3" />
                          {deriveProcedureName({
                      procedure_type: d.procedure_type,
                      procedure: d.procedure || undefined,
                      custom_procedure_name: d.custom_procedure_name
                    })}
                        </span>
                  )}
                    </div> :

                <p className="text-xs text-text-secondary italic mt-1 pl-11">
                      No records
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

      {didNotAttend.length > 0 &&
      <div>
          <h5 className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
            Did not attend
          </h5>
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
            {didNotAttend.map((a) => {
            const animal = animals.find((x) => x.id === a.animal_id);
            return (
              <div key={a.key} className="px-4 py-2 flex items-center gap-3">
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
  tone: 'green' | 'gray' | 'primary';
}) {
  const cls = {
    green: 'bg-status-adoptable-bg text-status-adoptable-text',
    gray: 'bg-background text-text-secondary border border-border',
    primary: 'bg-primary/10 text-primary'
  }[tone];
  return (
    <div className={cn('rounded-xl p-3', cls)}>
      <p className="text-2xl font-heading font-bold tabular-nums">{value}</p>
      <p className="text-xs uppercase tracking-wider mt-0.5 opacity-80">{label}</p>
    </div>);

}
