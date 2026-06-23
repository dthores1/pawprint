import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  /** Tooltip body — string or rich content. */
  content: React.ReactNode;
  /** The trigger element(s). */
  children: React.ReactNode;
  side?: 'top' | 'bottom';
  /** ms before showing. Default 120 — snappy, unlike the ~500ms native title. */
  delay?: number;
  className?: string;
}

// Lightweight, reusable tooltip: portal-rendered (never clipped by card overflow),
// appears fast on hover OR keyboard focus, and is pointer-transparent so it never
// blocks clicks. Replaces the browser `title` attribute, which is slow and unstyled.
export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 120,
  className
}: TooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({
        top: side === 'top' ? r.top : r.bottom,
        left: r.left + r.width / 2
      });
    }, delay);
  }, [delay, side]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setCoords(null);
  }, []);

  return (
    <span
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      className={`inline-flex outline-none ${className ?? ''}`}>

      {children}
      {coords &&
      createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform:
            side === 'top' ?
            'translate(-50%, calc(-100% - 8px))' :
            'translate(-50%, 8px)'
          }}
          className="z-[100] pointer-events-none max-w-xs rounded-lg bg-[#2D2A26] px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-soft-lg">

          {content}
        </div>,
        document.body
      )}
    </span>);

}
