import React from 'react';
import { Cat, Dog, Rabbit, Bird, PawPrint } from 'lucide-react';
import { ReptileIcon } from '../components/icons/ReptileIcon';
import { HorseIcon } from '../components/icons/HorseIcon';
import { PigIcon } from '../components/icons/PigIcon';
import { RatIcon } from '../components/icons/RatIcon';

export type SpeciesIconComponent = React.ComponentType<{ className?: string }>;

// Catalog `icon_name` → icon component. Lucide for the common species; the
// custom glyphs (src/assets/icons/animals) for the less common ones. `turtle`
// is aliased to the reptile glyph so pre-0041 data still renders correctly.
const ICON_BY_NAME: Record<string, SpeciesIconComponent> = {
  cat: Cat,
  dog: Dog,
  rabbit: Rabbit,
  bird: Bird,
  reptile: ReptileIcon,
  turtle: ReptileIcon,
  rat: RatIcon,
  pig: PigIcon,
  horse: HorseIcon,
  'paw-print': PawPrint
};

/** Resolve a catalog icon_name to its component (paw-print fallback). */
export function speciesIconComponent(
iconName?: string | null)
: SpeciesIconComponent {
  return (iconName && ICON_BY_NAME[iconName]) || PawPrint;
}

/** Render a species icon by its catalog icon_name. */
export function SpeciesIcon({
  iconName,
  className
}: {
  iconName?: string | null;
  className?: string;
}) {
  const Comp = speciesIconComponent(iconName);
  return <Comp className={className} />;
}

// Canonical species *name* → icon_name, for surfaces that only carry the
// species text (Avatar, SpeciesBadge) rather than the catalog row.
const ICON_NAME_BY_SPECIES: Record<string, string> = {
  Cat: 'cat',
  Dog: 'dog',
  Rabbit: 'rabbit',
  Bird: 'bird',
  Reptile: 'reptile',
  'Small Mammal': 'rat',
  'Farm Animal': 'pig',
  Horse: 'horse',
  Other: 'paw-print'
};

/** Resolve a species *name* (e.g. animal.species) to its icon component. */
export function speciesIconByName(name?: string | null): SpeciesIconComponent {
  return speciesIconComponent(name ? ICON_NAME_BY_SPECIES[name] : undefined);
}

// "Breed" reads naturally for cat/dog/rabbit; "Type" fits reptiles, birds,
// small mammals, etc. (where the catalog rows are really types, not breeds).
const BREED_LABEL_SLUGS = new Set(['cat', 'dog', 'rabbit']);

/** Field label for the breed/type picker, by species slug. */
export function breedFieldLabel(speciesSlug?: string | null): 'Breed' | 'Type' {
  return speciesSlug && BREED_LABEL_SLUGS.has(speciesSlug) ? 'Breed' : 'Type';
}
