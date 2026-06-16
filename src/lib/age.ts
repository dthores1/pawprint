import { AgeUnit, BirthdateSource } from '../types';

// Local date helpers (avoid UTC off-by-one that `new Date('YYYY-MM-DD')` causes).
function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Estimated birthdate = `asOf` minus the given age. Returns YYYY-MM-DD. */
export function ageToBirthdate(
value: number,
unit: AgeUnit,
asOf: string)
: string {
  const d = parseYMD(asOf);
  if (unit === 'years') d.setFullYear(d.getFullYear() - value);else
  if (unit === 'months') d.setMonth(d.getMonth() - value);else
  if (unit === 'weeks') d.setDate(d.getDate() - value * 7);else
  d.setDate(d.getDate() - value);
  return toYMD(d);
}

export interface AgeInfoInput {
  /** YYYY-MM-DD, or '' if the user is giving an estimated age instead. */
  birthdate: string;
  /** Numeric string, or '' when using a birthdate. */
  ageValue: string;
  ageUnit: AgeUnit;
  /** Date the age estimate is anchored to (intake date or today). */
  asOf: string;
  /** When true, age is explicitly Unknown — no birthdate/estimate is recorded. */
  unknown?: boolean;
}
export interface AgeInfo {
  estimated_birth_date: string;
  birthdate_source: BirthdateSource;
  estimated_age_value?: number;
  estimated_age_unit?: AgeUnit;
  estimated_age_as_of?: string;
  /** True when enough was provided to derive a birthdate. */
  valid: boolean;
}

/**
 * Resolve the canonical `estimated_birth_date` (+ derivation metadata) from
 * whichever the user provided: an explicit birthdate, or an estimated age.
 * A birthdate, if present, always wins.
 */
export function deriveAgeInfo(input: AgeInfoInput): AgeInfo {
  // Explicit "Unknown": no birthdate on file. A valid choice, so valid:true.
  if (input.unknown) {
    return {
      estimated_birth_date: '',
      birthdate_source: 'unknown',
      valid: true
    };
  }
  const bd = input.birthdate.trim();
  if (bd) {
    return {
      estimated_birth_date: bd,
      birthdate_source: 'estimated_birthdate',
      valid: true
    };
  }
  const value = parseInt(input.ageValue, 10);
  if (value > 0 && input.asOf) {
    return {
      estimated_birth_date: ageToBirthdate(value, input.ageUnit, input.asOf),
      birthdate_source: 'estimated_age',
      estimated_age_value: value,
      estimated_age_unit: input.ageUnit,
      estimated_age_as_of: input.asOf,
      valid: true
    };
  }
  return {
    estimated_birth_date: '',
    birthdate_source: 'estimated_birthdate',
    valid: false
  };
}
