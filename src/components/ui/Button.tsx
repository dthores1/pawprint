import React from 'react';
import { cn } from '../../lib/utils';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'soft' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}
export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'bg-accent text-secondary hover:bg-[#E8D5C4]',
    outline:
    'border border-border bg-transparent hover:bg-background text-text-primary',
    ghost:
    'bg-transparent hover:bg-background text-text-secondary hover:text-text-primary',
    // Soft secondary: a semi-opaque white "chip" that reads clearly on tinted
    // backgrounds (where `outline` looks disabled), lifting on hover.
    soft:
    'bg-white/75 border border-border text-text-primary hover:bg-white hover:border-[#C9C3B6] hover:shadow-soft hover:-translate-y-0.5',
    danger: 'bg-status-urgent-bg text-status-urgent-text hover:bg-[#F0C5C5]'
  };
  const sizes = {
    xs: 'h-7 px-2.5 text-xs',
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-12 px-6 text-lg'
  };
  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}>
      
      {children}
    </button>);

}