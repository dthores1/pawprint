import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircleIcon,
  Edit2Icon,
  CheckIcon,
  XIcon,
  PlusIcon } from
'lucide-react';
import { Priority } from '../../types';
import { useWhisker } from '../../context/WhiskerContext';
import { cn } from '../../lib/utils';
interface ActionNeededCalloutProps {
  animalId: string;
  priority: Priority;
  actionNeeded?: string;
}
const TONE: Record<
  Exclude<Priority, 'normal'>,
  {
    wrap: string;
    icon: string;
    label: string;
    iconBg: string;
  }> =
{
  needs_attention: {
    wrap: 'bg-[#FBF1DC] border-[#E8D4A8]',
    icon: 'text-[#A36B00]',
    iconBg: 'bg-[#F3E0B5]',
    label: 'Needs Attention'
  },
  urgent: {
    wrap: 'bg-[#FBE4E4] border-[#E9C0C0]',
    icon: 'text-[#9B3A3A]',
    iconBg: 'bg-[#F3CACA]',
    label: 'Urgent'
  },
  critical: {
    wrap: 'bg-[#9B3A3A] border-[#7C2C2C] text-white',
    icon: 'text-white',
    iconBg: 'bg-white/15',
    label: 'Critical'
  }
};
export function ActionNeededCallout({
  animalId,
  priority,
  actionNeeded
}: ActionNeededCalloutProps) {
  const { updateAnimal } = useWhisker();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(actionNeeded || '');
  if (priority === 'normal') return null;
  const tone = TONE[priority];
  const isCritical = priority === 'critical';
  const save = () => {
    updateAnimal(animalId, {
      action_needed: draft.trim() || undefined
    });
    setEditing(false);
  };
  const cancel = () => {
    setDraft(actionNeeded || '');
    setEditing(false);
  };
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -6
      }}
      animate={{
        opacity: 1,
        y: 0
      }}
      className={cn('rounded-2xl border p-5 flex gap-4', tone.wrap)}>
      
      <div
        className={cn(
          'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
          tone.iconBg
        )}>
        
        <AlertCircleIcon className={cn('w-5 h-5', tone.icon)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={cn(
              'text-xs font-bold uppercase tracking-wider',
              isCritical ? 'text-white' : tone.icon
            )}>
            
            Action Needed
          </span>
          <span
            className={cn(
              'text-xs',
              isCritical ? 'text-white/70' : 'text-text-secondary'
            )}>
            
            ·
          </span>
          <span
            className={cn(
              'text-xs font-medium',
              isCritical ? 'text-white' : tone.icon
            )}>
            
            {tone.label}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {editing ?
          <motion.div
            key="editing"
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
            className="space-y-2">
            
              <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              rows={2}
              placeholder="What action is needed? Be specific — what, when, who."
              className={cn(
                'w-full text-sm rounded-lg border px-3 py-2 outline-none focus:ring-2 resize-none',
                isCritical ?
                'bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:ring-white/30' :
                'bg-white/70 border-border focus:ring-primary/30 text-text-primary'
              )} />
            
              <div className="flex items-center gap-2">
                <button
                type="button"
                onClick={save}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
                  isCritical ?
                  'bg-white text-[#9B3A3A] hover:bg-white/90' :
                  'bg-text-primary text-white hover:bg-text-primary/90'
                )}>
                
                  <CheckIcon className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                type="button"
                onClick={cancel}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                  isCritical ?
                  'text-white/80 hover:bg-white/10' :
                  'text-text-secondary hover:bg-white/50'
                )}>
                
                  Cancel
                </button>
              </div>
            </motion.div> :
          actionNeeded ?
          <motion.div
            key="display"
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
            className="flex items-start justify-between gap-3">
            
              <p
              className={cn(
                'text-sm leading-relaxed',
                isCritical ? 'text-white' : 'text-text-primary'
              )}>
              
                {actionNeeded}
              </p>
              <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium transition-colors',
                isCritical ?
                'text-white/80 hover:bg-white/10' :
                'text-text-secondary hover:text-text-primary hover:bg-white/50'
              )}>
              
                <Edit2Icon className="w-3 h-3" />
                Edit
              </button>
            </motion.div> :

          <motion.div
            key="empty"
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
            className="flex items-center justify-between gap-3">
            
              <p
              className={cn(
                'text-sm italic',
                isCritical ? 'text-white/80' : 'text-text-secondary'
              )}>
              
                No action specified yet — what's the next step?
              </p>
              <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
                isCritical ?
                'bg-white text-[#9B3A3A] hover:bg-white/90' :
                'bg-text-primary text-white hover:bg-text-primary/90'
              )}>
              
                <PlusIcon className="w-3.5 h-3.5" />
                Add action
              </button>
            </motion.div>
          }
        </AnimatePresence>
      </div>
    </motion.div>);

}