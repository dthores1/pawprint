import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

// A horizontally-scrollable tab strip that reads as intentional rather than an
// accidental overflow: the scrollbar is hidden, subtle edge fades hint that
// there's more, and the active tab is auto-scrolled into view. Scales as tabs
// are added (Files, Relationships, Foster History, …).
//
// Wraps an inline-flex row of tab buttons; tag each button with `data-tabkey`
// matching `activeKey` so the active one can be revealed.
export function ScrollableTabs({
  activeKey,
  className,
  children



}: {activeKey: string;className?: string;children: React.ReactNode;}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setShowLeft(el.scrollLeft > 1);
    setShowRight(el.scrollLeft < maxScroll - 1);
  }, []);

  // Recompute fades on scroll and whenever the strip resizes (responsive width
  // or tab-set changes flip whether scrolling is even possible).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener('scroll', updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateFades);
      ro.disconnect();
    };
  }, [updateFades]);

  // Reveal the active tab. Manual horizontal scroll (not scrollIntoView) so it
  // can never nudge the page vertically.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>(`[data-tabkey="${activeKey}"]`);
    if (!active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    const pad = 12;
    if (left < el.scrollLeft) {
      el.scrollTo({ left: Math.max(0, left - pad), behavior: 'smooth' });
    } else if (right > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: right - el.clientWidth + pad, behavior: 'smooth' });
    }
  }, [activeKey]);

  return (
    <div className={cn('relative w-fit max-w-full', className)}>
      <div ref={scrollRef} className="scrollbar-hide overflow-x-auto rounded-[inherit]">
        {children}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-6 rounded-l-[inherit] bg-gradient-to-r from-card to-transparent transition-opacity',
          showLeft ? 'opacity-100' : 'opacity-0'
        )} />

      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-[inherit] bg-gradient-to-l from-card to-transparent transition-opacity',
          showRight ? 'opacity-100' : 'opacity-0'
        )} />

    </div>);

}
