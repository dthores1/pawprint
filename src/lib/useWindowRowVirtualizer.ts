import { useLayoutEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// Walks up from `el` to the nearest scrollable ancestor (the page's scroll
// container — `<main>` in AppShell). Used by `pageScroll` mode so the table
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

// Virtualizes a native <table>. By default it virtualizes inside its OWN scroll
// container (a bounded max-height div): attach `scrollRef` to the scrolling
// wrapper (overflow:auto + maxHeight, sticky <thead>); in <tbody> render a
// spacer <tr> of `paddingTop`, then `virtualRows` (each `filtered[vr.index]`),
// then a spacer <tr> of `paddingBottom`. Assumes a roughly fixed `rowHeight`.
//
// Pass `pageScroll` to instead virtualize against the page's own scroll
// container, so the whole page scrolls as one (no inner scrollbar / maxHeight).
// In that mode attach `scrollRef` to the table's (non-scrolling) wrapper so its
// offset can be measured; the spacer-row math is adjusted automatically.
export function useWindowRowVirtualizer(
  count: number,
  rowHeight: number,
  pageScroll = false
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  // Offset of the table from the top of the page scroll container's content, so
  // virtual rows land in the right place (pageScroll mode only).
  const [scrollMargin, setScrollMargin] = useState(0);

  // Locate the page scroll container (pageScroll mode). Re-runs when `count`
  // changes because this hook is called at the page level, but the <table> it
  // scopes is only rendered once there are rows: on a direct URL load the rows
  // arrive after mount, so `scrollRef` is null on the first pass. Without the
  // `count` dep we'd cache that null and the virtualizer would render nothing
  // until a remount (e.g. navigating away and back).
  useLayoutEffect(() => {
    if (!pageScroll) return;
    const found = getScrollParent(scrollRef.current);
    if (found) setScrollEl(found);
  }, [pageScroll, count]);

  // Measure the table's offset within the page scroll content, re-measuring when
  // the scroller resizes or the content above the table changes height.
  useLayoutEffect(() => {
    if (!pageScroll || !scrollEl) return;
    const measure = () => {
      const el = scrollRef.current;
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
    if (scrollRef.current) ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, [pageScroll, scrollEl, count]);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => (pageScroll ? scrollEl : scrollRef.current),
    estimateSize: () => rowHeight,
    overscan: 8,
    scrollMargin: pageScroll ? scrollMargin : 0
  });
  const virtualRows = virtualizer.getVirtualItems();
  const total = virtualizer.getTotalSize();
  const margin = virtualizer.options.scrollMargin;
  // In pageScroll mode the table sits `margin` px down the scroll content via
  // normal flow, so the spacer rows are offset by `margin` (it's 0 in bounded
  // mode, leaving the original math unchanged).
  const paddingTop = virtualRows.length ? virtualRows[0].start - margin : 0;
  const paddingBottom = virtualRows.length ?
  total - virtualRows[virtualRows.length - 1].end + margin :
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
