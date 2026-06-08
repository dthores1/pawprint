import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// Virtualizes a native <table> inside its OWN scroll container (a bounded
// max-height div). Keeps table markup; renders only rows near the viewport plus
// top/bottom spacer rows so the scrollbar stays correct. Usage: attach
// `scrollRef` to the scrolling wrapper div around the <table> (overflow:auto +
// maxHeight, sticky <thead>); in <tbody> render a spacer <tr> of `paddingTop`,
// then `virtualRows` (each `filtered[vr.index]`), then a spacer <tr> of
// `paddingBottom`. Assumes a roughly fixed `rowHeight`.
export function useWindowRowVirtualizer(count: number, rowHeight: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8
  });
  const virtualRows = virtualizer.getVirtualItems();
  const total = virtualizer.getTotalSize();
  const paddingTop = virtualRows.length ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length ?
  total - virtualRows[virtualRows.length - 1].end :
  0;

  // `measureElement` lets a caller opt into dynamic row measurement for
  // variable-height items (e.g. mobile cards): attach it as a `ref` along with
  // `data-index={vr.index}` and the virtualizer re-measures actual heights
  // instead of trusting the fixed `rowHeight` estimate.
  return {
    scrollRef,
    virtualRows,
    paddingTop,
    paddingBottom,
    measureElement: virtualizer.measureElement
  };
}
