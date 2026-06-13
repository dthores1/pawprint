import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, XIcon, StethoscopeIcon } from 'lucide-react';
import { Input } from './Forms';
import { ClinicEvent } from '../../types';
import { formatDate, cn } from '../../lib/utils';
import { useTypeaheadKeyboard } from '../../lib/useTypeaheadKeyboard';

// Single-select typeahead for picking a scheduled clinic event. Mirrors
// PersonSearchPicker / AnimalSearchPicker. Searches by location and date.
interface Props {
  events: ClinicEvent[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  id?: string;
}
function eventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}
export function ClinicEventSearchPicker({
  events,
  value,
  onChange,
  placeholder = 'Search clinics by date or location…',
  id
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = events.find((e) => e.id === value) || null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...events].
    sort(
      (a, b) =>
      new Date(b.date_time).getTime() - new Date(a.date_time).getTime()
    ).
    filter((e) => {
      if (!q) return true;
      const hay = `${formatDate(e.date_time)} ${e.location}`.toLowerCase();
      return hay.includes(q);
    }).
    slice(0, 12);
  }, [events, query]);

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
          <div className="shrink-0 p-1.5 rounded-lg bg-card text-primary">
            <StethoscopeIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-text-primary truncate">
              {formatDate(selected.date_time)} · {eventTime(selected.date_time)}
            </p>
            {selected.location &&
            <p className="text-xs text-text-secondary truncate">
                {selected.location}
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
        onKeyDown={onKeyDown}
        className="pl-9" />


      <AnimatePresence>
        {open &&
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="absolute z-10 mt-1.5 w-full bg-card border border-border rounded-xl shadow-soft-lg overflow-hidden max-h-72 overflow-y-auto">

            {results.length === 0 ?
          <div className="p-4 text-sm text-text-secondary text-center">
                {query ? <>No clinics match "{query}".</> : 'No clinics yet.'}
              </div> :

          <ul className="py-1">
                {results.map((e, i) =>
            <li key={e.id}>
                    <button
                type="button"
                data-ta-index={i}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(e.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-background cursor-pointer transition-colors',
                  activeIndex === i && 'bg-background'
                )}>

                      <div className="shrink-0 p-1.5 rounded-lg bg-background text-text-secondary">
                        <StethoscopeIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate text-sm">
                          {formatDate(e.date_time)} · {eventTime(e.date_time)}
                        </p>
                        <p className="text-xs text-text-secondary truncate">
                          {e.location || 'Location TBD'}
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
