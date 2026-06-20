import {
  TruckIcon,
  HomeIcon,
  PackageIcon,
  HeartIcon,
  StethoscopeIcon,
  PawPrintIcon,
  CalendarClockIcon,
  AlertTriangleIcon,
  BellIcon } from
'lucide-react';
import { cn } from '../../lib/utils';

// Per-type glyph + tint. Falls back to a neutral bell for unknown types so a
// future notification type still renders sensibly before this map is updated.
const META: Record<string, { Icon: typeof BellIcon; tint: string }> = {
  transport_request_claimed: { Icon: TruckIcon, tint: 'bg-blue-100 text-blue-600' },
  transport_request_assigned: { Icon: TruckIcon, tint: 'bg-blue-100 text-blue-600' },
  sitting_request_accepted: { Icon: HomeIcon, tint: 'bg-violet-100 text-violet-600' },
  supply_request_status_changed: { Icon: PackageIcon, tint: 'bg-amber-100 text-amber-600' },
  foster_animal_status_changed: { Icon: PawPrintIcon, tint: 'bg-teal-100 text-teal-600' },
  foster_animal_adoption_status_changed: { Icon: HeartIcon, tint: 'bg-rose-100 text-rose-600' },
  foster_animal_medical_record_added: { Icon: StethoscopeIcon, tint: 'bg-emerald-100 text-emerald-600' },
  foster_placement_assigned: { Icon: HomeIcon, tint: 'bg-violet-100 text-violet-600' },
  foster_placement_ended: { Icon: HomeIcon, tint: 'bg-slate-100 text-slate-600' },
  clinic_appointment_scheduled: { Icon: CalendarClockIcon, tint: 'bg-emerald-100 text-emerald-600' },
  // Time-based reminders (migration 0068)
  clinic_appointment_reminder: { Icon: CalendarClockIcon, tint: 'bg-emerald-100 text-emerald-600' },
  clinic_event_reminder: { Icon: CalendarClockIcon, tint: 'bg-emerald-100 text-emerald-600' },
  transport_reminder_volunteer: { Icon: TruckIcon, tint: 'bg-blue-100 text-blue-600' },
  transport_reminder_requester: { Icon: TruckIcon, tint: 'bg-blue-100 text-blue-600' },
  transport_reminder_unaccepted: { Icon: AlertTriangleIcon, tint: 'bg-amber-100 text-amber-700' },
  sitting_reminder_volunteer: { Icon: HomeIcon, tint: 'bg-violet-100 text-violet-600' },
  sitting_reminder_requester: { Icon: HomeIcon, tint: 'bg-violet-100 text-violet-600' },
  sitting_reminder_unaccepted: { Icon: AlertTriangleIcon, tint: 'bg-amber-100 text-amber-700' },
  foster_placement_ending: { Icon: CalendarClockIcon, tint: 'bg-slate-100 text-slate-600' }
};

export function NotificationIcon({
  type,
  className



}: {type: string;className?: string;}) {
  const { Icon, tint } = META[type] ?? { Icon: BellIcon, tint: 'bg-slate-100 text-slate-600' };
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full w-9 h-9 shrink-0',
        tint,
        className
      )}>

      <Icon className="w-4 h-4" />
    </span>);

}
