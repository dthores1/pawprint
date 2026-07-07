// "One-shot" procedure duplicate detection.
//
// A few procedures happen at most once in an animal's life — spay/neuter and
// microchip implant. When one is scheduled (clinic slot) or about to be
// recorded (clinic completion) for an animal that already has a completed
// record of it, the UI shows a soft, NON-BLOCKING warning. Never a hard block:
// the existing record can itself be wrong (data-entry error, an
// "altered at intake" guess, a revision surgery for a cryptorchid neuter), and
// if the vet did perform the procedure, silently dropping the record would be
// worse than a duplicate. Vaccines, exams, meds, and parasite prevention are
// repeatable and never flagged.
//
// The one-shot set is deliberately NOT org-configurable — it's biology, not
// policy.
import {
  Animal,
  ClinicSlotProcedureType,
  MedicalRecord,
  Procedure } from
'../types';
import { animalDisplayName, formatDate } from './utils';
import { deriveProcedureName } from './medicalOptions';

/** The animal fields the duplicate check + message need. */
type DupeAnimal = Pick<
  Animal,
  'id' | 'name' | 'rescue_id' | 'microchip_number'>;


const GUIDANCE =
'Confirm this is a new procedure, or remove it to avoid a duplicate medical record.';

// Spay and neuter both mean "already altered", so either satisfies the other
// (sex corrections happen; the fact we care about is the alteration).
const ONE_SHOT_EQUIVALENTS: Partial<Record<Procedure, Procedure[]>> = {
  spay: ['spay', 'neuter'],
  neuter: ['spay', 'neuter'],
  microchip_implant: ['microchip_implant']
};

// The medical procedure a planned clinic-slot type resolves to for the check.
const SLOT_TYPE_PROBE: Partial<Record<ClinicSlotProcedureType, Procedure>> = {
  spay_neuter: 'spay',
  microchip: 'microchip_implant'
};

/**
 * The completed record that makes another one-shot record redundant, or
 * undefined (also for any repeatable procedure). Only `completed` records
 * count — a `scheduled` spay is the normal pre-clinic state, not a duplicate.
 * Pass `excludeClinicId` so records created by this clinic itself (idempotent
 * re-runs) aren't reported as "prior".
 */
export function priorOneShotRecord(
records: MedicalRecord[],
animalId: string,
procedure: Procedure | '',
opts?: { excludeClinicId?: string })
: MedicalRecord | undefined {
  const equivalents = procedure ? ONE_SHOT_EQUIVALENTS[procedure] : undefined;
  if (!equivalents) return undefined;
  return records.find(
    (m) =>
    m.animal_id === animalId &&
    m.status === 'completed' &&
    !!m.procedure &&
    equivalents.includes(m.procedure) && (
    !opts?.excludeClinicId || m.clinic_id !== opts.excludeClinicId)
  );
}

function warningFromRecord(animal: DupeAnimal, prior: MedicalRecord): string {
  const who = animalDisplayName(animal);
  const what = deriveProcedureName({
    procedure_type: prior.procedure_type,
    procedure: prior.procedure,
    custom_procedure_name: prior.custom_procedure_name
  });
  return prior.performed_date ?
  `${who} already has a ${what} record from ${formatDate(
    prior.performed_date
  )}. ${GUIDANCE}` :
  `${who} already has a completed ${what}. ${GUIDANCE}`;
}

/**
 * Short duplicate warning for a medical-record draft, or undefined when
 * there's nothing to warn about. For microchips, a chip number on the animal
 * counts as evidence of an implant even without a medical record.
 */
export function duplicateDraftWarning(
records: MedicalRecord[],
animal: DupeAnimal | undefined,
procedure: Procedure | '',
opts?: { excludeClinicId?: string })
: string | undefined {
  if (!animal) return undefined;
  const prior = priorOneShotRecord(records, animal.id, procedure, opts);
  if (prior) return warningFromRecord(animal, prior);
  if (procedure === 'microchip_implant' && animal.microchip_number) {
    return `${animalDisplayName(animal)} already has a microchip number on file (#${
    animal.microchip_number}). ${GUIDANCE}`;
  }
  return undefined;
}

/** Duplicate warning for a planned clinic-slot procedure type (scheduling). */
export function duplicateSlotTypeWarning(
records: MedicalRecord[],
animal: DupeAnimal | undefined,
type: ClinicSlotProcedureType,
opts?: { excludeClinicId?: string })
: string | undefined {
  const probe = SLOT_TYPE_PROBE[type];
  if (!probe) return undefined;
  return duplicateDraftWarning(records, animal, probe, opts);
}
