import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Floating panel anchored to a trigger, rendered in a portal so it's never
// clipped by a modal's overflow. Positions below the trigger, flips above when
// there isn't room, and clamps within the viewport.
interface CalendarPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  align?: 'start' | 'end';
  children: React.ReactNode;
}
export function CalendarPopover({
  anchorRef,
  open,
  onClose,
  align = 'start',
  children
}: CalendarPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const pw = panel?.offsetWidth ?? 300;
      const ph = panel?.offsetHeight ?? 340;
      let top = rect.bottom + 6;
      // Flip above the trigger when there isn't room below.
      if (top + ph > window.innerHeight - 8 && rect.top - ph - 6 > 8) {
        top = rect.top - ph - 6;
      }
      let left = align === 'end' ? rect.right - pw : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      setPos({ top, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, align, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose, anchorRef]);

  return createPortal(
    <AnimatePresence>
      {open &&
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.12 }}
        style={{
          position: 'fixed',
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          zIndex: 60,
          visibility: pos ? 'visible' : 'hidden'
        }}
        className="bg-card border border-border rounded-xl shadow-soft-lg p-2">

          {children}
        </motion.div>
      }
    </AnimatePresence>,
    document.body
  );
}
