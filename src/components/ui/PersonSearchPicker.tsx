import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from './Forms';
import { Avatar } from './Avatar';
import { Person, PersonRole } from '../../types';

// Single-select typeahead for picking a Person. Optionally filter to a role
// (e.g. vets only for the clinic form). Mirrors AnimalSearchPicker.
interface Props {
  people: Person[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Restrict candidates to one role. Omit for everyone. */
  role?: PersonRole;
  /** Hide these ids from results. */
  excludeIds?: string[];
  id?: string;
}
export function PersonSearchPicker({
  people,
  value,
  onChange,
  placeholder = 'Search people by name or email…',
  role,
  excludeIds = [],
  id
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = people.find((p) => p.id === value) || null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const excluded = new Set(excludeIds);
    return people.
    filter((p) => !excluded.has(p.id)).
    filter((p) => (role ? p.role === role : true)).
    filter((p) => p.active).
    filter((p) => {
      if (!q) return true;
      const hay =
      `${p.first_name} ${p.last_name} ${p.email} ${p.organization_name ?? ''}`.toLowerCase();
      return hay.includes(q);
    }).
    slice(0, 12);
  }, [people, query, role, excludeIds]);

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

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            src={selected.photo_url}
            name={`${selected.first_name} ${selected.last_name}`}
            colorKey={selected.id}
            size="sm" />

          <div className="min-w-0">
            <p className="font-medium text-text-primary truncate">
              {selected.first_name} {selected.last_name}
            </p>
            {selected.organization_name &&
            <p className="text-xs text-text-secondary truncate">
                {selected.organization_name}
              </p>
            }
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setQuery('');
          }}
          className="p-1.5 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors shrink-0"
          aria-label="Clear selection">

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
            <>No matches for "{query}".</> :

            'No people available.'}
              </div> :

          <ul className="py-1">
                {results.map((p) =>
            <li key={p.id}>
                    <button
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-background cursor-pointer transition-colors">

                      <Avatar
                src={p.photo_url}
                name={`${p.first_name} ${p.last_name}`}
                colorKey={p.id}
                size="sm" />

                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate text-sm">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-xs text-text-secondary truncate">
                          {p.organization_name || p.email}
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
    </div>);

}
