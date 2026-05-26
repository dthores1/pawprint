import React, { useLayoutEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// Virtualizes a (responsive) grid inside its OWN scroll container (a bounded
// max-height div). Only rows near the viewport mount, so a list of thousands
// stays light. Rows are measured (dynamic height); pass `columns={1}` for a
// single-column list.
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
  /** CSS max-height for the internal scroll area. */
  maxHeight?: string;
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
  className
}: VirtualizedGridProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(columns ?? 1);

  // Responsive column count from the scroll container's width.
  useLayoutEffect(() => {
    if (columns != null) return;
    const el = scrollRef.current;
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

  const effectiveCols = columns ?? cols;
  const rowCount = Math.ceil(items.length / effectiveCols);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight + gap,
    overscan: 5
  });

  return (
    <div
      ref={scrollRef}
      className={className}
      style={{ overflowY: 'auto', maxHeight }}>

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
                transform: `translateY(${vRow.start}px)`
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
