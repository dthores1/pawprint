import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { PersonRole } from '../../types';
import { ROLE_GROUPS } from './RolesMultiSelect';
import { CalendarPopover } from './CalendarPopover';
import { cn } from '../../lib/utils';

interface Props {
  value: PersonRole[];
  onChange: (roles: PersonRole[]) => void;
  /** Trigger placeholder when nothing is selected. */
  placeholder?: string;
  id?: string;
}

// Form-shaped trigger that opens a checkbox popover for picking org roles.
// Uses CalendarPopover so the floating panel is portalled to <body> — it
// never gets clipped by a Card's overflow or stacking context.
//
// Use this when roles are an optional add-on to another form (the invite
// form). For the primary foster/contact forms, use RolesMultiSelect — chips
// are more glanceable for a required, prominent field.
export function RolesPickerPopover({
  value,
  onChange,
  placeholder = 'Select roles…',
  id
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Width-match the popover to the trigger each time it opens so the panel
  // visually reads as an extension of the field.
  useLayoutEffect(() => {
    if (open) setMenuWidth(triggerRef.current?.offsetWidth);
  }, [open]);

  const toggle = (r: PersonRole) =>
  onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);

  // Trigger label from the current selection, using each option's human
  // label (not the raw key) so it reads naturally.
  const labelByValue = new Map<PersonRole, string>();
  for (const g of ROLE_GROUPS) {
    for (const o of g.roles) labelByValue.set(o.value, o.label);
  }
  const triggerText =
  value.length === 0 ?
  placeholder :
  value.length <= 3 ?
  value.map((v) => labelByValue.get(v) ?? v).join(', ') :
  `${value.length} selected`;

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          value.length === 0 && 'text-text-secondary'
        )}>

        <span className="truncate text-left">{triggerText}</span>
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 text-text-secondary shrink-0 transition-transform',
            open && 'rotate-180'
          )} />

      </button>

      <CalendarPopover
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        padded={false}>

        <div
          style={{ width: menuWidth }}
          className="max-h-80 overflow-y-auto p-2 space-y-3 min-w-[16rem]">

          {ROLE_GROUPS.map((group) =>
          <div key={group.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary px-1.5 mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.roles.map(({ value: r, label }) => {
                const checked = value.includes(r);
                return (
                  <label
                    key={r}
                    className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-md hover:bg-background cursor-pointer">

                      <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary" />

                      <span className="text-sm text-text-primary">{label}</span>
                    </label>);

              })}
              </div>
            </div>
          )}
        </div>
      </CalendarPopover>
    </>);

}
