import React, { useEffect, useState, useRef } from 'react';
import { ChevronDownIcon, CheckIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}
interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  defaultValue?: string;
  className?: string;
  align?: 'left' | 'right';
}
export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  defaultValue = 'all',
  className,
  align = 'left'
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
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
  const selected = options.find((o) => o.value === value);
  const isActive = value !== defaultValue;
  return (
    <div ref={wrapperRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium border transition-colors',
          isActive ?
          'bg-primary/10 text-primary border-primary/30' :
          'bg-card text-text-primary border-border hover:bg-background'
        )}>
        
        <span className="text-text-secondary font-normal">{label}:</span>
        <span className="flex items-center gap-1.5">
          {selected?.icon}
          {selected?.label || 'All'}
        </span>
        <ChevronDownIcon
          className={cn(
            'w-3.5 h-3.5 transition-transform',
            open && 'rotate-180'
          )} />
        
      </button>

      <AnimatePresence>
        {open &&
        <motion.div
          initial={{
            opacity: 0,
            y: -4
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -4
          }}
          transition={{
            duration: 0.12
          }}
          className={cn(
            'absolute z-20 mt-1.5 min-w-[12rem] bg-card border border-border rounded-xl shadow-soft-lg overflow-hidden',
            align === 'right' ? 'right-0' : 'left-0'
          )}>
          
            <ul className="py-1 max-h-72 overflow-y-auto">
              {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value}>
                    <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left transition-colors',
                      isSelected ?
                      'bg-primary/5 text-primary font-medium' :
                      'text-text-primary hover:bg-background'
                    )}>
                    
                      <span className="flex items-center gap-2">
                        {opt.icon}
                        {opt.label}
                      </span>
                      {isSelected &&
                    <CheckIcon className="w-4 h-4 text-primary shrink-0" />
                    }
                    </button>
                  </li>);

            })}
            </ul>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}