import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { CalendarPopover } from './CalendarPopover';
import { Input } from './Forms';
import { Avatar } from './Avatar';
import { SpeciesBadge } from './SpeciesBadge';
import { StatusBadge } from './Badge';
import { Animal } from '../../types';
import {
  animalDisplayName,
  animalShowsRescueIdBadge,
  calculateAge,
  cn } from
'../../lib/utils';
import { useTypeaheadKeyboard } from '../../lib/useTypeaheadKeyboard';

// Multi-select typeahead — used by the Sitting Request form when the
// foster wants to scope coverage to specific animals.
interface Props {
  animals: Animal[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  /** Limit the picker to this subset (e.g. only my current placements). */
  scope?: Animal[];
  id?: string;
}
export function AnimalMultiPicker({
  animals,
  selectedIds,
  onChange,
  placeholder = 'Search animals to add…',
  scope,
  id
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Match the dropdown width to the input. Measured when it opens.
  const [menuWidth, setMenuWidth] = useState<number>();
  useLayoutEffect(() => {
    if (open && wrapperRef.current) setMenuWidth(wrapperRef.current.offsetWidth);
  }, [open]);

  const universe = scope ?? animals;
  const selectedAnimals = selectedIds.
  map((id) => animals.find((a) => a.id === id)).
  filter((a): a is Animal => !!a);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const picked = new Set(selectedIds);
    return universe.
    filter((a) => !picked.has(a.id)).
    filter((a) => {
      if (!q) return true;
      const hay = `${a.name ?? ''} ${a.rescue_id ?? ''} ${a.id}`.toLowerCase();
      return hay.includes(q);
    }).
    slice(0, 12);
  }, [universe, query, selectedIds]);

  const add = (animalId: string) => {
    if (!selectedIds.includes(animalId)) {
      onChange([...selectedIds, animalId]);
    }
    setQuery('');
    setOpen(false);
  };
  const remove = (animalId: string) => {
    onChange(selectedIds.filter((id) => id !== animalId));
  };

  const { activeIndex, setActiveIndex, onKeyDown } = useTypeaheadKeyboard({
    open,
    setOpen,
    count: results.length,
    onChoose: (i) => add(results[i].id),
    menuRef
  });

  return (
    <div className="space-y-2">
      {selectedAnimals.length > 0 &&
      <div className="flex flex-wrap gap-2">
          {selectedAnimals.map((a) =>
        <span
          key={a.id}
          className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-primary/5 border border-primary/30 text-sm">

              <Avatar
            src={a.primary_photo_url}
            type="animal"
            species={a.species}
            size="sm"
            className="w-5 h-5" />

              <span className="font-medium text-text-primary">
                {animalDisplayName(a)}
              </span>
              <button
            type="button"
            onClick={() => remove(a.id)}
            aria-label={`Remove ${animalDisplayName(a)}`}
            className="p-0.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-card transition-colors">

                <XIcon className="w-3.5 h-3.5" />
              </button>
            </span>
        )}
        </div>
      }

      <div className="relative" ref={wrapperRef}>
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
        <Input
          id={id}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="pl-9" />


        {/* Rendered in a portal so the modal's overflow can't clip it. */}
        <CalendarPopover
          anchorRef={wrapperRef}
          open={open}
          onClose={() => setOpen(false)}
          padded={false}>

          <div
            ref={menuRef}
            style={{ width: menuWidth }}
            className="max-h-72 overflow-y-auto">

              {results.length === 0 ?
            <div className="p-4 text-sm text-text-secondary text-center">
                  {query ?
              <>No animals match "{query}".</> :

              'No more animals to add.'}
                </div> :

            <ul className="py-1">
                  {results.map((a, i) =>
              <li key={a.id}>
                      <button
                  type="button"
                  data-ta-index={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => add(a.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-background cursor-pointer transition-colors',
                    activeIndex === i && 'bg-background'
                  )}>

                        <div className="relative shrink-0">
                          <Avatar
                    src={a.primary_photo_url}
                    type="animal"
                    species={a.species}
                    size="sm" />

                          <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                            <SpeciesBadge species={a.species} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-baseline gap-1.5 min-w-0">
                            <span className="font-medium text-text-primary truncate text-sm">
                              {animalDisplayName(a)}
                            </span>
                            {animalShowsRescueIdBadge(a) &&
                      <span className="text-xs text-text-secondary font-mono truncate shrink-0">
                                {a.rescue_id}
                              </span>
                      }
                          </p>
                          <div className="mt-0.5">
                            <StatusBadge status={a.status} />
                          </div>
                        </div>
                        <span className="text-xs text-text-secondary whitespace-nowrap shrink-0">
                          {a.sex} • {calculateAge(a.estimated_birth_date)}
                        </span>
                      </button>
                    </li>
              )}
                </ul>
            }
          </div>
        </CalendarPopover>
      </div>
    </div>);

}
