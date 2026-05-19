import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from './Forms';
import { Avatar } from './Avatar';
import { SpeciesBadge } from './SpeciesBadge';
import { Animal } from '../../types';

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
      return (
        a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));

    }).
    slice(0, 12);
  }, [universe, query, selectedIds]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
      wrapperRef.current &&
      !wrapperRef.current.contains(e.target as Node))
      {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  return (
    <div className="space-y-2">
      {selectedAnimals.length > 0 &&
      <div className="flex flex-wrap gap-2">
          {selectedAnimals.map((a) =>
        <span
          key={a.id}
          className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-primary/5 border border-primary/30 text-sm">

              <Avatar
            src={a.primary_photo_url}
            type="animal"
            species={a.species}
            size="sm"
            className="w-6 h-6" />

              <span className="font-medium text-text-primary">{a.name}</span>
              <button
            type="button"
            onClick={() => remove(a.id)}
            aria-label={`Remove ${a.name}`}
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
          className="pl-9" />


        <AnimatePresence>
          {open &&
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-10 mt-1.5 w-full bg-card border border-border rounded-xl shadow-soft-lg overflow-hidden max-h-72 overflow-y-auto">

              {results.length === 0 ?
            <div className="p-4 text-sm text-text-secondary text-center">
                  {query ?
              <>No animals match "{query}".</> :

              'No more animals to add.'}
                </div> :

            <ul className="py-1">
                  {results.map((a) =>
              <li key={a.id}>
                      <button
                  type="button"
                  onClick={() => add(a.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-background cursor-pointer transition-colors">

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
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary truncate text-sm">
                            {a.name}
                          </p>
                          <p className="text-xs text-text-secondary font-mono">
                            #{a.id}
                          </p>
                        </div>
                      </button>
                    </li>
              )}
                </ul>
            }
            </motion.div>
          }
        </AnimatePresence>
      </div>
    </div>);

}
