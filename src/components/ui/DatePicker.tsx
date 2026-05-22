import React, { useRef, useState } from 'react';
import { DayPicker, Matcher } from 'react-day-picker';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CalendarPopover } from './CalendarPopover';

// Calendar-popover replacement for `<input type="date">`. Value and onChange use
// the same `yyyy-MM-dd` string shape as the native input, so call sites only
// swap the element and adjust onChange to receive the value directly.
interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  /** Right-align the popover (use for fields in the right column of a grid). */
  align?: 'start' | 'end';
  /** Inclusive bounds, `yyyy-MM-dd`. */
  min?: string;
  max?: string;
  className?: string;
}
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Select a date',
  disabled,
  error,
  align,
  min,
  max,
  className
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const parsed = value ? parseISO(value) : undefined;
  const valid = parsed && isValid(parsed);
  const minDate = min ? parseISO(min) : undefined;
  const maxDate = max ? parseISO(max) : undefined;

  const disabledMatchers: Matcher[] = [];
  if (minDate) disabledMatchers.push({ before: minDate });
  if (maxDate) disabledMatchers.push({ after: maxDate });

  // Offer a one-click "Today" shortcut, unless today falls outside min/max.
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayAllowed = (!min || todayStr >= min) && (!max || todayStr <= max);

  const handleSelect = (d?: Date) => {
    if (d) {
      onChange(format(d, 'yyyy-MM-dd'));
      setOpen(false);
    } else {
      onChange('');
    }
  };

  return (
    <>
      <button
        type="button"
        id={id}
        ref={anchorRef}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-invalid={error || undefined}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}>

        <span className={valid ? 'text-text-primary' : 'text-text-secondary'}>
          {valid ? format(parsed as Date, 'MMM d, yyyy') : placeholder}
        </span>
        <CalendarIcon className="w-4 h-4 text-text-secondary shrink-0" />
      </button>
      <CalendarPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        align={align}>

        <DayPicker
          className="pp-calendar"
          mode="single"
          selected={valid ? parsed : undefined}
          defaultMonth={valid ? parsed : undefined}
          onSelect={handleSelect}
          disabled={disabledMatchers.length ? disabledMatchers : undefined} />

        {todayAllowed &&
        <div className="border-t border-border mt-1 pt-2 px-1">
            <button
            type="button"
            onClick={() => handleSelect(new Date())}
            className="w-full rounded-lg py-1.5 text-sm font-medium text-primary hover:bg-background transition-colors">

              Today
            </button>
          </div>
        }
      </CalendarPopover>
    </>);

}
