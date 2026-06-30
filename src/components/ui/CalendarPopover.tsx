import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Floating panel anchored to a trigger, rendered in a portal so it's never
// clipped by a modal's overflow. Positions below the trigger, flips above when
// there isn't room, clamps within the viewport, and — when the content can't
// fit on either side (e.g. a tall date picker on a short iPad modal) — caps its
// height to the available space and scrolls internally. Repositions whenever the
// panel's own size changes (e.g. a typeahead list shrinking as you filter), so
// it never strands itself floating away from the trigger.
interface CalendarPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  align?: 'start' | 'end';
  /** Default true (calendar inset). Pass false for full-bleed content (lists). */
  padded?: boolean;
  children: React.ReactNode;
}
type Pos = { top: number; left: number; maxHeight: number };
export function CalendarPopover({
  anchorRef,
  open,
  onClose,
  align = 'start',
  padded = true,
  children
}: CalendarPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const M = 8; // viewport margin
    const GAP = 6; // gap between trigger and panel
    const update = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const pw = panel?.offsetWidth ?? 300;
      // Natural (unclamped) content height — scrollHeight stays accurate even
      // after we cap the panel's height, so this can't feed back on itself.
      const ph = panel?.scrollHeight ?? 340;
      const spaceBelow = window.innerHeight - rect.bottom - M;
      const spaceAbove = rect.top - M;

      let top: number;
      let maxHeight: number;
      if (ph + GAP <= spaceBelow) {
        // Fits below (the common case).
        top = rect.bottom + GAP;
        maxHeight = spaceBelow - GAP;
      } else if (ph + GAP <= spaceAbove) {
        // Doesn't fit below but fits above — flip up.
        top = rect.top - ph - GAP;
        maxHeight = spaceAbove - GAP;
      } else if (spaceBelow >= spaceAbove) {
        // Fits neither side — use the roomier side (below) and scroll.
        top = rect.bottom + GAP;
        maxHeight = spaceBelow - GAP;
      } else {
        // Fits neither side — use the roomier side (above) and scroll.
        maxHeight = spaceAbove - GAP;
        top = Math.max(M, rect.top - maxHeight - GAP);
      }

      let left = align === 'end' ? rect.right - pw : rect.left;
      left = Math.max(M, Math.min(left, window.innerWidth - pw - M));
      // Skip no-op updates so the ResizeObserver below can't loop.
      setPos((prev) =>
      prev &&
      prev.top === top &&
      prev.left === left &&
      prev.maxHeight === maxHeight ?
      prev :
      { top, left, maxHeight }
      );
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    // Reposition when the panel's content resizes (e.g. a filtered list
    // collapsing from many rows to one — otherwise it stays where the tall list
    // was and appears to float in mid-air).
    const ro = new ResizeObserver(update);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      ro.disconnect();
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
          // Cap to the available viewport space and scroll if the content is
          // taller (so a tall picker on a short screen stays fully reachable).
          maxHeight: pos?.maxHeight,
          overflowY: 'auto',
          zIndex: 60,
          visibility: pos ? 'visible' : 'hidden'
        }}
        className={`bg-card border border-border rounded-xl shadow-soft-lg ${
        padded ? 'p-2' : ''}`
        }>

          {children}
        </motion.div>
      }
    </AnimatePresence>,
    document.body
  );
}
