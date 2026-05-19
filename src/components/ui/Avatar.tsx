import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { UserIcon } from 'lucide-react';
import { getInitialsColor, getInitials } from '../../lib/colors';
import { PawPrintIcon } from './PawPrintIcon';
import { BoneIcon } from './BoneIcon';
import { CatIcon } from '../icons/CatIcon';
import { Species } from '../../types';
interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  name?: string;
  colorKey?: string;
  type?: 'person' | 'animal';
  species?: Species;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Override the auto-hashed initials color with a fixed tone.
   * Useful when a list wants consistent avatar styling regardless of name.
   */
  tone?: 'peach';
  className?: string;
}
const TONES: Record<
  NonNullable<AvatarProps['tone']>,
  {
    bg: string;
    text: string;
  }> =
{
  peach: {
    bg: '#EBD4C0',
    text: '#A85A2A'
  }
};
export function Avatar({
  src,
  alt,
  fallback,
  name,
  colorKey,
  type = 'person',
  species,
  size = 'md',
  tone,
  className
}: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-xl'
  };
  const [error, setError] = useState(false);
  if (!src || error) {
    if (name) {
      const { bg, text } = tone ?
      TONES[tone] :
      getInitialsColor(colorKey || name);
      return (
        <div
          className={cn(
            'relative inline-flex items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight',
            sizes[size],
            className
          )}
          style={{
            backgroundColor: bg,
            color: text
          }}>
          
          {getInitials(name)}
        </div>);

    }
    return (
      <div
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden bg-accent rounded-full',
          sizes[size],
          className
        )}>
        
        <span className="font-medium text-secondary flex items-center justify-center">
          {fallback ?
          fallback :
          type === 'animal' ?
          species === 'Dog' ?
          <BoneIcon className="w-1/2 h-1/2 opacity-50" /> :
          species === 'Cat' ?
          <CatIcon className="w-1/2 h-1/2 opacity-50" /> :

          <PawPrintIcon className="w-1/2 h-1/2 opacity-50" /> :


          <UserIcon className="w-1/2 h-1/2 opacity-50" />
          }
        </span>
      </div>);

  }
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden bg-accent rounded-full',
        sizes[size],
        className
      )}>
      
      <img
        src={src}
        alt={alt || name || ''}
        className="w-full h-full object-cover"
        onError={() => setError(true)} />
      
    </div>);

}