import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from './Forms';
import { Avatar } from './Avatar';
import { SpeciesBadge } from './SpeciesBadge';
import { StatusBadge } from './Badge';
import { CalendarPopover } from './CalendarPopover';
import { Animal } from '../../types';
import {
  animalDisplayName,
  animalShowsRescueIdBadge,
  calculateAge,
  cn } from
'../../lib/utils';
import { useTypeaheadKeyboard } from '../../lib/useTypeaheadKeyboard';

// Single-select typeahead for picking one animal. Same UX shape as the
// foster picker in PlaceAnimalModal — we use it across the new coordination
// forms (Transport, Clinic slot, etc.) so relational lookups stop being
// dropdowns. (See CLAUDE.md "Relational pickers" convention.)
interface Props {
  animals: Animal[];
  /** Selected animal id, or empty string for none. */
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Hide these animal ids from results (e.g. already-linked entities). */
  excludeIds?: string[];
  id?: string;
}
export function AnimalSearchPicker({
  animals,
  value,
  onChange,
  placeholder = 'Search animals by name…',
  excludeIds = [],
  id
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = animals.find((a) => a.id === value) || null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const excluded = new Set(excludeIds);
    return animals.
    filter((a) => !excluded.has(a.id)).
    filter((a) => {
      if (!q) return true;
      const hay = `${a.name ?? ''} ${a.rescue_id ?? ''} ${a.id}`.toLowerCase();
      return hay.includes(q);
    }).
    slice(0, 12);
  }, [animals, query, excludeIds]);

  const { activeIndex, setActiveIndex, onKeyDown } = useTypeaheadKeyboard({
    open,
    setOpen,
    count: results.length,
    onChoose: (i) => {
      onChange(results[i].id);
      setOpen(false);
      setQuery('');
    },
    menuRef
  });

  // Match the dropdown width to the input each time it opens.
  useLayoutEffect(() => {
    if (open) setMenuWidth(wrapperRef.current?.offsetWidth);
  }, [open]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar
              src={selected.primary_photo_url}
              type="animal"
              species={selected.species}
              size="sm" />

            <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
              <SpeciesBadge species={selected.species} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-text-primary truncate">
              {animalDisplayName(selected)}
            </p>
            <div className="flex items-center gap-2 mt-0.5 min-w-0">
              <StatusBadge status={selected.status} />
              {animalShowsRescueIdBadge(selected) &&
                <span className="text-xs text-text-secondary font-mono truncate">
                  {selected.rescue_id}
                </span>
              }
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setQuery('');
          }}
          className="p-1.5 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors shrink-0"
          aria-label="Clear selected animal">

          <XIcon className="w-4 h-4" />
        </button>
      </div>);

  }

  return (
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
            'No animals available.'}
            </div> :

          <ul className="py-1">
              {results.map((a, i) =>
            <li key={a.id}>
                  <button
                type="button"
                data-ta-index={i}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                  setQuery('');
                }}
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
    </div>);

}
