import { Animal, Breed, Litter, MedicalRecord, Person } from '../types';
import { IN_CARE_STATUSES } from './animalStatus';

/** Members of a litter — derived from the shared animals.litter_id. */
export function litterMembers(animals: Animal[], litterId: string): Animal[] {
  return animals.filter((a) => a.litter_id === litterId);
}

/**
 * A litter is "historical" once every member has left the org's care (adopted/
 * released/deceased). An empty litter (no members assigned yet) is NOT historical
 * — it's freshly created and still operationally relevant. Derived client-side
 * from the animal index, which carries every animal's status.
 */
export function litterIsHistorical(members: Animal[]): boolean {
  return (
    members.length > 0 &&
    !members.some((m) => IN_CARE_STATUSES.includes(m.status)));

}

function monthYear(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Resolve a litter's breed name (free-text or from the catalog), if any. */
export function litterBreedLabel(
litter: Litter,
breeds?: Breed[])
: string | undefined {
  if (litter.breed_text && litter.breed_text.trim()) {
    return litter.breed_text.trim();
  }
  if (litter.breed_id && breeds) {
    return breeds.find((b) => b.id === litter.breed_id)?.name;
  }
  return undefined;
}

/**
 * Display label: the litter's name, else a generated one preferring the breed
 * for specificity ("Labrador Retriever Litter — May 2026"), falling back to the
 * species ("Cat Litter — May 2026") when no breed was recorded.
 */
export function litterLabel(litter: Litter, breeds?: Breed[]): string {
  if (litter.name && litter.name.trim()) return litter.name.trim();
  const my = monthYear(litter.estimated_birth_date || litter.intake_date);
  const base = `${litterBreedLabel(litter, breeds) || litter.species} Litter`;
  return my ? `${base} — ${my}` : base;
}

/** Species-aware noun for members, e.g. "5 kittens" / "1 puppy". */
export function memberNoun(species: string, count: number): string {
  const plural = count !== 1;
  if (species === 'Dog') return plural ? 'puppies' : 'puppy';
  if (species === 'Cat') return plural ? 'kittens' : 'kitten';
  return plural ? 'animals' : 'animal';
}

export interface LitterStatusSegment {
  key: 'foster' | 'adoptable' | 'adopted' | 'medical' | 'behavior' | 'hold';
  label: string;
}

/**
 * Status rollup as keyed segments so callers can make individual segments
 * interactive (LitterProfile turns the foster one into a "place the rest"
 * link). The foster segment reads "X of Y in foster" — the denominator is
 * what tells users at a glance that the litter isn't together.
 */
export function litterStatusSegments(members: Animal[]): LitterStatusSegment[] {
  const inFoster = members.filter((a) => !!a.current_foster_id).length;
  const adoptable = members.filter((a) => a.status === 'adoptable').length;
  const adopted = members.filter((a) => a.status === 'adopted').length;
  const medical = members.filter((a) => a.has_medical_concern).length;
  const behavior = members.filter((a) => a.has_behavior_concern).length;
  const onHold = members.filter((a) => a.is_on_hold).length;
  const segs: LitterStatusSegment[] = [];
  if (inFoster) {
    segs.push({
      key: 'foster',
      label: `${inFoster} of ${members.length} in foster`
    });
  }
  if (adoptable) segs.push({ key: 'adoptable', label: `${adoptable} adoptable` });
  if (adopted) segs.push({ key: 'adopted', label: `${adopted} adopted` });
  if (medical) segs.push({ key: 'medical', label: `${medical} medical concern` });
  if (behavior) segs.push({ key: 'behavior', label: `${behavior} behavior concern` });
  if (onHold) segs.push({ key: 'hold', label: `${onHold} on hold` });
  return segs;
}

/** Compact status rollup, e.g. "3 of 6 in foster · 1 adopted · 1 medical concern". */
export function summarizeLitterStatuses(members: Animal[]): string {
  return litterStatusSegments(members).map((s) => s.label).join(' · ');
}

/**
 * The foster shared across the litter, when the placed members are all with the
 * same person. `distinctCount` lets callers show "Multiple" when they differ.
 */
export function litterPrimaryFoster(
members: Animal[],
fosters: Person[])
: { foster: Person | null; distinctCount: number } {
  const ids = Array.from(
    new Set(members.map((a) => a.current_foster_id).filter(Boolean))
  ) as string[];
  if (ids.length === 1) {
    return { foster: fosters.find((f) => f.id === ids[0]) ?? null, distinctCount: 1 };
  }
  return { foster: null, distinctCount: ids.length };
}

/** Earliest upcoming (due/scheduled) medical record across the litter. */
export function nextLitterMilestone(
members: Animal[],
medicalRecords: MedicalRecord[])
: MedicalRecord | null {
  const memberIds = new Set(members.map((a) => a.id));
  const upcoming = medicalRecords.
  filter(
    (m) =>
    memberIds.has(m.animal_id) && (
    m.status === 'due' || m.status === 'scheduled') &&
    m.due_date
  ).
  sort(
    (a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
  );
  return upcoming[0] ?? null;
}
