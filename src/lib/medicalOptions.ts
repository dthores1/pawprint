// Centralized configuration for the structured Medical Records taxonomy.
//
// Keeps all the "which procedures are valid for this type / species / sex"
// logic in one place instead of scattering conditionals through the form, and
// provides the label maps + the back-compat `procedure_name` derivation.
//
// Mirrors the DB CHECK constraints in
// supabase/migrations/0036_medical_records_structured_procedures.sql — keep the
// two in sync when adding values.

import { ProcedureType, Procedure, Route, DoseUnit, Species, Sex } from '../types';

export type Option<T extends string = string> = {
  value: T;
  label: string;
};

// ---- Procedure type (broad category) ------------------------------------

export const PROCEDURE_TYPE_LABELS: Record<ProcedureType, string> = {
  vaccine: 'Vaccine',
  spay_neuter: 'Spay/Neuter',
  microchip: 'Microchip',
  parasite_prevention: 'Parasite Prevention',
  exam: 'Exam',
  surgery: 'Surgery',
  diagnostic_test: 'Diagnostic Test',
  medication: 'Medication',
  other: 'Other'
};

export const PROCEDURE_TYPE_OPTIONS: Option<ProcedureType>[] = (
  Object.keys(PROCEDURE_TYPE_LABELS) as ProcedureType[]
).map((value) => ({ value, label: PROCEDURE_TYPE_LABELS[value] }));

// ---- Procedure (structured subtype) -------------------------------------

// Single source of truth for human labels — option lists and display both read
// from here so a value always renders identically.
export const PROCEDURE_LABELS: Record<Procedure, string> = {
  // vaccine
  rabies: 'Rabies',
  fvrcp: 'FVRCP',
  felv: 'FeLV',
  dhpp: 'DHPP',
  bordetella: 'Bordetella',
  leptospirosis: 'Leptospirosis',
  canine_influenza: 'Canine Influenza',
  rhdv2: 'RHDV2',
  // spay/neuter
  spay: 'Spay',
  neuter: 'Neuter',
  // parasite prevention
  flea_tick_prevention: 'Flea/Tick Prevention',
  heartworm_prevention: 'Heartworm Prevention',
  deworming: 'Deworming',
  // exam
  wellness_exam: 'Wellness Exam',
  intake_exam: 'Intake Exam',
  recheck_exam: 'Recheck Exam',
  sick_exam: 'Sick Exam',
  // diagnostic test
  felv_fiv_test: 'FeLV/FIV Test',
  heartworm_test: 'Heartworm Test',
  fecal_test: 'Fecal Test',
  bloodwork: 'Bloodwork',
  urinalysis: 'Urinalysis',
  xray: 'X-ray',
  ultrasound: 'Ultrasound',
  // microchip
  microchip_implant: 'Microchip Implant',
  microchip_scan: 'Microchip Scan',
  // medication
  antibiotic: 'Antibiotic',
  pain_medication: 'Pain Medication',
  anti_inflammatory: 'Anti-inflammatory',
  sedative: 'Sedative',
  // surgery
  dental_surgery: 'Dental Surgery',
  mass_removal: 'Mass Removal',
  wound_repair: 'Wound Repair',
  eye_surgery: 'Eye Surgery',
  orthopedic_surgery: 'Orthopedic Surgery',
  // catch-all
  other: 'Other'
};

const opt = (value: Procedure): Option<Procedure> => ({
  value,
  label: PROCEDURE_LABELS[value]
});

// Vaccines are species-specific. Keyed by the app's TitleCase Species values.
const VACCINE_OPTIONS_BY_SPECIES: Record<Species, Option<Procedure>[]> = {
  Dog: [
    opt('rabies'),
    opt('dhpp'),
    opt('bordetella'),
    opt('leptospirosis'),
    opt('canine_influenza'),
    opt('other')
  ],
  Cat: [opt('rabies'), opt('fvrcp'), opt('felv'), opt('other')],
  Other: [opt('rabies'), opt('rhdv2'), opt('other')]
};

// Non-vaccine, non-spay/neuter types map straight to a fixed option list.
const PROCEDURE_OPTIONS_BY_TYPE: Partial<Record<ProcedureType, Option<Procedure>[]>> = {
  parasite_prevention: [
    opt('flea_tick_prevention'),
    opt('heartworm_prevention'),
    opt('deworming'),
    opt('other')
  ],
  exam: [
    opt('wellness_exam'),
    opt('intake_exam'),
    opt('recheck_exam'),
    opt('sick_exam'),
    opt('other')
  ],
  diagnostic_test: [
    opt('felv_fiv_test'),
    opt('heartworm_test'),
    opt('fecal_test'),
    opt('bloodwork'),
    opt('urinalysis'),
    opt('xray'),
    opt('ultrasound'),
    opt('other')
  ],
  microchip: [opt('microchip_implant'), opt('microchip_scan'), opt('other')],
  surgery: [
    opt('dental_surgery'),
    opt('mass_removal'),
    opt('wound_repair'),
    opt('eye_surgery'),
    opt('orthopedic_surgery'),
    opt('other')
  ],
  medication: [
    opt('antibiotic'),
    opt('pain_medication'),
    opt('anti_inflammatory'),
    opt('sedative'),
    opt('other')
  ],
  other: [opt('other')]
};

const OTHER_ONLY: Option<Procedure>[] = [opt('other')];

