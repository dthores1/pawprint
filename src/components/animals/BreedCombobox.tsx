import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, XIcon, PlusIcon } from 'lucide-react';
import { Input } from '../ui/Forms';
import { useWhisker } from '../../context/WhiskerContext';
import { Species } from '../../types';
import { breedSpeciesKeys } from '../../lib/breedsApi';

// Searchable breed picker filtered by species. Pick a known breed (→ breed_id)
// or type a custom value (→ breed_text). Rescues use lots of messy values
// ("Pit mix", "Lab mix"), so custom entry is first-class.
interface BreedComboboxProps {
  species: Species;
  breedId?: string;
  breedText?: string;
  onChange: (next: { breed_id?: string; breed_text?: string }) => void;
  id?: string;
}
export function BreedCombobox({
  species,
  breedId,
  breedText,
  onChange,
  id
}: BreedComboboxProps) {
  const { breeds } = useWhisker();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedBreed = breedId ?
  breeds.find((b) => b.id === breedId) :
  undefined;
  const selectedLabel = breedText ?? selectedBreed?.name;

  const speciesKeys = breedSpeciesKeys(species);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return breeds.
    filter((b) => b.active && speciesKeys.includes(b.species)).
    filter((b) => (q ? b.name.toLowerCase().includes(q) : true)).
    slice(0, 50);
  }, [breeds, speciesKeys, query]);

  const trimmed = query.trim();
  const hasExactMatch = results.some(
    (b) => b.name.toLowerCase() === trimmed.toLowerCase()
  );
  const showCustomOption = trimmed.length > 0 && !hasExactMatch;

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
    <div className="relative" ref={wrapperRef}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
      <Input
        id={id}
        type="text"
        autoComplete="off"
        placeholder="Search breeds…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && showCustomOption) {
            e.preventDefault();
            pickCustom(trimmed);
          }
        }}
        className="pl-9" />


      <AnimatePresence>
        {open &&
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="absolute z-10 mt-1.5 w-full bg-card border border-border rounded-xl shadow-soft-lg overflow-hidden max-h-72 overflow-y-auto">

            {results.length === 0 && !showCustomOption &&
          <div className="p-4 text-sm text-text-secondary text-center">
                No breeds available.
              </div>
          }
            {results.length > 0 &&
          <ul className="py-1">
                {results.map((b) =>
            <li key={b.id}>
                    <button
                type="button"
                onClick={() => pickKnown(b.id)}
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-background cursor-pointer transition-colors">

                      {b.name}
                    </button>
                  </li>
            )}
              </ul>
          }
            {showCustomOption &&
          <button
            type="button"
            onClick={() => pickCustom(trimmed)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-background border-t border-border cursor-pointer transition-colors">

                <PlusIcon className="w-4 h-4 shrink-0" />
                <span>
                  Add custom breed:{' '}
                  <span className="font-medium">"{trimmed}"</span>
                </span>
              </button>
          }
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}
