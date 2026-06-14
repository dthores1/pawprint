// Input fingerprint for AI-content staleness detection.
//
// Both summaries and adoption profiles are generated from the same underlying
// data: the animal's core fields, its assigned traits, its notes, and its
// medical records. We hash a normalized projection of those inputs at
// generation time and store it on the content row (`source_fingerprint`). At
// render time we recompute the current fingerprint; if it differs, the content
// predates a change to its inputs and is flagged "may be outdated".
//
// Deliberately covers add/remove/edit of every input that affects generation:
//   * traits   — the set of assigned trait ids
//   * notes    — note ids (notes aren't edited in-app; archiving drops the id)
//   * medical  — id + status + performed_date + name + notes (so "marked
//                complete" or an edit changes the fingerprint)
//   * animal   — the human-meaningful fields the prompt uses

import { Animal, AnimalNote, MedicalRecord } from '../types';

export interface FingerprintInputs {
  animal: Animal;
  traitIds: string[];
  notes: AnimalNote[];
  medical: MedicalRecord[];
}

// Small, stable string hash (djb2 → unsigned hex). Collisions are astronomically
// unlikely for this payload and the failure mode (a missed "outdated" flag) is
// benign, so a cryptographic hash isn't warranted.
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export function computeAnimalInputsFingerprint(inputs: FingerprintInputs): string {
  const { animal, traitIds, notes, medical } = inputs;
  const payload = {
    a: [
    animal.name ?? '',
    animal.species ?? '',
    animal.breed_id ?? '',
    animal.breed_text ?? '',
    animal.sex ?? '',
    animal.estimated_birth_date ?? '',
    animal.description ?? '',
    animal.microchip_number ?? '',
    animal.status ?? ''].
    join('|'),
    t: [...traitIds].sort().join(','),
    n: notes.map((x) => x.id).sort().join(','),
    m: medical.
    map((x) =>
    [x.id, x.status, x.performed_date ?? '', x.procedure_name, x.notes ?? ''].join(
      '~'
    )
    ).
    sort().
    join(',')
  };
  return hashString(JSON.stringify(payload));
}