/** The valid `procedure` options for a given type, gated by species/sex. */
export function getProcedureOptions({
  procedureType,
  species,
  sex
}: {
  procedureType: ProcedureType;
  species?: Species | null;
  sex?: Sex | null;
}): Option<Procedure>[] {
  if (procedureType === 'vaccine') {
    return VACCINE_OPTIONS_BY_SPECIES[species ?? 'Other'] ?? VACCINE_OPTIONS_BY_SPECIES.Other;
  }

  if (procedureType === 'spay_neuter') {
    if (sex === 'Female') return [opt('spay'), opt('other')];
    if (sex === 'Male') return [opt('neuter'), opt('other')];
    return [opt('spay'), opt('neuter'), opt('other')];
  }

  return PROCEDURE_OPTIONS_BY_TYPE[procedureType] ?? OTHER_ONLY;
}

/**
 * The default `procedure` to pre-select when a type is chosen. Picks the
 * obvious one so the user rarely has to touch the field:
 *  - single-option types auto-select that option
 *  - vaccine → rabies, microchip → microchip implant
 *  - spay/neuter → spay or neuter, whichever the sex makes applicable
 *    (left blank when sex is unknown, since both apply)
 * Returns '' when there's no sensible default. Always a member of the current
 * option set (defensively verified).
 */
export function getDefaultProcedure({
  procedureType,
  species,
  sex
}: {
  procedureType: ProcedureType;
  species?: Species | null;
  sex?: Sex | null;
}): Procedure | '' {
  const options = getProcedureOptions({ procedureType, species, sex });
  if (options.length === 1) return options[0].value;

  let preferred: Procedure | '' = '';
  if (procedureType === 'vaccine') preferred = 'rabies';
  else if (procedureType === 'microchip') preferred = 'microchip_implant';
  else if (procedureType === 'spay_neuter') {
    if (sex === 'Female') preferred = 'spay';
    else if (sex === 'Male') preferred = 'neuter';
  }

  return preferred && options.some((o) => o.value === preferred) ? preferred : '';
}

/** Context-appropriate field label for the `procedure` select. */
export function getProcedureLabel(procedureType: ProcedureType): string {
  switch (procedureType) {
    case 'vaccine':
      return 'Vaccine Type';
    case 'spay_neuter':
      return 'Procedure';
    case 'parasite_prevention':
      return 'Prevention Type';
    case 'diagnostic_test':
      return 'Test Type';
    case 'medication':
      return 'Medication Type';
    case 'exam':
      return 'Exam Type';
    case 'surgery':
      return 'Surgery Type';
    case 'microchip':
      return 'Microchip Action';
    default:
      return 'Procedure';
  }
}

// ---- Conditional field visibility ---------------------------------------

export const showCustomProcedureName = (procedure: string | undefined): boolean =>
  procedure === 'other';

export const showProductName = (procedureType: ProcedureType): boolean =>
  procedureType === 'parasite_prevention' ||
  procedureType === 'medication' ||
  procedureType === 'vaccine';

export const showMicrochipNumber = (procedureType: ProcedureType): boolean =>
  procedureType === 'microchip';

// Lot / manufacturer / dosage / route / expiration are most meaningful for
// administered products: vaccines, medications, and parasite preventatives.
export const showClinicalDetail = (procedureType: ProcedureType): boolean =>
  procedureType === 'vaccine' ||
  procedureType === 'medication' ||
  procedureType === 'parasite_prevention';

// ---- Clinical detail option lists ---------------------------------------

export const ROUTE_LABELS: Record<Route, string> = {
  oral: 'Oral',
  topical: 'Topical',
  subcutaneous: 'Subcutaneous',
  intramuscular: 'Intramuscular',
  intravenous: 'Intravenous',
  intranasal: 'Intranasal',
  otic: 'Otic (ear)',
  ophthalmic: 'Ophthalmic (eye)',
  other: 'Other'
};

export const ROUTE_OPTIONS: Option<Route>[] = (
  Object.keys(ROUTE_LABELS) as Route[]
).map((value) => ({ value, label: ROUTE_LABELS[value] }));

export const DOSE_UNIT_LABELS: Record<DoseUnit, string> = {
  ml: 'mL',
  mg: 'mg',
  tablet: 'tablet',
  capsule: 'capsule',
  dose: 'dose',
  drop: 'drop',
  application: 'application',
  other: 'other'
};

export const DOSE_UNIT_OPTIONS: Option<DoseUnit>[] = (
  Object.keys(DOSE_UNIT_LABELS) as DoseUnit[]
).map((value) => ({ value, label: DOSE_UNIT_LABELS[value] }));

// ---- Display + back-compat ----------------------------------------------

/**
 * Human label for a record's procedure, preferring the structured value and
 * falling back to the custom name, then the broad type. Used for display and
 * to keep the legacy `procedure_name` column populated.
 */
export function deriveProcedureName(input: {
  procedure_type: ProcedureType;
  procedure?: Procedure;
  custom_procedure_name?: string;
}): string {
  if (input.procedure === 'other') {
    return (input.custom_procedure_name ?? '').trim() || PROCEDURE_TYPE_LABELS[input.procedure_type];
  }
  if (input.procedure) return PROCEDURE_LABELS[input.procedure];
  return PROCEDURE_TYPE_LABELS[input.procedure_type];
}
