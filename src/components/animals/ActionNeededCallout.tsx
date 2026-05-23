import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircleIcon,
  PencilIcon,
  CheckCircle2Icon,
  PlusIcon } from
'lucide-react';
import { Priority } from '../../types';
import { useWhisker } from '../../context/WhiskerContext';
import { cn } from '../../lib/utils';

type ElevatedPriority = Exclude<Priority, 'normal'>;
interface ActionNeededCalloutProps {
  animalId: string;
  animalName: string;
  /** The animal's overall priority (drives the empty-state message). */
  priority: Priority;
}
const TONE: Record<
  ElevatedPriority,
  { wrap: string; icon: string; iconBg: string; label: string }> =
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
const PRIORITY_OPTIONS: ElevatedPriority[] = [
'needs_attention',
'urgent',
'critical'];


type Mode = 'view' | 'confirm' | 'edit' | 'add';

export function ActionNeededCallout({
  animalId,
  animalName,
  priority
}: ActionNeededCalloutProps) {
  const {
    actionItems,
    addActionItem,
    updateActionItem,
    completeActionItem
  } = useWhisker();
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState('');
  const [draftPriority, setDraftPriority] =
  useState<ElevatedPriority>('needs_attention');

  const openItem = actionItems.find(
    (a) => a.animal_id === animalId && a.status === 'open'
  );

  // Visible when there's an open item, the animal is still elevated, or a form
  // is mid-flow (so "Complete & Add Next Step" doesn't vanish the banner).
  const visible = !!openItem || priority !== 'normal' || mode !== 'view';
  if (!visible) return null;

  const formMode = mode === 'edit' || mode === 'add';
  // While editing/adding, the banner tone follows the priority dropdown live.
  const tonePriority: ElevatedPriority = formMode ?
  draftPriority :
  openItem?.priority ?? (priority !== 'normal' ? priority : draftPriority);
  const tone = TONE[tonePriority];
  const isCritical = tonePriority === 'critical';

  const toView = () => setMode('view');
  const startEdit = () => {
    if (!openItem) return;
    setDraft(openItem.description);
    setDraftPriority(openItem.priority);
    setMode('edit');
  };
  const startAdd = (seedPriority: ElevatedPriority) => {
    setDraft('');
    setDraftPriority(seedPriority);
    setMode('add');
  };
  const saveEdit = () => {
    if (!openItem || !draft.trim()) return;
    updateActionItem(openItem.id, {
      description: draft.trim(),
      priority: draftPriority
    });
    toView();
  };
  const saveAdd = () => {
    if (!draft.trim()) return;
    addActionItem({
      animal_id: animalId,
      description: draft.trim(),
      priority: draftPriority
    });
    toView();
  };

  // Shared button styles, tuned for light tones vs. the dark critical banner.
  const primaryBtn = cn(
    'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
    isCritical ?
    'bg-white text-[#9B3A3A] hover:bg-white/90' :
    'bg-text-primary text-white hover:bg-text-primary/90'
  );
  const subtleBtn = cn(
    'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors',
    isCritical ?
    'text-white/80 hover:bg-white/10' :
    'text-text-secondary hover:text-text-primary hover:bg-white/50'
  );
  const iconBtn = cn(
    'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
    isCritical ?
    'text-white/80 hover:bg-white/15 hover:text-white' :
    'text-text-secondary hover:text-text-primary hover:bg-white/60'
  );
  const fieldClass = cn(
    'w-full text-sm rounded-lg border px-3 py-2 outline-none focus:ring-2',
    'bg-white/90 border-border focus:ring-primary/30 text-text-primary'
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
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
          {formMode ?
          <select
            value={draftPriority}
            onChange={(e) =>
            setDraftPriority(e.target.value as ElevatedPriority)
            }
            aria-label="Priority"
            className="h-7 text-xs font-medium rounded-md px-2 cursor-pointer bg-white/90 text-text-primary border border-black/10 outline-none focus:ring-2 focus:ring-primary/40">

              {PRIORITY_OPTIONS.map((p) =>
            <option key={p} value={p}>
                  {TONE[p].label}
                </option>
            )}
            </select> :

          <span
            className={cn(
              'text-xs font-medium',
              isCritical ? 'text-white' : tone.icon
            )}>

              {tone.label}
            </span>
          }
        </div>

        <AnimatePresence mode="wait">
          {/* — Edit / Add form — */}
          {mode === 'edit' || mode === 'add' ?
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3">

              <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              rows={2}
              placeholder="What's the next step? Be specific — what, when, who."
              className={cn(fieldClass, 'resize-none')} />

              <div className="flex items-center justify-end gap-2">
                <button
                type="button"
                onClick={mode === 'edit' ? saveEdit : saveAdd}
                disabled={!draft.trim()}
                className={cn(primaryBtn, 'disabled:opacity-50')}>

                  <CheckCircle2Icon className="w-3.5 h-3.5" />
                  {mode === 'edit' ? 'Save' : 'Add'}
                </button>
                <button type="button" onClick={toView} className={subtleBtn}>
                  Cancel
                </button>
              </div>
            </motion.div> :

          /* — Complete confirmation — */
          mode === 'confirm' && openItem ?
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-between gap-3 flex-wrap">

              <p
              className={cn(
                'text-sm font-medium',
                isCritical ? 'text-white' : 'text-text-primary'
              )}>

                Mark complete?
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                type="button"
                onClick={() => {
                  completeActionItem(openItem.id);
                  toView();
                }}
                className={primaryBtn}>

                  <CheckCircle2Icon className="w-3.5 h-3.5" />
                  Complete
                </button>
                <button
                type="button"
                onClick={() => {
                  completeActionItem(openItem.id);
                  startAdd(openItem.priority);
                }}
                className={subtleBtn}>

                  <PlusIcon className="w-3.5 h-3.5" />
                  Add Next Step
                </button>
                <button type="button" onClick={toView} className={subtleBtn}>
                  Cancel
                </button>
              </div>
            </motion.div> :

          /* — Open item (default view) — */
          openItem ?
          <motion.div
            key="open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start justify-between gap-3">

              <p
              className={cn(
                'text-sm leading-relaxed',
                isCritical ? 'text-white' : 'text-text-primary'
              )}>

                {openItem.description}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                type="button"
                onClick={() => setMode('confirm')}
                title="Complete"
                aria-label="Complete action item"
                className={iconBtn}>

                  <CheckCircle2Icon className="w-4 h-4" />
                </button>
                <button
                type="button"
                onClick={startEdit}
                title="Edit"
                aria-label="Edit action item"
                className={iconBtn}>

                  <PencilIcon className="w-4 h-4" />
                </button>
              </div>
            </motion.div> :

          /* — Empty state: elevated priority but no open item — */
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-between gap-3">

              <p
              className={cn(
                'text-sm',
                isCritical ? 'text-white/90' : 'text-text-secondary'
              )}>

                {animalName} is still marked{' '}
                <span className="font-medium">{tone.label}</span> but has no
                active action item.
              </p>
              <button
              type="button"
              onClick={() => startAdd(tonePriority)}
              className={cn(primaryBtn, 'shrink-0')}>

                <PlusIcon className="w-3.5 h-3.5" />
                Add action item
              </button>
            </motion.div>
          }
        </AnimatePresence>
      </div>
    </motion.div>);

}
