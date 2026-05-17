import React from 'react';
import { cn } from '../../lib/utils';
import { CatIcon, DogIcon, PawPrintIcon, LayersIcon } from 'lucide-react';
import { Species } from '../../types';
interface SpeciesFilterProps {
  value: 'all' | Species;
  onChange: (value: 'all' | Species) => void;
  enabled: Species[];
  className?: string;
}
const ICON_MAP = {
  Dog: DogIcon,
  Cat: CatIcon,
  Other: PawPrintIcon
};
const ACTIVE_COLORS: Record<Species, string> = {
  Dog: 'bg-[#DCEAF7] text-[#356A9A] ring-[#B8D4EA]',
  Cat: 'bg-[#F3E4D7] text-[#B8632E] ring-[#E5C6AE]',
  Other: 'bg-[#E5E2DC] text-[#6B6B6B] ring-[#D0CCC4]'
};
export function SpeciesFilter({
  value,
  onChange,
  enabled,
  className
}: SpeciesFilterProps) {
  // Hide entirely if only one species is enabled — no filter needed.
  if (enabled.length <= 1) return null;
  const options: (
  {
    value: 'all';
    label: string;
    icon: typeof LayersIcon;
  } |
  {
    value: Species;
    label: string;
    icon: typeof DogIcon;
  })[] =
  [
  {
    value: 'all',
    label: 'All',
    icon: LayersIcon
  },
  ...enabled.map((s) => ({
    value: s,
    label: `${s}s`,
    icon: ICON_MAP[s]
  }))];

  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-xl bg-card border border-border shadow-soft',
        className
      )}>
      
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = value === opt.value;
        const colorClass =
        isActive && opt.value !== 'all' ?
        ACTIVE_COLORS[opt.value] :
        isActive ?
        'bg-primary/10 text-primary ring-primary/20' :
        'text-text-secondary hover:text-text-primary hover:bg-background';
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium transition-all',
              isActive && 'ring-1',
              colorClass
            )}>
            
            <Icon className="w-4 h-4" />
            {opt.label}
          </button>);

      })}
    </div>);

}