import React from 'react';
import { cn } from '../../lib/utils';
import { Animal, AnimalStatus, Priority } from '../../types';
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: AnimalStatus | 'neutral';
  children: React.ReactNode;
}
const STATUS_STYLES: Record<string, string> = {
  intake: 'bg-[#E5E2DC] text-[#6B6B6B]',
  medical: 'bg-[#F8E7C8] text-[#A36B00]',
  adoptable: 'bg-[#DDEFE2] text-[#3E7B52]',
  adopted: 'bg-[#F3E4D7] text-[#B8632E]',
  released: 'bg-[#DCEBE7] text-[#4F7A70]',
  hospice: 'bg-[#EDE0DA] text-[#7C4A3D]',
  deceased: 'bg-[#E0E0E0] text-[#555555]',
  neutral: 'bg-background text-text-secondary border border-border'
};
export const STATUS_LABELS: Record<AnimalStatus, string> = {
  intake: 'Intake',
  medical: 'Medical',
  adoptable: 'Adoptable',
  adopted: 'Adopted',
  released: 'Released',
  hospice: 'Hospice',
  deceased: 'Deceased'
};
export function Badge({
  status = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        STATUS_STYLES[status],
        className
      )}
      {...props}>
      
      {children}
    </span>);

}
export function StatusBadge({
  status,
  className



}: {status: AnimalStatus;className?: string;}) {
  return (
    <Badge status={status} className={className}>
      {STATUS_LABELS[status]}
    </Badge>);

}
const PRIORITY_STYLES: Record<
  Priority,
  {
    wrap: string;
    dot: string;
    label: string;
  }> =
{
  normal: {
    wrap: 'bg-background text-text-secondary border border-border',
    dot: 'bg-[#9CA3AF]',
    label: 'Normal'
  },
  needs_attention: {
    wrap: 'bg-[#F8E7C8] text-[#A36B00]',
    dot: 'bg-[#D4953A]',
    label: 'Needs Attention'
  },
  urgent: {
    wrap: 'bg-[#F5D7D7] text-[#9B3A3A]',
    dot: 'bg-[#C25B5B]',
    label: 'Urgent'
  },
  critical: {
    wrap: 'bg-[#9B3A3A] text-white',
    dot: 'bg-white',
    label: 'Critical'
  }
};
interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
  showLabel?: boolean;
  hideNormal?: boolean;
}
export function PriorityBadge({
  priority,
  className,
  showLabel = true,
  hideNormal = true
}: PriorityBadgeProps) {
  if (hideNormal && priority === 'normal') return null;
  const { wrap, dot, label } = PRIORITY_STYLES[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        wrap,
        className
      )}>

      <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
      {showLabel && label}
    </span>);

}

// Condition/placement badges shown alongside the lifecycle StatusBadge.
// "Fostered" is derived (active placement / current_foster_id) and passed in;
// the rest read the animal's flag fields. Renders nothing when all are off.
export function AnimalFlags({
  animal,
  isFostered = false,
  className,
  size = 'sm'
}: {
  animal: Pick<
    Animal,
    'is_on_hold' | 'has_behavior_concern' | 'has_medical_concern'>;
  isFostered?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const flags: {key: string;label: string;cls: string;}[] = [];
  if (isFostered)
  flags.push({
    key: 'fostered',
    label: 'Fostered',
    cls: 'bg-[#DCEAF7] text-[#356A9A]'
  });
  if (animal.is_on_hold)
  flags.push({
    key: 'on_hold',
    label: 'On Hold',
    cls: 'bg-[#E8DEEC] text-[#6E4E80]'
  });
  if (animal.has_behavior_concern)
  flags.push({
    key: 'behavior',
    label: 'Behavior Concern',
    cls: 'bg-[#FBE7D2] text-[#B4641E]'
  });
  if (animal.has_medical_concern)
  flags.push({
    key: 'medical',
    label: 'Medical Concern',
    cls: 'bg-[#F8E7C8] text-[#A36B00]'
  });
  if (flags.length === 0) return null;
  const sizeCls = size === 'md' ? 'text-sm px-3 py-1' : 'text-xs px-2.5 py-0.5';
  return (
    <>
      {flags.map((f) =>
      <span
        key={f.key}
        className={cn(
          'inline-flex items-center rounded-full font-medium',
          sizeCls,
          f.cls,
          className
        )}>

          {f.label}
        </span>
      )}
    </>);

}