import React, { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, CheckIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { FilterOption } from './FilterDropdown';

interface MultiFilterDropdownProps {
  label: string;
  /** Selected values. Empty array means "all" (no filtering). */
  values: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
  className?: string;
  /** Extra classes merged into the trigger button (e.g. full-width on mobile). */
  triggerClassName?: string;
  align?: 'left' | 'right';
  /** Text shown in the trigger when nothing is selected. */
  allLabel?: string;
}

// Multi-select sibling of FilterDropdown. Each option toggles independently;
// an empty selection means "all". Use when several values can be active at once
// (e.g. pick multiple statuses).
export function MultiFilterDropdown({
  label,
  values,
  options,
  onChange,
  className,
  triggerClassName,
  align = 'left',
  allLabel = 'All'
}: MultiFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isActive = values.length > 0;
  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  const single = values.length === 1 ? options.find((o) => o.value === values[0]) : undefined;
  const summary =
  values.length === 0 ?
  allLabel :
  values.length === 1 ?
  single?.label ?? '1 selected' :
  `${values.length} selected`;

  return (
    <div ref={wrapperRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium border transition-colors',
          isActive ?
          'bg-primary/10 text-primary border-primary/30' :
          'bg-card text-text-primary border-border hover:bg-background',
          triggerClassName
        )}>

        <span className="flex items-center gap-2 min-w-0">
          <span className="text-text-secondary font-normal">{label}:</span>
          <span className="flex items-center gap-1.5 truncate">
            {single?.icon}
            {summary}
          </span>
        </span>
        <ChevronDownIcon
          className={cn('w-3.5 h-3.5 shrink-0 transition-transform', open && 'rotate-180')} />

      </button>

      <AnimatePresence>
        {open &&
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          className={cn(
            'absolute z-20 mt-1.5 min-w-[12rem] bg-card border border-border rounded-xl shadow-soft-lg overflow-hidden',
            align === 'right' ? 'right-0' : 'left-0'
          )}>

            <ul className="py-1 max-h-72 overflow-y-auto">
              {options.map((opt) => {
              const isSelected = values.includes(opt.value);
              return (
                <li key={opt.value}>
                    <button
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                      isSelected ?
                      'text-primary font-medium' :
                      'text-text-primary hover:bg-background'
                    )}>

                      <span
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        isSelected ?
                        'bg-primary border-primary text-white' :
                        'border-border'
                      )}>

                        {isSelected && <CheckIcon className="w-3 h-3" />}
                      </span>
                      <span className="flex items-center gap-2">
                        {opt.icon}
                        {opt.label}
                      </span>
                    </button>
                  </li>);

            })}
            </ul>
            {values.length > 0 &&
          <div className="border-t border-border p-1">
                <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-background rounded-md transition-colors">

                  Clear
                </button>
              </div>
          }
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}
