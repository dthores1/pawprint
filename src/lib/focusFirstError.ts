/**
 * Scroll the first existing element among `orderedIds` into view and focus it.
 *
 * Pass the DOM ids of the currently-invalid fields in visual (top-to-bottom)
 * order. On a blocked form submit this reveals the first error even when it's
 * scrolled below the fold — otherwise a tall modal makes the failed save look
 * like it silently did nothing. Ids with no matching element (e.g. a field
 * hidden by the current mode) are skipped, so callers can pass the union of
 * possible targets without guarding.
 *
 * Call inside requestAnimationFrame so the error state (red borders / helper
 * text) has painted before we scroll.
 */
export function focusFirstError(orderedIds: string[]): void {
  for (const id of orderedIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // preventScroll so focus() doesn't fight our smooth scrollIntoView. Focus
    // is a no-op on non-focusable wrappers (e.g. a roles container) — the
    // scroll is what matters there.
    el.focus({ preventScroll: true });
    return;
  }
}
