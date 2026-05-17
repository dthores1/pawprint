import React from 'react';
import { CatIcon, DogIcon, PawPrintIcon } from 'lucide-react';
import { Species } from '../../types';
import { cn } from '../../lib/utils';
const ICON_MAP = {
  Dog: DogIcon,
  Cat: CatIcon,
  Other: PawPrintIcon
};
const COLOR_MAP: Record<Species, string> = {
  Dog: 'bg-[#DCEAF7] text-[#356A9A]',
  Cat: 'bg-[#F3E4D7] text-[#B8632E]',
  Other: 'bg-[#E5E2DC] text-[#6B6B6B]'
};
interface SpeciesBadgeProps {
  species: Species;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}
export function SpeciesBadge({
  species,
  showLabel = false,
  size = 'sm',
  className
}: SpeciesBadgeProps) {
  const Icon = ICON_MAP[species];
  const colors = COLOR_MAP[species];
  if (!showLabel) {
    // Just the icon in a soft colored circle
    const dim = size === 'md' ? 'w-7 h-7' : 'w-6 h-6';
    const iconDim = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          colors,
          dim,
          className
        )}
        title={species}
        aria-label={species}>
        
        <Icon className={iconDim} />
      </span>);

  }
  const padding = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';
  const iconDim = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        colors,
        padding,
        textSize,
        className
      )}>
      
      <Icon className={iconDim} />
      {species}
    </span>);

}