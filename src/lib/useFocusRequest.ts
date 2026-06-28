import { useEffect, useRef, useState } from 'react';

// Shared "deep-link to a specific request" behavior for the Transport & Sitting
// request lists (which have no detail modal). When `focusRequestId` is set
// (?request=<id> from the dashboard), this switches to the sub-tab that holds
// the request, briefly highlights it, and scrolls it into view — then consumes
// the param via `onFocusedRequest`.
//
// Returns the id to highlight (cleared after a few seconds). Give each card
// `id={`req-${request.id}`}` and a ring when its id matches.
export function useFocusRequest<Tab extends string>(opts: {
  focusRequestId?: string | null;
  onFocusedRequest?: () => void;
  /** Which sub-tab currently contains this request (null = leave tab as-is). */
  resolveTab: (id: string) => Tab | null;
  setSelectedTab: (tab: Tab) => void;
}): string | null {
  const { focusRequestId, onFocusedRequest, resolveTab, setSelectedTab } = opts;
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Guards against re-processing the same id when the effect re-runs due to
  // changing inline callback identities.
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusRequestId || handledRef.current === focusRequestId) return;
    handledRef.current = focusRequestId;
    const tab = resolveTab(focusRequestId);
    if (tab) setSelectedTab(tab);
    setHighlightedId(focusRequestId);
    onFocusedRequest?.();
  }, [focusRequestId, resolveTab, setSelectedTab, onFocusedRequest]);

  // Scroll the focused card into view, then clear the highlight. Driven by
  // `highlightedId` only, so consuming the URL param can't cut it short.
  useEffect(() => {
    if (!highlightedId) return;
    const scroll = setTimeout(() => {
      document.
      getElementById(`req-${highlightedId}`)?.
      scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    const clear = setTimeout(() => setHighlightedId(null), 3000);
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  }, [highlightedId]);

  return highlightedId;
}
