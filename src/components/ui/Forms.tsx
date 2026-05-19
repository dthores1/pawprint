import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
// Normalize Safari's stubborn native date/time picker rendering so date inputs
// match the text alignment of the rest of the form fields. Notes:
//   - We deliberately don't add `appearance-none`; on WebKit it collapses the
//     native internal layout and pulls the calendar picker into the middle.
//   - We deliberately don't rely on the host input being `display: flex`
//     either — the value text and calendar icon live in a UA shadow tree
//     that doesn't participate in the host's flex layout, so a flex display
//     on the input only ends up squashing both onto the left. The base
//     Input drops `flex` for that reason.
const DATE_NORMALIZE_CLASSES =
'text-left [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:text-left [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0';
export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    const isDateLike =
    type === 'date' ||
    type === 'time' ||
    type === 'datetime-local' ||
    type === 'month' ||
    type === 'week';
    return (
      <input
        type={type}
        className={cn(
          'block h-11 w-full rounded-lg border border-border bg-white px-3.5 py-2 text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
          isDateLike && DATE_NORMALIZE_CLASSES,
          className
        )}
        ref={ref}
        {...props} />);


  });
Input.displayName = 'Input';
export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-11 w-full rounded-lg border border-border bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}>
        
      {children}
    </select>);

  });
Select.displayName = 'Select';
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[88px] w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props} />);


  });
Textarea.displayName = 'Textarea';
export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-text-primary mb-2 block',
        className
      )}
      {...props}>
      
      {children}
    </label>);

}