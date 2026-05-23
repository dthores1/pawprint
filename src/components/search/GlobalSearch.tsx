import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SearchIcon,
  AlertCircleIcon,
  PawPrintIcon,
  HomeIcon,
  UsersIcon,
  CommandIcon,
  ChevronRightIcon } from
'lucide-react';
import { useWhisker } from '../../context/WhiskerContext';
import { Avatar } from '../ui/Avatar';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { SpeciesBadge } from '../ui/SpeciesBadge';
import { getDaysUntil } from '../../lib/utils';
import { cn } from '../../lib/utils';
interface GlobalSearchProps {
  variant?: 'hero' | 'compact';
  placeholder?: string;
  className?: string;
}
export function GlobalSearch({
  variant = 'hero',
  placeholder,
  className
}: GlobalSearchProps) {
  const navigate = useNavigate();
  const { animals, fosters, people, medicalRecords, placements, actionItems } =
  useWhisker();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Outside click closes panel
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
  // Escape closes panel
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
      // Cmd/Ctrl + K opens & focuses
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);
  const q = query.trim().toLowerCase();
  // Filter animals
  const animalResults = useMemo(() => {
    if (!q) return [];
    return animals.
    filter((a) => {
      const hay =
      `${a.name} ${a.id} ${a.microchip_number || ''}`.toLowerCase();
      return hay.includes(q);
    }).
    slice(0, 5);
  }, [animals, q]);
  const fosterResults = useMemo(() => {
    if (!q) return [];
    return fosters.
    filter((f) => {
      const hay = `${f.first_name} ${f.last_name} ${f.email}`.toLowerCase();
      return hay.includes(q);
    }).
    slice(0, 5);
  }, [fosters, q]);
  const contactResults = useMemo(() => {
    if (!q) return [];
    return people.
    filter((p) => {
      const hay =
      `${p.first_name} ${p.last_name} ${p.email} ${p.organization_name || ''}`.toLowerCase();
      return hay.includes(q);
    }).
    slice(0, 4);
  }, [people, q]);
  // Default "Needs Attention" panel when query is empty
  const needsAttention = useMemo(() => {
    if (q) return [];
    const overdue = medicalRecords.
    filter(
      (m) =>
      m.status === 'overdue' ||
      m.status === 'due' && m.due_date && getDaysUntil(m.due_date) < 0
    ).
    map((m) => {
      const animal = animals.find((a) => a.id === m.animal_id);
      if (!animal) return null;
      return {
        kind: 'overdue' as const,
        id: `med-${m.id}`,
        animal,
        label: `Overdue: ${m.procedure_name}`
      };
    }).
    filter(Boolean) as Array<{
      kind: 'overdue';
      id: string;
      animal: (typeof animals)[number];
      label: string;
    }>;
    const highPriority = animals.
    filter((a) => a.priority === 'urgent' || a.priority === 'critical').
    map((a) => {
      const hasPlacement = placements.some(
        (p) => p.animal_id === a.id && p.placement_status === 'active'
      );
      return {
        kind: 'priority' as const,
        id: `pri-${a.id}`,
        animal: a,
        label:
        actionItems.find(
          (it) => it.animal_id === a.id && it.status === 'open'
        )?.description || (
        !hasPlacement ? 'Needs placement' : 'Needs review')
      };
    });
    return [...overdue, ...highPriority].slice(0, 5);
  }, [animals, medicalRecords, placements, actionItems, q]);
  const hasResults =
  animalResults.length > 0 ||
  fosterResults.length > 0 ||
  contactResults.length > 0 ||
  needsAttention.length > 0;
  function go(path: string) {
    setOpen(false);
    setQuery('');
    navigate(path);
  }
  const isHero = variant === 'hero';
  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <div
        className={cn(
          'relative flex items-center gap-3 bg-card border border-border rounded-2xl transition-shadow',
          isHero ?
          'px-5 h-14 shadow-soft hover:shadow-soft-lg focus-within:shadow-soft-lg focus-within:border-primary/40' :
          'px-3 h-10 hover:border-text-primary/20',
          open && 'shadow-soft-lg border-primary/40'
        )}>
        
        <SearchIcon
          className={cn(
            'shrink-0 text-text-secondary',
            isHero ? 'w-5 h-5' : 'w-4 h-4'
          )} />
        
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={
          placeholder || (
          isHero ? 'Search animals, fosters, overdue items…' : 'Search…')
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={cn(
            'flex-1 bg-transparent outline-none placeholder:text-text-secondary text-text-primary min-w-0',
            isHero ? 'text-base' : 'text-sm'
          )} />
        
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 h-6 rounded-md bg-background text-xs text-text-secondary font-mono">
          <CommandIcon className="w-3 h-3" /> K
        </kbd>
      </div>

      <AnimatePresence>
        {open &&
        <motion.div
          initial={{
            opacity: 0,
            y: -6
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -6
          }}
          transition={{
            duration: 0.15
          }}
          className="absolute z-30 mt-2 w-full bg-card border border-border rounded-2xl shadow-soft-lg overflow-hidden max-h-[28rem] overflow-y-auto">
          
            {!hasResults && q &&
          <div className="px-5 py-8 text-center text-sm text-text-secondary">
                No results for{' '}
                <span className="font-medium text-text-primary">"{query}"</span>
              </div>
          }

            {!hasResults && !q &&
          <div className="px-5 py-8 text-center text-sm text-text-secondary">
                All caught up — nothing needs attention right now. 🐾
              </div>
          }

            {/* Needs Attention (empty state default) */}
            {needsAttention.length > 0 &&
          <ResultSection
            icon={AlertCircleIcon}
            title="Needs Attention"
            tone="urgent">
            
                {needsAttention.map((r) =>
            <button
              key={r.id}
              onClick={() => go(`/animals/${r.animal.id}`)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-background transition-colors text-left group">
              
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                  src={r.animal.primary_photo_url}
                  type="animal"
                  size="sm" />
                
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary text-sm truncate">
                          {r.animal.name}
                        </p>
                        <p className="text-xs text-status-urgent-text font-medium truncate">
                          {r.label}
                        </p>
                      </div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
            )}
              </ResultSection>
          }

            {/* Animals */}
            {animalResults.length > 0 &&
          <ResultSection
            icon={PawPrintIcon}
            title="Animals"
            count={animalResults.length}>
            
                {animalResults.map((a) =>
            <button
              key={a.id}
              onClick={() => go(`/animals/${a.id}`)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-background transition-colors text-left">
              
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar
                    src={a.primary_photo_url}
                    type="animal"
                    size="sm" />
                  
                        <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                          <SpeciesBadge species={a.species} />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary text-sm truncate">
                          {a.name}
                        </p>
                        <p className="text-xs text-text-secondary font-mono">
                          #{a.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityBadge priority={a.priority} showLabel={false} />
                      <StatusBadge status={a.status} />
                    </div>
                  </button>
            )}
              </ResultSection>
          }

            {/* Fosters */}
            {fosterResults.length > 0 &&
          <ResultSection
            icon={HomeIcon}
            title="Fosters"
            count={fosterResults.length}>
            
                {fosterResults.map((f) =>
            <button
              key={f.id}
              onClick={() => go(`/fosters/${f.id}`)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-background transition-colors text-left">
              
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                  src={f.photo_url}
                  name={`${f.first_name} ${f.last_name}`}
                  colorKey={f.id}
                  size="sm" />
                
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary text-sm truncate">
                          {f.first_name} {f.last_name}
                        </p>
                        <p className="text-xs text-text-secondary truncate">
                          {f.email}
                        </p>
                      </div>
                    </div>
                  </button>
            )}
              </ResultSection>
          }

            {/* Contacts */}
            {contactResults.length > 0 &&
          <ResultSection
            icon={UsersIcon}
            title="Contacts"
            count={contactResults.length}>
            
                {contactResults.map((p) =>
            <button
              key={p.id}
              onClick={() => go('/contacts')}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-background transition-colors text-left">
              
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                  src={p.photo_url}
                  name={`${p.first_name} ${p.last_name}`}
                  colorKey={p.id}
                  size="sm" />
                
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary text-sm truncate">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-xs text-text-secondary truncate">
                          {p.organization_name || p.role.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </button>
            )}
              </ResultSection>
          }
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}
function ResultSection({
  icon: Icon,
  title,
  count,
  tone = 'neutral',
  children






}: {icon: React.ElementType;title: string;count?: number;tone?: 'neutral' | 'urgent';children: React.ReactNode;}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
        <Icon
          className={cn(
            'w-3.5 h-3.5',
            tone === 'urgent' ?
            'text-status-urgent-text' :
            'text-text-secondary'
          )} />
        
        <span
          className={cn(
            'text-xs font-semibold uppercase tracking-wider',
            tone === 'urgent' ?
            'text-status-urgent-text' :
            'text-text-secondary'
          )}>
          
          {title}
        </span>
        {count !== undefined &&
        <span className="text-xs text-text-secondary font-medium">
            ({count})
          </span>
        }
      </div>
      <div className="pb-2">{children}</div>
    </div>);

}