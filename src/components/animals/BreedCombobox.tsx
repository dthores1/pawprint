import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon, XIcon, PlusIcon } from 'lucide-react';
import { Input } from '../ui/Forms';
import { CalendarPopover } from '../ui/CalendarPopover';
import { useWhisker } from '../../context/WhiskerContext';
import { breedFieldLabel } from '../../lib/speciesIcons';
import { acceptedBreeds } from '../../lib/orgCatalog';
import { cn } from '../../lib/utils';
import { useTypeaheadKeyboard } from '../../lib/useTypeaheadKeyboard';

// Searchable breed picker filtered by species (via the catalog species_id).
// Pick a known breed (→ breed_id) or type a custom value (→ breed_text).
// Rescues use lots of messy values ("Pit mix", "Lab mix"), so custom entry is
// first-class. The result list renders in a portal popover so it's never
// clipped by the form section's overflow.
interface BreedComboboxProps {
  /** Catalog species id whose breeds to offer. */
  speciesId?: string;
  breedId?: string;
  breedText?: string;
  onChange: (next: { breed_id?: string; breed_text?: string }) => void;
  id?: string;
}
export function BreedCombobox({
  speciesId,
  breedId,
  breedText,
  onChange,
  id
}: BreedComboboxProps) {
  const { breeds, species: speciesCatalog, organizationBreeds } = useWhisker();
  // "Breed" for cat/dog/rabbit, "Type" otherwise — keep the copy in sync.
  const noun = breedFieldLabel(
    speciesCatalog.find((s) => s.id === speciesId)?.slug
  );
  const nounPlural = `${noun.toLowerCase()}s`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Match the popover width to the input so the list aligns under it.
  const [menuWidth, setMenuWidth] = useState<number>();
  useLayoutEffect(() => {
    if (open && anchorRef.current) setMenuWidth(anchorRef.current.offsetWidth);
  }, [open]);

  const selectedBreed = breedId ?
  breeds.find((b) => b.id === breedId) :
  undefined;
  const selectedLabel = breedText ?? selectedBreed?.name;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!speciesId) return [];
    // Only breeds the org accepts for this species (org_breeds restriction).
    return acceptedBreeds(speciesId, breeds, organizationBreeds).
    filter((b) => (q ? b.name.toLowerCase().includes(q) : true)).
    slice(0, 50);
  }, [breeds, organizationBreeds, speciesId, query]);

  const trimmed = query.trim();
  const hasExactMatch = results.some(
    (b) => b.name.toLowerCase() === trimmed.toLowerCase()
  );
  const showCustomOption = trimmed.length > 0 && !hasExactMatch;

  const pickKnown = (bId: string) => {
    onChange({ breed_id: bId, breed_text: undefined });
    setQuery('');
    setOpen(false);
  };
  const pickCustom = (text: string) => {
    const v = text.trim();
    if (!v) return;
    onChange({ breed_id: undefined, breed_text: v });
    setQuery('');
    setOpen(false);
  };

  // The custom-breed row (when shown) is the last navigable row.
  const { activeIndex, setActiveIndex, onKeyDown: navKeyDown } =
  useTypeaheadKeyboard({
    open,
    setOpen,
    count: results.length + (showCustomOption ? 1 : 0),
    onChoose: (i) =>
    i < results.length ? pickKnown(results[i].id) : pickCustom(trimmed),
    menuRef
  });

  if (selectedLabel) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
        <span className="font-medium text-text-primary truncate">
          {selectedLabel}
        </span>
        <button
          type="button"
          onClick={() => onChange({ breed_id: undefined, breed_text: undefined })}
          className="p-1.5 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors shrink-0"
          aria-label="Clear breed">

          <XIcon className="w-4 h-4" />
        </button>
      </div>);

  }

  return (
    <div className="relative" ref={anchorRef}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
      <Input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={`Search ${nounPlural}…`}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          navKeyDown(e);
          // Enter with nothing highlighted still commits a typed custom value.
          if (!e.defaultPrevented && e.key === 'Enter' && showCustomOption) {
            e.preventDefault();
            pickCustom(trimmed);
          }
        }}
        className="pl-9" />

      <CalendarPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        padded={false}>

        {/* ~6 rows tall, then scroll — keeps the list compact. */}
        <div
          ref={menuRef}
          style={{ width: menuWidth }}
          className="max-h-60 overflow-y-auto">
          {results.length === 0 && !showCustomOption &&
          <div className="p-4 text-sm text-text-secondary text-center">
              No {nounPlural} available.
            </div>
          }
          {results.length > 0 &&
          <ul className="py-1">
              {results.map((b, i) =>
            <li key={b.id}>
                  <button
                type="button"
                data-ta-index={i}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pickKnown(b.id)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-background cursor-pointer transition-colors',
                  activeIndex === i && 'bg-background'
                )}>

                    {b.name}
                  </button>
                </li>
            )}
            </ul>
          }
          {showCustomOption &&
          <button
            type="button"
            data-ta-index={results.length}
            onMouseEnter={() => setActiveIndex(results.length)}
            onClick={() => pickCustom(trimmed)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-background border-t border-border cursor-pointer transition-colors',
              activeIndex === results.length && 'bg-background'
            )}>

              <PlusIcon className="w-4 h-4 shrink-0" />
              <span>
                Add custom {noun.toLowerCase()}:{' '}
                <span className="font-medium">"{trimmed}"</span>
              </span>
            </button>
          }
        </div>
      </CalendarPopover>
    </div>);

}
