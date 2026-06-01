import { useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon, ClockIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CalendarPopover } from './CalendarPopover';

// Calendar-popover replacement for `<input type="datetime-local">`. Value and
// onChange use the same `yyyy-MM-ddTHH:mm` (local) string shape as the native
// input, so submit logic (`new Date(value).toISOString()`) is unchanged.
interface DateTimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  required?: boolean;
  align?: 'start' | 'end';
  className?: string;
  /** Earliest selectable day. Past days are grayed out in the calendar. */
  minDate?: Date;
}
const DEFAULT_TIME = '09:00';
const TIME_SELECT_CLASS =
'flex-1 min-w-0 h-9 rounded-lg border border-border bg-white px-2 text-sm text-center text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer';

export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = 'Select date & time',
  disabled,
  error,
  required,
  align,
  className,
  minDate
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const parsed = value ? parseISO(value) : undefined;
  const valid = parsed && isValid(parsed);
  const timeStr = valid ? format(parsed as Date, 'HH:mm') : '';

  // Decompose the current (or default) time into 12-hour parts for the selects.
  const [baseHourStr, baseMinute] = (timeStr || DEFAULT_TIME).split(':');
  const hour24 = parseInt(baseHourStr, 10);
  const minute = baseMinute;
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;

  const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
  // Keep an off-step minute (e.g. from existing data) selectable.
  const minuteOptions = MINUTES.includes(minute) ?
  MINUTES :
  [...MINUTES, minute].sort();

  const handleDate = (d?: Date) => {
    if (!d) {
      onChange('');
      return;
    }
    onChange(`${format(d, 'yyyy-MM-dd')}T${timeStr || DEFAULT_TIME}`);
  };
  const emitTime = (h24: number, m: string) => {
    const datePart = valid ?
    format(parsed as Date, 'yyyy-MM-dd') :
    format(new Date(), 'yyyy-MM-dd');
    onChange(`${datePart}T${String(h24).padStart(2, '0')}:${m}`);
  };
  const setHour12 = (h: number) =>
  emitTime(period === 'PM' ? h % 12 + 12 : h % 12, minute);
  const setMinute = (m: string) => emitTime(hour24, m);
  const setPeriod = (p: 'AM' | 'PM') =>
  emitTime(p === 'PM' ? hour12 % 12 + 12 : hour12 % 12, minute);

  return (
    <>
      <button
        type="button"
        id={id}
        ref={anchorRef}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-invalid={error || undefined}
        aria-required={required || undefined}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}>

        <span className={valid ? 'text-text-primary' : 'text-text-secondary'}>
          {valid ?
          format(parsed as Date, 'MMM d, yyyy · h:mm a') :
          placeholder}
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
          onSelect={handleDate}
          disabled={minDate ? { before: minDate } : undefined} />

        <div className="border-t border-border mt-1 pt-2.5 px-1">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium text-text-primary">
            <ClockIcon className="w-4 h-4 text-text-secondary" />
            Time
          </div>
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Hour"
              value={hour12}
              onChange={(e) => setHour12(Number(e.target.value))}
              className={TIME_SELECT_CLASS}>

              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) =>
              <option key={h} value={h}>
                  {h}
                </option>
              )}
            </select>
            <span className="text-text-secondary font-medium">:</span>
            <select
              aria-label="Minute"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className={TIME_SELECT_CLASS}>

              {minuteOptions.map((m) =>
              <option key={m} value={m}>
                  {m}
                </option>
              )}
            </select>
            <select
              aria-label="AM/PM"
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'AM' | 'PM')}
              className={TIME_SELECT_CLASS}>

              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
        <div className="px-2 pt-2.5 pb-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-lg bg-primary text-white text-sm font-medium py-2 hover:bg-primary-hover transition-colors">

            Done
          </button>
        </div>
      </CalendarPopover>
    </>);

}
