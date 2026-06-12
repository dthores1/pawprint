import React from 'react';
import { PersonRole } from '../../types';
import { cn } from '../../lib/utils';

// Multi-select chips for a person's roles/capabilities — one flat field (there
// is no separate "volunteer type"). Grouped visually for clarity. `locked` roles
// render selected and can't be toggled off (used to pin 'foster_parent' on the
// foster form). 'volunteer' is intentionally not offered here (legacy fallback).
export const ROLE_GROUPS: {
  label: string;
  roles: { value: PersonRole; label: string }[];
}[] = [
{
  label: 'Animal Care',
  roles: [
  { value: 'foster_parent', label: 'Foster Parent' },
  { value: 'adopter', label: 'Adopter' }]

},
{
  label: 'Volunteer / Support',
  // 'admin' is intentionally NOT offered here — it's an *org-level* permission
  // (owner / admin / member), not a hat someone wears day-to-day. Mixing the
  // two confused inviters into double-granting access. Existing rows that
  // still carry 'admin' in `roles` keep displaying; only new selections are
  // restricted.
  roles: [
  { value: 'event_support', label: 'Event Support' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'trapper', label: 'Trapper' },
  { value: 'transport', label: 'Transport' },
  { value: 'donor', label: 'Donor' },
  { value: 'community_contact', label: 'Community Contact' }]

},
{
  label: 'Organization',
  roles: [
  { value: 'rescue_staff', label: 'Rescue Staff' },
  { value: 'vet', label: 'Vet' }]

}];


interface Props {
  value: PersonRole[];
  onChange: (roles: PersonRole[]) => void;
  locked?: PersonRole[];
}
export function RolesMultiSelect({ value, onChange, locked = [] }: Props) {
  const toggle = (r: PersonRole) => {
    if (locked.includes(r)) return;
    onChange(
      value.includes(r) ? value.filter((x) => x !== r) : [...value, r]
    );
  };
  return (
    <div className="space-y-3">
      {ROLE_GROUPS.map((group) =>
      <div key={group.label}>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.roles.map(({ value: r, label }) => {
            const active = value.includes(r);
            const isLocked = locked.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggle(r)}
                disabled={isLocked}
                aria-pressed={active}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                  active ?
                  'bg-primary text-white border-primary' :
                  'bg-background text-text-secondary border-border hover:border-primary/50',
                  isLocked && 'cursor-default opacity-90'
                )}>

                  {label}
                </button>);

          })}
          </div>
        </div>
      )}
    </div>);

}
