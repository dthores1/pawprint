import React, { useLayoutEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// Walks up from `el` to the nearest scrollable ancestor (the page's scroll
// container — `<main>` in AppShell). Used by `pageScroll` mode so the grid
// virtualizes against the page scroll instead of its own bounded box.
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

// Virtualizes a (responsive) grid. By default it owns a bounded (max-height)
// scroll container, so only rows near the viewport mount and a list of
// thousands stays light. Pass `pageScroll` to instead virtualize against the
// page's own scroll container (no inner scrollbar — the whole page scrolls),
// which avoids the awkward nested-scroll experience on long pages.
interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  /** Fixed column count. Omit to auto-compute from `minColumnWidth`. */
  columns?: number;
  /** Min px width per column when auto-computing (ignored if `columns` set). */
  minColumnWidth?: number;
  /** Starting guess for a row's height (px) before measurement. */
  estimateRowHeight?: number;
  /** Gap between cards/rows, px. */
  gap?: number;
  /** CSS max-height for the internal scroll area (bounded mode only). */
  maxHeight?: string;
  /**
   * Virtualize against the page's scroll container instead of an inner bounded
   * box, so the whole page scrolls as one. No inner scrollbar / `maxHeight`.
   */
  pageScroll?: boolean;
  className?: string;
}
export function VirtualizedGrid<T>({
  items,
  renderItem,
  getKey,
  columns,
  minColumnWidth = 320,
  estimateRowHeight = 220,
  gap = 24,
  maxHeight = '70vh',
  pageScroll = false,
  className
}: VirtualizedGridProps<T>) {
  // The outer element: in bounded mode it's the scroll container; in pageScroll
  // mode it's a plain positioning wrapper and the real scroller is an ancestor.
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(columns ?? 1);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  // Offset of this grid from the top of the page scroll container's content, so
  // virtual items land in the right place (pageScroll mode only).
  const [scrollMargin, setScrollMargin] = useState(0);

  // Responsive column count from the container's width.
  useLayoutEffect(() => {
    if (columns != null) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      setCols(Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [columns, gap, minColumnWidth]);

  // Locate the page scroll container once mounted (pageScroll mode).
  useLayoutEffect(() => {
    if (!pageScroll) return;
    setScrollEl(getScrollParent(containerRef.current));
  }, [pageScroll]);

  // Measure this grid's offset within the page scroll content, and re-measure
  // when the scroller resizes or the content above the grid changes height
  // (e.g. filters wrapping, tab switches that change `items`).
  useLayoutEffect(() => {
    if (!pageScroll || !scrollEl) return;
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const offset =
        el.getBoundingClientRect().top -
        scrollEl.getBoundingClientRect().top +
        scrollEl.scrollTop;
      setScrollMargin((prev) => (prev === offset ? prev : offset));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scrollEl);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [pageScroll, scrollEl, items]);

  const effectiveCols = columns ?? cols;
  const rowCount = Math.ceil(items.length / effectiveCols);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => (pageScroll ? scrollEl : containerRef.current),
    estimateSize: () => estimateRowHeight + gap,
    overscan: 5,
    scrollMargin: pageScroll ? scrollMargin : 0
  });

  return (
    <div
      ref={containerRef}
      className={className}
      style={pageScroll ? undefined : { overflowY: 'auto', maxHeight }}>

      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%'
        }}>

        {virtualizer.getVirtualItems().map((vRow) => {
          const start = vRow.index * effectiveCols;
          const rowItems = items.slice(start, start + effectiveCols);
          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${
                  vRow.start - virtualizer.options.scrollMargin
                }px)`
              }}>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`,
                  gap,
                  paddingBottom: gap
                }}>

                {rowItems.map((item) =>
                <div key={getKey(item)}>{renderItem(item)}</div>
                )}
              </div>
            </div>);

        })}
      </div>
    </div>);

}
