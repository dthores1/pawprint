import { AnimalStatus } from '../types';

// Lifecycle split used to scope the Animals list and the upfront data load.
// Canonical taxonomy is the 7 statuses from migration 0021. "In care" = the
// rescue is still actively responsible for the animal; "historical" = the
// animal has left the rescue's care. Hospice is IN CARE (end-of-life care is
// still active responsibility) — it leaves the default view only once the
// animal is marked deceased.
export const IN_CARE_STATUSES: AnimalStatus[] = [
'intake',
'medical',
'adoptable',
'hospice'];


export const HISTORICAL_STATUSES: AnimalStatus[] = [
'adopted',
'released',
'deceased'];


export function isInCare(status: AnimalStatus): boolean {
  return IN_CARE_STATUSES.includes(status);
}

// Shared display labels for every status (single source for the Animals page,
// filters, and search).
export const STATUS_LABELS: Record<AnimalStatus, string> = {
  intake: 'Intake',
  medical: 'Medical',
  adoptable: 'Adoptable',
  adopted: 'Adopted',
  released: 'Released',
  hospice: 'Hospice',
  deceased: 'Deceased'
};
